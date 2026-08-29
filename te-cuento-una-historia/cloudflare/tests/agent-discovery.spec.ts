import { expect, test } from "@playwright/test"

test("publishes a stable HTML archive with all story links", async ({ page }) => {
  // Vite preview needs the physical directory slash; Cloudflare's
  // drop-trailing-slash policy serves the same document at canonical /relatos.
  await page.goto("/relatos/")

  await expect(page).toHaveTitle(/Relatos/u)
  await expect(page.getByRole("heading", { level: 1, name: "Relatos" })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://cuentos.ar/relatos",
  )

  const storyLinks = page.locator('main ol a[href^="https://cuentos.ar/relatos/"]')
  await expect(storyLinks).toHaveCount(68)
  await expect(storyLinks.first()).toHaveText("Reflexiones de Taxi")
  await expect(storyLinks.last()).toHaveText("De bebidas y momentos")
  await expect(page.locator('script[type="module"]')).toHaveCount(0)
})

test("links the initial home HTML and interactive credits to the archive", async ({ page }) => {
  const response = await page.request.get("/")
  const html = await response.text()
  expect(html).toContain('<a href="/relatos"')

  await page.goto("/?debugHotspots=1")
  await page.getByRole("button", { name: "Créditos" }).click()
  await expect(page.getByRole("link", { name: "Leer todos los relatos" })).toHaveAttribute(
    "href",
    "/relatos",
  )
})

test("publishes OpenAI discovery policy across robots, sitemap, and llms", async ({ request }) => {
  const [robots, sitemap, llms] = await Promise.all([
    request.get("/robots.txt").then((response) => response.text()),
    request.get("/sitemap.xml").then((response) => response.text()),
    request.get("/llms.txt").then((response) => response.text()),
  ])

  expect(robots).toContain("User-agent: OAI-SearchBot\nAllow: /")
  expect(robots).toContain("User-agent: ChatGPT-User\nAllow: /")
  expect(sitemap).toContain("<loc>https://cuentos.ar/relatos</loc>")
  expect(sitemap.match(/<url>/gu)).toHaveLength(70)
  expect(llms).toContain("Archive: https://cuentos.ar/relatos")
})
