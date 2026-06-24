import { describe, expect, it } from "vitest"
import { computeViewRect } from "./compute-view-rect"
import { PAPER_W, PAPER_H } from "../constants"

describe("computeViewRect", () => {
  it("zoom 1 con aspect 2:1 muestra todo el ancho del papel", () => {
    const v = computeViewRect({ x: PAPER_W / 2, y: PAPER_H / 2 }, 1, PAPER_W / PAPER_H, PAPER_W, PAPER_H)
    expect(v.w).toBeCloseTo(PAPER_W)
    expect(v.h).toBeCloseTo(PAPER_H)
  })
  it("zoom 2 muestra la mitad del ancho", () => {
    const v = computeViewRect({ x: PAPER_W / 2, y: PAPER_H / 2 }, 2, PAPER_W / PAPER_H, PAPER_W, PAPER_H)
    expect(v.w).toBeCloseTo(PAPER_W / 2)
  })
  it("clampea para no salirse del papel", () => {
    const v = computeViewRect({ x: 0, y: 0 }, 2, PAPER_W / PAPER_H, PAPER_W, PAPER_H)
    expect(v.x).toBeGreaterThanOrEqual(0)
    expect(v.y).toBeGreaterThanOrEqual(0)
  })
})
