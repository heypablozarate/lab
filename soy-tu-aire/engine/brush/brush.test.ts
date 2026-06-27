import { describe, expect, it } from "vitest"

import { computeBrushStroke } from "./brush"

describe("computeBrushStroke", () => {
  it("makes fast strokes thinner than pooled slow strokes", () => {
    const slow = computeBrushStroke(120, { pressure: 0.75, climax: 0 })
    const fast = computeBrushStroke(2100, { pressure: 0.75, climax: 0 })

    expect(slow.size).toBeGreaterThan(fast.size * 2.2)
    expect(slow.alpha).toBeGreaterThan(fast.alpha)
  })

  it("still swells during the climax without returning to the old constant brush", () => {
    const calm = computeBrushStroke(760, { pressure: 0.55, climax: 0 })
    const climax = computeBrushStroke(760, { pressure: 0.55, climax: 1 })

    expect(climax.size).toBeGreaterThan(calm.size)
  })

  it("lets the outro taper to no paint", () => {
    const painting = computeBrushStroke(180, { pressure: 1, climax: 0, ink: 1 })
    const dry = computeBrushStroke(180, { pressure: 1, climax: 0, ink: 0 })

    expect(painting.size).toBeGreaterThan(0)
    expect(dry.size).toBe(0)
    expect(dry.alpha).toBe(0)
  })
})
