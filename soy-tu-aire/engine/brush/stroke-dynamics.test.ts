import { describe, expect, it } from "vitest"

import { computeStrokeDynamics } from "./stroke-dynamics"

describe("computeStrokeDynamics", () => {
  it("creates thin dry threads for fast strokes", () => {
    const stroke = computeStrokeDynamics({
      speed: 2200,
      previousSpeed: 1800,
      curvature: 0.05,
      pressure: 0.6,
      climax: 0,
      ink: 1,
      hold: false,
    })

    expect(stroke.width).toBeLessThan(12)
    expect(stroke.dryness).toBeGreaterThan(0.55)
    expect(stroke.bristleSplit).toBeGreaterThan(0.45)
  })

  it("creates pooled wet heads during brush holds", () => {
    const stroke = computeStrokeDynamics({
      speed: 40,
      previousSpeed: 260,
      curvature: 0.6,
      pressure: 0.8,
      climax: 0,
      ink: 1,
      hold: true,
    })

    expect(stroke.width).toBeGreaterThan(34)
    expect(stroke.alpha).toBeGreaterThan(0.85)
    expect(stroke.headPool).toBeGreaterThan(0.7)
    expect(stroke.dryness).toBeLessThan(0.25)
  })

  it("dries to a broken tail when ink runs out", () => {
    const stroke = computeStrokeDynamics({
      speed: 680,
      previousSpeed: 720,
      curvature: 0.15,
      pressure: 1,
      climax: 0,
      ink: 0.18,
      hold: false,
    })

    expect(stroke.width).toBeLessThan(7)
    expect(stroke.alpha).toBeLessThan(0.25)
    expect(stroke.dryness).toBeGreaterThan(0.75)
  })
})
