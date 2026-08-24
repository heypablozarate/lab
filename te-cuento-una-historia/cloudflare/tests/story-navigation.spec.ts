import { expect, test } from "@playwright/test"

test("never shows the previous illustration while the next story image decodes", async ({ page }) => {
  let releaseTargetImage: (() => void) | undefined
  let markTargetRequestStarted: (() => void) | undefined
  const targetRequestStarted = new Promise<void>((resolve) => {
    markTargetRequestStarted = resolve
  })

  await page.route(
    "**/assets/stories/del-tengo-eso-y-quiero-aquello/paper.avif?*",
    async (route) => {
      markTargetRequestStarted?.()
      await new Promise<void>((resolve) => {
        releaseTargetImage = resolve
      })
      await route.continue()
    },
  )

  await page.goto("/?debugHotspots=1")
  const sourceClue = page.locator(
    '#clue-layer .clue[data-story="del-motivo-de-la-poesia"]',
  )
  await expect(sourceClue).toHaveAttribute("aria-hidden", "false", {
    timeout: 30_000,
  })
  await sourceClue.click({ force: true })

  const illustration = page.locator("#reader-illustration")
  await expect(page.locator("#reader-title")).toHaveText("Del motivo de la poesía")
  await expect(illustration).toHaveJSProperty(
    "complete",
    true,
  )
  await expect(illustration).toHaveCSS("opacity", "1")

  await page.getByRole("link", { name: "Sebastian Moon" }).click()
  await expect(page.locator("#reader-title")).toHaveText(
    "Del tengo eso y quiero aquello",
  )
  await targetRequestStarted

  await expect(illustration).toHaveCSS("opacity", "0")

  releaseTargetImage?.()
  await expect(illustration).toHaveAttribute(
    "src",
    /del-tengo-eso-y-quiero-aquello\/paper\.avif/u,
  )
  await expect(illustration).toHaveCSS("opacity", "1")
})
