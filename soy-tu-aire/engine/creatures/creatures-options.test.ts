import { describe, expect, it } from "vitest"

import {
  anchoredBrushDrawPlacement,
  BRUSH_DRAW_ANCHORS,
  brushResumePoint,
  ensureVisibleLongSide,
  resolveCreaturePresentation,
  scanVisibleAlphaBounds,
} from "./creatures"

describe("resolveCreaturePresentation", () => {
  it("uses directed target size, life, and offset", () => {
    const result = resolveCreaturePresentation("salpico", {
      targetLongSide: 860,
      life: 3.2,
      offset: { x: -80, y: -24 },
    })

    expect(result).toEqual({
      targetLongSide: 860,
      life: 3.2,
      offset: { x: -80, y: -24 },
    })
  })

  it("keeps existing named defaults when no directive is passed", () => {
    const result = resolveCreaturePresentation("labios")

    expect(result.targetLongSide).toBe(360)
    expect(result.life).toBe(4)
    expect(result.offset).toEqual({ x: 0, y: 0 })
  })
})

describe("ensureVisibleLongSide", () => {
  it("lifts tiny paper-space marks to a readable on-screen floor", () => {
    // 48 paper px at a wide-shot 0.6 world scale is ~29 screen px — invisible.
    // The floor lifts it so it lands at 64 screen px (64 / 0.6 ≈ 107 paper px).
    expect(ensureVisibleLongSide(48, 0.6)).toBe(107)
  })

  it("leaves already-readable sizes untouched", () => {
    expect(ensureVisibleLongSide(360, 0.6)).toBe(360)
    expect(ensureVisibleLongSide(96, 1)).toBe(96)
  })

  it("falls back to paper-space sizing when the world scale is degenerate", () => {
    expect(ensureVisibleLongSide(48, 0)).toBe(64)
  })
})

describe("brushResumePoint", () => {
  it("resumes just inside the trailing edge of the drawn image", () => {
    const resume = brushResumePoint({ x: 100, y: 50 }, 300)

    // Half width is 150; the 8%-of-width inset (24) pulls the pen slightly
    // inside the art so the resumed line overlaps it instead of leaving a gap.
    expect(resume).toEqual({ x: 100 + 150 - 24, y: 50 })
  })

  it("clamps the inset so small images keep a visible overlap", () => {
    expect(brushResumePoint({ x: 0, y: 0 }, 60)).toEqual({ x: 22, y: 0 })
  })
})

describe("scanVisibleAlphaBounds", () => {
  // Build a flat RGBA buffer (row-major, top-left origin) from a grid of
  // per-pixel alpha values, matching ImageData's byte layout.
  function bufferFrom(alphaRows: number[][]): { data: Uint8ClampedArray; width: number; height: number } {
    const height = alphaRows.length
    const width = alphaRows[0]?.length ?? 0
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        data[(y * width + x) * 4 + 3] = alphaRows[y][x]
      }
    }
    return { data, width, height }
  }

  it("finds the tight bounding box of the opaque pixels", () => {
    const { data, width, height } = bufferFrom([
      [0, 0, 0, 0, 0],
      [0, 0, 255, 0, 0],
      [0, 255, 255, 255, 0],
      [0, 0, 255, 0, 0],
      [0, 0, 0, 0, 0],
    ])

    expect(scanVisibleAlphaBounds(data, width, height)).toEqual({ x: 1, y: 1, width: 3, height: 3 })
  })

  it("ignores pixels at or below the alpha threshold", () => {
    const { data, width, height } = bufferFrom([
      [0, 16, 0],
      [0, 17, 0],
      [0, 0, 0],
    ])

    // The alpha:16 pixel sits exactly at the default threshold and does not
    // count; only the alpha:17 pixel (row 1) is visible.
    expect(scanVisibleAlphaBounds(data, width, height)).toEqual({ x: 1, y: 1, width: 1, height: 1 })
  })

  it("respects a custom threshold", () => {
    const { data, width, height } = bufferFrom([
      [0, 0, 0],
      [0, 40, 0],
      [0, 0, 0],
    ])

    expect(scanVisibleAlphaBounds(data, width, height, 50)).toEqual({ x: 0, y: 0, width: 3, height: 3 })
  })

  it("falls back to the full frame for a fully transparent buffer", () => {
    const { data, width, height } = bufferFrom([
      [0, 0],
      [0, 0],
    ])

    expect(scanVisibleAlphaBounds(data, width, height)).toEqual({ x: 0, y: 0, width: 2, height: 2 })
  })

  it("finds an off-centre box, matching a padded canvas like the creature PNGs", () => {
    const { data, width, height } = bufferFrom([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 255, 255, 255],
      [0, 0, 0, 255, 255, 255],
    ])

    expect(scanVisibleAlphaBounds(data, width, height)).toEqual({ x: 3, y: 2, width: 3, height: 2 })
  })
})

describe("anchored hardCut placement (salpico, cera)", () => {
  it("registers connection anchors for the hardCut blots that fuse with the trace", () => {
    expect(BRUSH_DRAW_ANCHORS.salpico).toEqual({ entry: { x: 159, y: 682 }, exit: { x: 1164, y: 654 } })
    expect(BRUSH_DRAW_ANCHORS.cera).toEqual({ entry: { x: 60, y: 235 }, exit: { x: 483, y: 240 } })
  })

  it("places salpico's entry smudge on the stroke tip and hands back the exit as a resume point", () => {
    const { origin, resume } = anchoredBrushDrawPlacement(
      { x: 400, y: 300 },
      BRUSH_DRAW_ANCHORS.salpico,
      1366,
      1349,
      0.5,
    )

    expect(origin.x).toBeCloseTo(648, 5)
    expect(origin.y).toBeCloseTo(296.25, 5)
    expect(resume.x).toBeCloseTo(874.5, 5)
    expect(resume.y).toBeCloseTo(286, 5)
  })

  it("places cera's entry smudge on the stroke tip and hands back the exit as a resume point", () => {
    const { origin, resume } = anchoredBrushDrawPlacement(
      { x: 0, y: 0 },
      BRUSH_DRAW_ANCHORS.cera,
      521,
      1189,
      1,
    )

    expect(origin).toEqual({ x: 186.5, y: 359.5 })
    expect(resume).toEqual({ x: 395, y: 5 })
  })
})
