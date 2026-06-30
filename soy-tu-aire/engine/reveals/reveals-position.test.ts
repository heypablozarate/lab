import { describe, expect, it } from "vitest"

import {
  WORD_REVEAL_LEADING_OFFSET,
  WORD_TARGET_LONG_SIDE,
  hasRevealTexture,
  positionRevealOnStroke,
  wordWriteSecondsForLongSide,
} from "./reveals"

describe("positionRevealOnStroke", () => {
  it("places white words on the stroke axis instead of above or below it", () => {
    const pos = positionRevealOnStroke(
      { x: 100, y: 50, tangent: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, width: 24, alpha: 1 },
      { along: 0, normal: 0 },
    )

    expect(pos).toEqual({ x: 100, y: 50, rotation: 0 })
  })

  it("can place the word center so the leading edge starts at the brush tip", () => {
    const pos = positionRevealOnStroke(
      { x: 100, y: 50, tangent: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, width: 24, alpha: 1 },
      { along: WORD_REVEAL_LEADING_OFFSET, normal: 0 },
    )

    expect(pos).toEqual({ x: 100 + WORD_TARGET_LONG_SIDE / 2, y: 50, rotation: 0 })
  })
})

describe("wordWriteSecondsForLongSide", () => {
  it("derives writing time from word size instead of a fixed slow fade", () => {
    expect(wordWriteSecondsForLongSide(180)).toBeCloseTo(0.321)
    expect(wordWriteSecondsForLongSide(360)).toBeCloseTo(0.643)
  })
})

describe("hasRevealTexture", () => {
  it("only loads reveal PNGs that exist in the public asset set", () => {
    expect(hasRevealTexture("cuelo")).toBe(true)
    expect(hasRevealTexture("aire")).toBe(false)
    expect(hasRevealTexture("pequenitos")).toBe(false)
  })
})
