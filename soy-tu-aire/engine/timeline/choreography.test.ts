// choreography.test.ts
import { describe, expect, it } from "vitest"
import choreo from "../../data/choreography.json"
import type { Choreography } from "./choreography"

describe("choreography.json", () => {
  const c = choreo as Choreography
  it("tiene ~185 eventos ordenados por tiempo", () => {
    expect(c.events.length).toBeGreaterThan(150)
    for (let i = 1; i < c.events.length; i++) {
      expect(c.events[i].t).toBeGreaterThanOrEqual(c.events[i - 1].t)
    }
  })
  it("cada evento tiene los campos requeridos", () => {
    for (const e of c.events) {
      expect(typeof e.t).toBe("number")
      expect(typeof e.velocidad).toBe("number")
      expect(typeof e.presion).toBe("number")
      expect(Array.isArray(e.reveals)).toBe(true)
      expect(Array.isArray(e.creatures)).toBe(true)
    }
  })
  it("la duración es coherente con el tema (~3:54)", () => {
    expect(c.duration).toBeGreaterThan(180)
    expect(c.duration).toBeLessThan(260)
  })
})
