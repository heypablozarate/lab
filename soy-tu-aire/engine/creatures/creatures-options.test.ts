import { describe, expect, it } from "vitest"

import { brushResumePoint, ensureVisibleLongSide, resolveCreaturePresentation } from "./creatures"

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
