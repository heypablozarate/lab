import { describe, expect, it } from "vitest"

import { buildRibbonGeometry } from "./ribbon"
import type { RibbonSample } from "../types"

function sample(x: number, y: number, width = 10, alpha = 1): RibbonSample {
  return { x, y, width, alpha }
}

describe("buildRibbonGeometry", () => {
  it("builds a two-sided strip for a straight horizontal centerline", () => {
    const geometry = buildRibbonGeometry([
      sample(0, 0, 10, 1),
      sample(10, 0, 10, 0.5),
    ], { taperSamples: 0 })

    expect(Array.from(geometry.positions)).toEqual([
      0, 5,
      0, -5,
      10, 5,
      10, -5,
    ])
    expect(Array.from(geometry.uvs)).toEqual([
      0, 0,
      0, 1,
      1, 0,
      1, 1,
    ])
    expect(Array.from(geometry.alphas)).toEqual([1, 1, 0.5, 0.5])
    expect(Array.from(geometry.indices)).toEqual([0, 1, 2, 1, 3, 2])
  })

  it("tapers endpoints to a point by default", () => {
    const geometry = buildRibbonGeometry([
      sample(0, 0, 12),
      sample(10, 0, 12),
      sample(20, 0, 12),
    ])

    expect(geometry.positions[0]).toBeCloseTo(0)
    expect(geometry.positions[1]).toBeCloseTo(0)
    expect(geometry.positions[2]).toBeCloseTo(0)
    expect(geometry.positions[3]).toBeCloseTo(0)
    expect(geometry.positions[4]).toBeCloseTo(10)
    expect(geometry.positions[5]).toBeGreaterThan(0)
    expect(geometry.positions[6]).toBeCloseTo(10)
    expect(geometry.positions[7]).toBeLessThan(0)
    expect(geometry.positions[8]).toBeCloseTo(20)
    expect(geometry.positions[9]).toBeCloseTo(0)
    expect(geometry.positions[10]).toBeCloseTo(20)
    expect(geometry.positions[11]).toBeCloseTo(0)
  })

  it("returns finite geometry when adjacent samples repeat", () => {
    const geometry = buildRibbonGeometry([
      sample(0, 0, 8),
      sample(0, 0, 8),
      sample(10, 0, 8),
    ], { taperSamples: 0 })

    for (const value of geometry.positions) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it("returns empty buffers for fewer than two samples", () => {
    const geometry = buildRibbonGeometry([sample(0, 0)])

    expect(geometry.positions.length).toBe(0)
    expect(geometry.uvs.length).toBe(0)
    expect(geometry.alphas.length).toBe(0)
    expect(geometry.indices.length).toBe(0)
  })
})
