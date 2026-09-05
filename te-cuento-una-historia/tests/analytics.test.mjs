import assert from "node:assert/strict"
import { test } from "node:test"
import { installAnalytics, buildAnalyticsScript } from "../cloudflare/scripts/analytics.mjs"

const config = {
  measurementId: "G-2LJ5X4G79B",
  pages: { "/": "Home", "/relatos": "Archive", "/relatos/story": "Story" },
}

function fixture(url = "https://cuentos.ar/") {
  const events = new Map()
  const scripts = []
  let timer
  const browser = {
    location: new URL(url),
    document: {
      referrer: "https://www.google.com/",
      createElement: () => ({}),
      head: { appendChild: (script) => scripts.push(script) },
    },
    history: {},
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
    setTimeout: (fn) => { timer = fn; return 1 },
    clearTimeout: () => { timer = undefined },
  }
  for (const method of ["pushState", "replaceState"]) {
    browser.history[method] = (_state, _unused, next) => {
      browser.location = new URL(next, browser.location)
    }
  }
  return { browser, scripts, events, timeout: () => timer?.() }
}

const views = (browser) => (browser.dataLayer ?? [])
  .filter((record) => record[0] === "event" && record[1] === "page_view")
  .map((record) => record[2])

test("counts direct loads and each real history transition once, with correct titles and referrers", () => {
  const { browser, events } = fixture()
  installAnalytics(config, browser)
  installAnalytics(config, browser)
  browser.history.replaceState({}, "", "/")
  browser.history.pushState({}, "", "/relatos/story")
  browser.history.replaceState({}, "", "/relatos/story#paragraph")
  browser.location = new URL("https://cuentos.ar/")
  events.get("popstate")()
  assert.deepEqual(views(browser).map((view) => view.page_title), ["Home", "Story", "Home"])
  assert.equal(views(browser)[1].page_referrer, "https://cuentos.ar/")
  assert.equal(views(browser)[2].page_referrer, "https://cuentos.ar/relatos/story")
  assert.equal(browser.dataLayer[1][2].send_page_view, false)
  assert.equal(Object.prototype.toString.call(browser.dataLayer[0]), "[object Arguments]")
})

test("loads Google only after interaction or fallback, once", () => {
  const { browser, scripts, events, timeout } = fixture("https://cuentos.ar/relatos/story")
  installAnalytics(config, browser)
  assert.equal(views(browser)[0].page_title, "Story")
  assert.equal(scripts.length, 0)
  events.get("pointerdown")()
  timeout()
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-2LJ5X4G79B")
  const archive = fixture("https://cuentos.ar/relatos")
  installAnalytics(config, archive.browser)
  archive.timeout()
  assert.equal(archive.scripts.length, 1)
  assert.equal(views(archive.browser)[0].page_title, "Archive")
})

test("never collects from previews, local hosts, unknown routes, or opted-out visitors", () => {
  for (const url of ["http://localhost:4173/", "http://cuentos.ar/", "https://cuentos.ar:444/", "https://preview.cuentos.ar/", "https://cuentos.ar/not-found"]) {
    const { browser, timeout, scripts } = fixture(url)
    installAnalytics(config, browser)
    timeout()
    assert.equal(browser.dataLayer, undefined)
    assert.equal(scripts.length, 0)
  }
  const { browser, timeout, scripts } = fixture()
  browser[`ga-disable-${config.measurementId}`] = true
  installAnalytics(config, browser)
  timeout()
  assert.equal(browser.dataLayer, undefined)
  assert.equal(scripts.length, 0)
})

test("a late opt-out stops collection and deferred loading", () => {
  const { browser, timeout, scripts } = fixture()
  installAnalytics(config, browser)
  browser[`ga-disable-${config.measurementId}`] = true
  browser.history.pushState({}, "", "/relatos/story")
  timeout()
  assert.equal(views(browser).length, 1)
  assert.equal(scripts.length, 0)
})

test("generated script is standalone and escapes authored text", () => {
  const script = buildAnalyticsScript({ "/": "A </script> title" })
  assert.ok(!script.includes("</script>"))
  assert.doesNotThrow(() => new Function(script))
})
