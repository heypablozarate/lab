import { describe, expect, it } from "vitest"
import { springStep, emitDabs } from "./spring"

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

describe("emitDabs", () => {
  it("espacia los dabs y termina en 'to'", () => {
    const dabs = emitDabs({ x: 0, y: 0 }, { x: 10, y: 0 }, 2)
    expect(dabs.length).toBe(5) // 2,4,6,8,10
    expect(dabs[dabs.length - 1].x).toBeCloseTo(10)
  })
  it("distancia menor que spacing → al menos el punto final", () => {
    const dabs = emitDabs({ x: 0, y: 0 }, { x: 1, y: 0 }, 4)
    expect(dabs.length).toBe(1)
    expect(dabs[0].x).toBeCloseTo(1)
  })
})
