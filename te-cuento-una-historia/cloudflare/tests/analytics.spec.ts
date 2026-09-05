import { expect, test, type Page } from "@playwright/test"

async function views(page: Page) {
  return page.evaluate(() => {
    const records = (window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? []
    return records.filter((record) => record[0] === "event" && record[1] === "page_view")
      .map((record) => record[2] as { page_location: string; page_title: string })
  })
}

test("production-tagged build measures reader navigation once without loading Google during initial render", async ({ page }) => {
  let googleLoads = 0
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    googleLoads += 1
    await route.fulfill({ contentType: "text/javascript", body: "" })
  })
  // Serve the local build under its production origin. No test events reach GA.
  await page.route("https://cuentos.ar/**", async (route) => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:4173${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
  await page.goto("https://cuentos.ar/relatos/del-motivo-de-la-poesia")
  await expect.poll(() => views(page)).toHaveLength(1)
  expect(googleLoads).toBe(0)
  await expect(page.locator("#reader-title")).toHaveText("Del motivo de la poesía", { timeout: 30_000 })
  await page.getByRole("link", { name: "Sebastian Moon" }).click()
  await expect.poll(() => views(page)).toHaveLength(2)
  await expect(page.locator("#reader-title")).toHaveText("Del tengo eso y quiero aquello")
  expect((await views(page))[1].page_title).toContain("Del tengo eso y quiero aquello")
  await page.goBack()
  await expect.poll(() => views(page)).toHaveLength(3)
  expect((await views(page))[2].page_location).toBe("https://cuentos.ar/relatos/del-motivo-de-la-poesia")
  expect(googleLoads).toBe(1)
  await page.locator("#reader-close").click()
  await expect(page).toHaveURL("https://cuentos.ar/")
  await expect.poll(() => views(page)).toHaveLength(4)
})

test("static archive includes tracking but preview origin never collects", async ({ page, request }) => {
  const archive = await request.get("/relatos")
  expect(await archive.text()).toContain('<script defer src="/analytics.js"></script>')
  await page.goto("/relatos")
  await page.getByRole("heading", { level: 1 }).waitFor()
  expect(await views(page)).toEqual([])
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0)
})
