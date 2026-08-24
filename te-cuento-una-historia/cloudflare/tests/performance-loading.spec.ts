import { expect, test } from "@playwright/test"

test("keeps the initial home under 4 MB and defers WebGL and audio until intent", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("#intro-enter")).toBeEnabled()

  const initial = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    return {
      bytes: navigation.transferSize
        + resources.reduce((total, resource) => total + resource.transferSize, 0),
      urls: resources.map((resource) => resource.name),
      canvas: Boolean(document.querySelector("#stage canvas")),
      audioPreload: document.querySelector<HTMLAudioElement>("#city-audio-source")?.preload,
    }
  })

  expect(initial.bytes).toBeLessThan(4_000_000)
  expect(initial.canvas).toBe(false)
  expect(initial.audioPreload).toBe("none")
  expect(initial.urls.some((url) => url.endsWith(".png"))).toBe(false)
  expect(initial.urls.some((url) => url.endsWith(".mp3"))).toBe(false)

  await page.locator("#intro-enter").click()
  await expect(page.locator("#intro")).toHaveClass(/is-dismissed/u, { timeout: 30_000 })
  await expect(page.locator("#stage canvas")).toBeAttached()

  const loadedAfterIntent = await page.evaluate(() => (
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .map((resource) => resource.name)
  ))
  expect(loadedAfterIntent.some((url) => url.endsWith("city-traffic-walla-horns-v003.mp3"))).toBe(true)
  expect(loadedAfterIntent.some((url) => url.endsWith(".avif"))).toBe(true)
})
