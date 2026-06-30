import { describe, expect, it } from "vitest"

import { drawWriteMask } from "./reveals"

function makeMask() {
  const polys: number[][] = []
  let clears = 0
  const mask = {
    clear() {
      clears += 1
      return mask
    },
    poly(points: number[]) {
      polys.push(points)
      return { fill: () => undefined }
    },
  }
  return { mask, polys, clearsCount: () => clears }
}

describe("drawWriteMask", () => {
  it("clears but draws no polygon before the word starts writing", () => {
    const { mask, polys, clearsCount } = makeMask()
    drawWriteMask(mask, 200, 100, 0, 100, 40, 0)
    expect(clearsCount()).toBe(1)
    expect(polys).toHaveLength(0)
  })

  it("reveals only the leading fraction from the left edge (unrotated)", () => {
    const { mask, polys } = makeMask()
    drawWriteMask(mask, 200, 100, 0, 100, 40, 0.5)
    // Half-written: a rect from the left edge (x=150) to the word centre (x=200).
    expect(polys[0]).toEqual([150, 80, 200, 80, 200, 120, 150, 120])
  })

  it("covers the whole word once writing completes", () => {
    const { mask, polys } = makeMask()
    drawWriteMask(mask, 0, 0, 0, 100, 40, 1)
    expect(polys[0]).toEqual([-50, -20, 50, -20, 50, 20, -50, 20])
  })

  it("orients the reveal rectangle along the stroke angle", () => {
    const { mask, polys } = makeMask()
    drawWriteMask(mask, 0, 0, Math.PI / 2, 100, 40, 1)
    // A 90° trace turns the leading (left) edge into the top edge.
    expect(polys[0][0]).toBeCloseTo(20)
    expect(polys[0][1]).toBeCloseTo(-50)
  })
})
