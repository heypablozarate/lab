import { describe, expect, it } from "vitest"

import { backingDimensions } from "./sizing"

describe("wordmark backing dimensions", () => {
  it.each([
    [1, [320, 180]],
    [2, [640, 360]],
    [3, [640, 360]],
  ] as const)("uses capped DPR %s", (dpr, expected) => {
    expect(backingDimensions(320, 180, dpr)).toEqual(expected)
  })

  it("keeps transient and invalid layout measurements finite", () => {
    expect(backingDimensions(0, 0, 2)).toEqual([1, 1])
    expect(backingDimensions(Number.NaN, Number.POSITIVE_INFINITY, 3)).toEqual([
      1, 1,
    ])
  })
})
