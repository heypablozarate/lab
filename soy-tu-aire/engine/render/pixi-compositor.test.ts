import { describe, expect, it } from "vitest"

import { computeLightingState } from "./pixi-compositor"

describe("computeLightingState", () => {
  it("keeps flicker positions stable inside a short temporal bucket", () => {
    const a = computeLightingState(0.35, 38.52)
    const b = computeLightingState(0.35, 38.61)

    expect(a.sparkX).toBe(b.sparkX)
    expect(a.sparkY).toBe(b.sparkY)
    expect(a.sparkRadius).toBe(b.sparkRadius)
  })

  it("raises the paper glow as the cascabeles band grows", () => {
    const low = computeLightingState(0, 63)
    const high = computeLightingState(1, 63)

    expect(high.primaryGlow).toBeGreaterThan(low.primaryGlow)
    expect(high.secondaryGlow).toBeGreaterThan(low.secondaryGlow)
    expect(low.vignetteAlpha).toBeGreaterThan(0.03)
  })
})
