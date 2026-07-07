import { describe, expect, it } from "vitest"

import {
  WORD_REVEAL_LEADING_OFFSET,
  WORD_TARGET_LONG_SIDE,
  hasRevealTexture,
  positionRevealOnStroke,
  wordResumePoint,
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

describe("wordResumePoint", () => {
  it("resumes the stroke just inside the word's trailing edge along the trace", () => {
    const resume = wordResumePoint({ x: 100, y: 50 }, 0, 360)

    // Half the word is 180; the small inset (10.8) lands the pen on the word's
    // trailing calligraphic tail so the resumed line grows out of it.
    expect(resume).toEqual({ x: 100 + 180 - 10.8, y: 50 })
  })

  it("follows the stroke rotation instead of screen-horizontal", () => {
    const resume = wordResumePoint({ x: 0, y: 0 }, Math.PI / 2, 360)

    expect(resume.x).toBeCloseTo(0)
    expect(resume.y).toBeCloseTo(169.2)
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
