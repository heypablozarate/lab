import { expect, test, type Page } from "@playwright/test"

type AnchorState = {
  maximum: number
  progress: number
  anchors: Array<{
    slug: string
    errorX: number
    errorY: number
    width: number
    height: number
  }>
}

async function waitForOpenBook(page: Page) {
  await page.goto("/?autoplay=1")
  await page.waitForFunction(() => (
    document.querySelector("#clue-layer .clue")?.getAttribute("aria-hidden") === "false"
  ))
}

async function nearestVisibleClue(page: Page, progress: number) {
  await anchorState(page, progress)
  const slug = await page.evaluate(() => {
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const clues = [...document.querySelectorAll<HTMLElement>("#clue-layer .clue")]
      .filter((clue) => {
        const rect = clue.getBoundingClientRect()
        return rect.right > 0
          && rect.left < window.innerWidth
          && rect.bottom > 0
          && rect.top < window.innerHeight
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect()
        const rightRect = right.getBoundingClientRect()
        return Math.hypot(
          leftRect.left + leftRect.width / 2 - centerX,
          leftRect.top + leftRect.height / 2 - centerY,
        ) - Math.hypot(
          rightRect.left + rightRect.width / 2 - centerX,
          rightRect.top + rightRect.height / 2 - centerY,
        )
      })
    const clue = clues[0]
    if (!clue?.dataset.story) throw new Error("No hay un hotspot visible")
    return clue.dataset.story
  })
  return page.locator(`#clue-layer .clue[data-story="${slug}"]`)
}

async function anchorState(page: Page, progress?: number): Promise<AnchorState> {
  return page.evaluate(async (nextProgress) => {
    const viewport = document.querySelector<HTMLElement>("#pan-viewport")
    const canvas = document.querySelector<HTMLCanvasElement>("#stage canvas")
    const clues = [...document.querySelectorAll<HTMLElement>("#clue-layer .clue")]
    if (!viewport || !canvas || clues.length === 0) {
      throw new Error("La escena móvil no está lista")
    }

    const hotspotResponse = await fetch(
      "/lab/te-cuento-una-historia/data/hotspots.json",
    )
    const hotspots = await hotspotResponse.json() as {
      master: { width: number; height: number }
      entries: Array<{
        slug: string
        x: number
        y: number
      }>
    }
    const bySlug = new Map(hotspots.entries.map((entry) => [entry.slug, entry]))
    const maximum = viewport.scrollWidth - viewport.clientWidth
    if (typeof nextProgress === "number") {
      viewport.scrollLeft = maximum * nextProgress
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const canvasRect = canvas.getBoundingClientRect()
    return {
      maximum,
      progress: maximum > 0 ? viewport.scrollLeft / maximum : 0.5,
      anchors: clues.map((clue) => {
        const hotspot = bySlug.get(clue.dataset.story ?? "")
        if (!hotspot) throw new Error(`Hotspot desconocido: ${clue.dataset.story}`)
        const rect = clue.getBoundingClientRect()
        const expectedX = canvasRect.left
          + (hotspot.x / hotspots.master.width) * canvasRect.width
        const expectedY = canvasRect.top
          + (hotspot.y / hotspots.master.height) * canvasRect.height
        return {
          slug: hotspot.slug,
          errorX: rect.left + rect.width / 2 - expectedX,
          errorY: rect.top + rect.height / 2 - expectedY,
          width: rect.width,
          height: rect.height,
        }
      }),
    }
  }, progress)
}

function expectAnchored(state: AnchorState) {
  for (const anchor of state.anchors) {
    expect(Math.abs(anchor.errorX), `${anchor.slug} x`).toBeLessThan(0.75)
    expect(Math.abs(anchor.errorY), `${anchor.slug} y`).toBeLessThan(0.75)
    expect(anchor.width, `${anchor.slug} width`).toBeGreaterThanOrEqual(44)
    expect(anchor.height, `${anchor.slug} height`).toBeGreaterThanOrEqual(44)
  }
}

test("keeps lights, labels, and hit targets registered through mobile pan and orientation", async ({ page }) => {
  await waitForOpenBook(page)

  const initialSizes = new Map<string, [number, number]>()
  for (const progress of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
    const state = await anchorState(page, progress)
    expect(state.maximum).toBeGreaterThan(0)
    expectAnchored(state)
    for (const anchor of state.anchors) {
      const initial = initialSizes.get(anchor.slug)
      if (initial) {
        expect(Math.abs(anchor.width - initial[0])).toBeLessThan(0.1)
        expect(Math.abs(anchor.height - initial[1])).toBeLessThan(0.1)
      } else {
        initialSizes.set(anchor.slug, [anchor.width, anchor.height])
      }
    }
  }

  await anchorState(page, 0.31)
  await page.setViewportSize({ width: 430, height: 932 })
  await page.waitForTimeout(100)
  const resizedPortrait = await anchorState(page)
  expect(resizedPortrait.progress).toBeCloseTo(0.31, 1)
  expectAnchored(resizedPortrait)

  await page.setViewportSize({ width: 852, height: 393 })
  await page.waitForTimeout(100)
  const landscape = await anchorState(page)
  expect(landscape.maximum).toBe(0)
  expect(landscape.progress).toBe(0.5)
  expectAnchored(landscape)

  await page.setViewportSize({ width: 393, height: 852 })
  await page.waitForTimeout(100)
  const portrait = await anchorState(page)
  expect(portrait.progress).toBeCloseTo(0.5, 1)
  expectAnchored(portrait)
})

for (const progress of [0, 0.5, 1]) {
  test(`opens a correctly labelled story target at pan ${progress}`, async ({ page }) => {
    await waitForOpenBook(page)
    const clue = await nearestVisibleClue(page, progress)
    const label = clue.locator("span")
    const accessibleLabel = await clue.getAttribute("aria-label") ?? ""
    await expect(label).toHaveText(accessibleLabel)

    await clue.click()
    await expect(page.locator("#reader")).toHaveClass(/is-open/u)
    await expect(page.locator("#reader-title")).toHaveText(accessibleLabel)
  })
}
