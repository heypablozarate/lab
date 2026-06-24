// fade.test.ts
import { describe, expect, it } from "vitest"
import { fadeAlpha } from "./fade"
describe("fadeAlpha", () => {
  it("0 al nacer y al morir, 1 en el medio", () => {
    expect(fadeAlpha(0, 3)).toBeCloseTo(0, 1)
    expect(fadeAlpha(1.5, 3)).toBeCloseTo(1, 1)
    expect(fadeAlpha(3, 3)).toBeCloseTo(0, 1)
  })
  it("fuera de rango → 0", () => {
    expect(fadeAlpha(-1, 3)).toBe(0)
    expect(fadeAlpha(4, 3)).toBe(0)
  })
})
