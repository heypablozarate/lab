// This function is serialized into a standalone script shared by the immersive
// shell and the static archive. Keep it independent of the React/Three bundle.
export function installAnalytics(config, browser = window) {
  const { measurementId, pages } = config
  const document = browser.document
  const eligible = () => browser.location.origin === "https://cuentos.ar"
    && Object.hasOwn(pages, browser.location.pathname)
    && browser[`ga-disable-${measurementId}`] !== true
  if (!eligible() || browser.__cuentosAnalytics) return
  browser.__cuentosAnalytics = true
  browser.dataLayer = browser.dataLayer || []
  function gtag() {
    // gtag consumes Arguments records, not plain event objects.
    browser.dataLayer.push(arguments)
  }
  browser.gtag = gtag
  gtag("js", new Date())
  gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  let previousLocation = document.referrer
  let previousPage = null
  const trackPage = () => {
    if (!eligible()) return
    const url = new URL(browser.location.href)
    url.hash = ""
    const location = url.href
    if (location === previousPage) return
    gtag("event", "page_view", {
      send_to: measurementId,
      page_location: location,
      page_title: pages[url.pathname],
      page_referrer: previousLocation,
    })
    previousPage = location
    previousLocation = location
  }
  trackPage()
  for (const method of ["pushState", "replaceState"]) {
    const original = browser.history[method]
    browser.history[method] = function (...args) {
      const result = original.apply(this, args)
      trackPage()
      return result
    }
  }
  browser.addEventListener("popstate", trackPage)

  let loaded = false
  const load = () => {
    if (loaded) return
    loaded = true
    browser.clearTimeout(timer)
    browser.removeEventListener("pointerdown", load)
    browser.removeEventListener("keydown", load)
    if (!eligible()) return
    const script = document.createElement("script")
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)
  }
  const timer = browser.setTimeout(load, 10_000)
  browser.addEventListener("pointerdown", load, { once: true, passive: true })
  browser.addEventListener("keydown", load, { once: true })
}

export function buildAnalyticsScript(pages) {
  return `(${installAnalytics.toString()})(${JSON.stringify({
    measurementId: "G-2LJ5X4G79B",
    pages,
  }).replace(/</gu, "\\u003c")});\n`
}
