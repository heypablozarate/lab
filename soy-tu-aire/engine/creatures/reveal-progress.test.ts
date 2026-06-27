import { describe, expect, it } from "vitest"

import { revealProgress } from "./creatures"

describe("revealProgress", () => {
  it("draws left-to-right over most of the sprite life entrance", () => {
    expect(revealProgress("drawLeftToRight", 0, 4)).toBe(0)
    expect(revealProgress("drawLeftToRight", 0.6, 4)).toBeCloseTo(0.5)
    expect(revealProgress("drawLeftToRight", 1.2, 4)).toBe(1)
  })

  it("radial bursts hit full coverage quickly", () => {
    expect(revealProgress("radialBurst", 0.16, 3.2)).toBeGreaterThan(0.5)
    expect(revealProgress("radialBurst", 0.45, 3.2)).toBe(1)
  })
})
