import { describe, expect, it } from "vitest"

import { pointAtDistanceFromEnd } from "./stroke-history"
import type { RibbonSample } from "../types"

const samples: RibbonSample[] = [
  { x: 0, y: 0, width: 10, alpha: 1 },
  { x: 100, y: 0, width: 12, alpha: 1 },
  { x: 200, y: 0, width: 14, alpha: 1 },
]

describe("pointAtDistanceFromEnd", () => {
  it("returns a point inside the recent stroke", () => {
    const point = pointAtDistanceFromEnd(samples, 50)

    expect(point).toEqual({
      x: 150,
      y: 0,
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      width: 13,
      alpha: 1,
    })
  })

  it("clamps to the oldest point when the requested distance is too long", () => {
    const point = pointAtDistanceFromEnd(samples, 500)

    expect(point?.x).toBe(0)
    expect(point?.y).toBe(0)
  })
})
