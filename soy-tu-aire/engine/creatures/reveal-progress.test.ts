import { describe, expect, it } from "vitest"

import {
  brushDrawRevealDuration,
  creatureEntranceScale,
  creatureExpiresAtLife,
  creatureScaleMultiplier,
  revealProgress,
} from "./creatures"

describe("revealProgress", () => {
  it("draws left-to-right over most of the sprite life entrance", () => {
    expect(revealProgress("drawLeftToRight", 0, 4)).toBe(0)
    expect(revealProgress("drawLeftToRight", 0.21, 4)).toBeCloseTo(0.5)
    expect(revealProgress("drawLeftToRight", 0.42, 4)).toBe(1)
  })

  it("draws brush-drawn lips from the corner without a scale pop", () => {
    expect(revealProgress("brushDraw", 0, 5.2)).toBe(0)
    expect(revealProgress("brushDraw", 0.475, 5.2)).toBeCloseTo(0.5)
    expect(revealProgress("brushDraw", 0.95, 5.2)).toBe(1)
    expect(revealProgress("brushDraw", 0.18, 5.2, 0.36)).toBeCloseTo(0.5)
    expect(creatureEntranceScale("brushDraw", 0)).toBe(1)
    expect(creatureEntranceScale("brushDraw", 0.5)).toBe(1)
  })

  it("derives brush-drawn reveal duration from sprite size when not specified", () => {
    expect(brushDrawRevealDuration(190)).toBeCloseTo(0.352)
    expect(brushDrawRevealDuration(360)).toBeCloseTo(0.667)
    expect(brushDrawRevealDuration(190)).toBeLessThan(brushDrawRevealDuration(360))
  })

  it("keeps stroke-embedded linear marks full-size inside a stroke mask", () => {
    expect(revealProgress("strokeEmbedded", 0, 2.8)).toBe(0)
    expect(revealProgress("strokeEmbedded", 0.31, 2.8)).toBeCloseTo(0.5)
    expect(revealProgress("strokeEmbedded", 0.62, 2.8)).toBe(1)
    expect(creatureEntranceScale("strokeEmbedded", 0)).toBe(1)
  })

  it("radial bursts hit full coverage quickly", () => {
    expect(revealProgress("radialBurst", 0.16, 3.2)).toBeGreaterThan(0.5)
    expect(revealProgress("radialBurst", 0.23, 3.2)).toBe(1)
    expect(creatureScaleMultiplier("radialBurst", 0, 3.2)).toBeCloseTo(0.96)
  })

  it("pops ink-impact creatures almost immediately", () => {
    expect(revealProgress("inkPop", 0, 4)).toBe(0)
    expect(revealProgress("inkPop", 0.12, 4)).toBe(1)
    expect(creatureScaleMultiplier("inkPop", 0, 4)).toBeCloseTo(0.58)
    expect(creatureScaleMultiplier("inkPop", 0.22, 4)).toBeCloseTo(1)
  })

  it("grows stroke-born marks from a circular mask at full opacity", () => {
    expect(revealProgress("strokeBorn", 0, 1.5)).toBe(0)
    expect(revealProgress("strokeBorn", 0.11, 1.5)).toBeCloseTo(0.5)
    expect(revealProgress("strokeBorn", 0.22, 1.5)).toBe(1)
    expect(creatureScaleMultiplier("strokeBorn", 0, 1.5)).toBeCloseTo(0.22)
    expect(creatureScaleMultiplier("strokeBorn", 0.18, 1.5)).toBeGreaterThan(0.95)
  })

  it("starts the portal figure small and grows it past the camera", () => {
    // Born small inside the trace…
    expect(creatureScaleMultiplier("portalTakeover", 0, 1.55)).toBeCloseTo(0.08)
    // …growing monotonically as the camera dives in…
    const early = creatureScaleMultiplier("portalTakeover", 0.46, 1.55)
    const mid = creatureScaleMultiplier("portalTakeover", 1.15, 1.55)
    const end = creatureScaleMultiplier("portalTakeover", 1.55, 1.55)
    expect(early).toBeGreaterThan(0.08)
    expect(mid).toBeGreaterThan(early)
    expect(end).toBeGreaterThan(mid)
    // …and ending well PAST the viewport so only the transparent centre remains.
    expect(end).toBeGreaterThan(3)
  })

  it("only expires intentional blink marks by time", () => {
    expect(creatureExpiresAtLife("portalTakeover", 920, 1.7, true)).toBe(true)
    expect(creatureExpiresAtLife("inkPop", 150, 0.66)).toBe(true)
    expect(creatureExpiresAtLife("radialBurst", 360, 3.6)).toBe(false)
    expect(creatureExpiresAtLife("strokeBorn", 150, 1.35)).toBe(false)
  })
})
