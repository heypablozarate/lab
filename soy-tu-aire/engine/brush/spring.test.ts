import { describe, expect, it } from "vitest"
import { springStep } from "./spring"

describe("springStep", () => {
  it("acerca pos hacia target con el tiempo", () => {
    const pos = { x: 0, y: 0 }; const vel = { x: 0, y: 0 }
    for (let i = 0; i < 240; i++) springStep(pos, vel, { x: 10, y: 0 }, 120, 18, 1 / 60)
    expect(pos.x).toBeCloseTo(10, 1)
    expect(pos.y).toBeCloseTo(0, 1)
  })
  it("es estable (no explota) con dt grande", () => {
    const pos = { x: 0, y: 0 }; const vel = { x: 0, y: 0 }
    springStep(pos, vel, { x: 100, y: 100 }, 120, 18, 0.5)
    expect(Number.isFinite(pos.x)).toBe(true)
  })
})
