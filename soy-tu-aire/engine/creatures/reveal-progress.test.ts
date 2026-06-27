import { describe, expect, it } from "vitest"

import { creatureAlpha, creatureScaleMultiplier, revealProgress } from "./creatures"

describe("revealProgress", () => {
  it("draws left-to-right over most of the sprite life entrance", () => {
    expect(revealProgress("drawLeftToRight", 0, 4)).toBe(0)
    expect(revealProgress("drawLeftToRight", 0.21, 4)).toBeCloseTo(0.5)
    expect(revealProgress("drawLeftToRight", 0.42, 4)).toBe(1)
  })

  it("radial bursts hit full coverage quickly", () => {
    expect(revealProgress("radialBurst", 0.16, 3.2)).toBeGreaterThan(0.5)
    expect(revealProgress("radialBurst", 0.23, 3.2)).toBe(1)
  })

  it("pops ink-impact creatures almost immediately", () => {
    expect(creatureAlpha("inkPop", 0, 4)).toBe(0)
    expect(creatureAlpha("inkPop", 0.08, 4)).toBe(1)
    expect(creatureScaleMultiplier("inkPop", 0, 4)).toBeCloseTo(0.58)
    expect(creatureScaleMultiplier("inkPop", 0.22, 4)).toBeCloseTo(1)
  })

  it("keeps hard-cut flocks visible before a late fade", () => {
    expect(creatureAlpha("hardCut", 0, 4)).toBe(1)
    expect(creatureAlpha("hardCut", 3, 4)).toBe(1)
    expect(creatureAlpha("hardCut", 4, 4)).toBe(0)
  })
})
