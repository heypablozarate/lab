import { expect, test, type Page } from "@playwright/test"

// Vite preview serves generated directory indexes with the trailing slash;
// Cloudflare's drop-trailing-slash handling exposes the canonical URL without it.
const TAXI_PATH = "/relatos/reflexiones-de-taxi/"
const TAXI_TITLE = "Reflexiones de Taxi"
const GOOD_NIGHT_PATH = "/relatos/buenas-noches-%C2%BFcomo-le-va/"
const GOOD_NIGHT_TITLE = "Buenas noches, ¿cómo le va?"
const LINKED_STORY_PATH = "/relatos/del-motivo-de-la-poesia/"

async function expectReadableStaticStory(page: Page, title: string) {
  const fallback = page.locator("#root[data-story-fallback]")
  await expect(fallback).toBeVisible()
  await expect(fallback.locator("h1")).toHaveText(title)
  await expect(fallback.locator("article > div")).not.toBeEmpty()
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(1)
  expect(
    await fallback.locator("article > div").evaluate(
      (element) => element.textContent?.trim().length ?? 0,
    ),
  ).toBeGreaterThan(500)
  expect(
    await fallback.evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true)
  expect(
    await fallback.evaluate((element) => {
      element.scrollTop = element.scrollHeight
      return element.scrollTop > 0
    }),
  ).toBe(true)
}

test("keeps the complete story readable when JavaScript is disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()

  await page.goto(GOOD_NIGHT_PATH)
  await expectReadableStaticStory(page, GOOD_NIGHT_TITLE)

  await context.close()
})

test("preserves the indexable story metadata contract", async ({ page }) => {
  await page.goto(GOOD_NIGHT_PATH)

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://cuentos.ar/relatos/buenas-noches-%C2%BFcomo-le-va",
  )
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  )
  const structuredData = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent() ?? "null",
  )
  expect(structuredData).toMatchObject({
    "@type": "Article",
    headline: GOOD_NIGHT_TITLE,
    url: "https://cuentos.ar/relatos/buenas-noches-%C2%BFcomo-le-va",
  })
})

test("keeps the static story when WebGL initialization fails", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function getContext(
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") return null
      return Reflect.apply(originalGetContext, this, [contextId, ...args])
    } as typeof HTMLCanvasElement.prototype.getContext
  })

  await page.goto(TAXI_PATH)
  await expect(page.locator("#root[data-story-fallback][data-runtime-failed]")).toBeAttached({
    timeout: 30_000,
  })
  await expectReadableStaticStory(page, TAXI_TITLE)
  await expect(page.locator("#interactive-root")).toHaveCount(0)
})

test("keeps the static story when the runtime chunk fails to load", async ({ page }) => {
  await page.route("**/assets/runtime-*.js", (route) => route.abort("failed"))

  await page.goto(GOOD_NIGHT_PATH)
  await expect(page.locator("#root[data-story-fallback][data-runtime-failed]")).toBeAttached({
    timeout: 30_000,
  })
  await expectReadableStaticStory(page, GOOD_NIGHT_TITLE)
  await expect(page.locator("#interactive-root")).toHaveCount(0)
})

test("keeps the static story when the interactive story payload fails", async ({ page }) => {
  await page.route("**/data/stories/reflexiones-de-taxi.md", (route) =>
    route.abort("failed"),
  )

  await page.goto(TAXI_PATH)
  await expect(page.locator("#root[data-story-fallback][data-runtime-failed]")).toBeAttached({
    timeout: 30_000,
  })
  await expectReadableStaticStory(page, TAXI_TITLE)
  await expect(page.locator("#interactive-root")).toHaveCount(0)
})

test("replaces the fallback only after the interactive reader is ready", async ({ page }) => {
  await page.goto(TAXI_PATH)

  await expect(page.locator("#reader-title")).toHaveText(TAXI_TITLE, {
    timeout: 30_000,
  })
  await expect(page.locator("#reader-body")).not.toBeEmpty()
  expect(
    await page.locator("#reader-body").evaluate(
      (element) => element.textContent?.trim().length ?? 0,
    ),
  ).toBeGreaterThan(500)
  await expect(page.locator("#root[data-story-fallback]")).toHaveCount(0)
  await expect(page.locator("#interactive-root")).not.toHaveAttribute("aria-hidden", "true")
  await expect(page.getByRole("heading", { name: TAXI_TITLE, exact: true })).toHaveCount(1)
  await expect(page.locator("#reader-close")).toBeFocused()
})

test("keeps one readable story through Back and Forward navigation", async ({ page }) => {
  const initialTitle = "Del motivo de la poesía"
  await page.goto(LINKED_STORY_PATH)
  await expect(page.locator("#reader-title")).toHaveText(initialTitle, {
    timeout: 30_000,
  })

  await page.getByRole("link", { name: "Sebastian Moon" }).click()
  const linkedTitle = "Del tengo eso y quiero aquello"
  await expect(page.locator("#reader-title")).toHaveText(linkedTitle)
  await expect(page.locator("#reader-body")).not.toBeEmpty()

  await page.goBack()
  await expect(page.locator("#reader-title")).toHaveText(initialTitle)
  await expect(page.getByRole("heading", { name: initialTitle, exact: true })).toHaveCount(1)

  await page.goForward()
  await expect(page.locator("#reader-title")).toHaveText(linkedTitle)
  await expect(page.getByRole("heading", { name: linkedTitle, exact: true })).toHaveCount(1)
})
