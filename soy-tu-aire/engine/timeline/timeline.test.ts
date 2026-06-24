// timeline.test.ts
import { describe, expect, it } from "vitest"
import { Timeline } from "./timeline"
import type { ChoreoEvent } from "./choreography"

const ev = (t: number, presion: number, climax = 0, reveals: string[] = []): ChoreoEvent => ({
  t, velocidad: 1, presion, climax, reveals, creatures: [],
})

describe("Timeline.query", () => {
  const tl = new Timeline([ev(0, 0.2), ev(10, 1.0)])
  it("interpola presión entre eventos", () => {
    expect(tl.query(5).presion).toBeCloseTo(0.6, 1)
  })
  it("antes del primer evento usa el primero", () => {
    expect(tl.query(-1).presion).toBeCloseTo(0.2)
  })
  it("después del último usa el último", () => {
    expect(tl.query(99).presion).toBeCloseTo(1.0)
  })
})

describe("Timeline.fired", () => {
  const tl = new Timeline([ev(0, 0.2), ev(5, 0.5, 0, ["chica"]), ev(8, 0.5, 0, ["pez"])])
  it("devuelve eventos cuyo t cae en (prevT, t]", () => {
    const f = tl.fired(4, 6)
    expect(f.map((e) => e.reveals[0])).toEqual(["chica"])
  })
  it("no repite eventos ya pasados", () => {
    expect(tl.fired(6, 7).length).toBe(0)
  })
})
