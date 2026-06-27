import { describe, expect, it } from "vitest"

import { dryBristleLaneCount } from "./ink-surface"

describe("dryBristleLaneCount", () => {
  it("adds more split lanes when the brush is dry and fast", () => {
    expect(dryBristleLaneCount({ dryness: 0.9, bristleSplit: 0.8 })).toBe(5)
    expect(dryBristleLaneCount({ dryness: 0.2, bristleSplit: 0.1 })).toBe(1)
  })
})
