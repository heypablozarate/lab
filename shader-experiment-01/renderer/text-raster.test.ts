import { describe, expect, it } from "vitest"

import {
  rasterizeWordmark,
  type TextRasterContext,
} from "./text-raster"

type DrawCall = Readonly<{
  text: string
  x: number
  y: number
  maxWidth?: number
}>

function fakeContext() {
  const draws: DrawCall[] = []
  let font = "700 1px sans-serif"
  const context: TextRasterContext = {
    get font() {
      return font
    },
    set font(value) {
      font = value
    },
    fillStyle: "#000",
    textAlign: "start",
    textBaseline: "alphabetic",
    letterSpacing: "0px",
    clearRect() {},
    fillText(text, x, y, maxWidth) {
      draws.push({ text, x, y, maxWidth })
    },
    measureText(text) {
      const size = Number.parseFloat(font.match(/([\d.]+)px/)?.[1] ?? "1")
      return { width: Array.from(text).length * size * 0.6 }
    },
  }
  return { context, draws }
}

const draw = (text: string, width = 1200, height = 500) => {
  const fake = fakeContext()
  const metrics = rasterizeWordmark({
    context: fake.context,
    width,
    height,
    text,
    fontFamily: "Test Sans",
    wordColor: "rgb(240, 240, 240)",
    trademarkColor: "rgb(255, 80, 30)",
  })
  return { ...fake, metrics }
}

describe("wordmark text raster", () => {
  it("keeps the default composition fitted to roughly 84 percent width", () => {
    const { metrics, draws } = draw("PabloZarate™")

    expect(metrics.drawnWidth).toBeGreaterThan(1200 * 0.84 * 0.99)
    expect(metrics.drawnWidth).toBeLessThanOrEqual(1200 * 0.84)
    expect(draws.map((call) => call.text)).toEqual(["PabloZarate", "™"])
  })

  it("defines empty text without division by zero or drawing stale glyphs", () => {
    const { metrics, draws } = draw("")

    expect(draws).toHaveLength(0)
    expect(metrics.fontSize).toBeGreaterThanOrEqual(1)
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true)
  })

  it("passes Unicode text verbatim to Canvas2D", () => {
    const unicode = "e\u0301 — العربية — 東京 — 👩🏽‍💻"
    const { metrics, draws } = draw(unicode)

    expect(draws).toHaveLength(1)
    expect(draws[0]?.text).toBe(unicode)
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true)
  })

  it("bounds 4096 characters with finite layout and no truncation", () => {
    const extreme = "長".repeat(4096)
    const { metrics, draws } = draw(extreme, 320, 180)

    expect(draws[0]?.text).toBe(extreme)
    expect(draws[0]?.maxWidth).toBeGreaterThan(0)
    expect(Number.isFinite(draws[0]?.maxWidth)).toBe(true)
    expect(metrics.drawnWidth).toBeLessThanOrEqual(320 * 0.84)
    expect(metrics.fontSize).toBeGreaterThanOrEqual(1)
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true)
  })
})
