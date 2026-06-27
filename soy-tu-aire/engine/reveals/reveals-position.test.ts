import { describe, expect, it } from "vitest"

import { positionRevealOnStroke } from "./reveals"

describe("positionRevealOnStroke", () => {
  it("places white words along the stroke normal instead of free paper", () => {
    const pos = positionRevealOnStroke(
      { x: 100, y: 50, tangent: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, width: 24, alpha: 1 },
      { along: 0, normal: -0.18 },
    )

    expect(pos).toEqual({ x: 100, y: 45.68, rotation: 0 })
  })
})
