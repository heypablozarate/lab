// screen-to-paper.test.ts
import { describe, expect, it } from "vitest"
import { screenToPaper } from "./screen-to-paper"

const view = { x: 1000, y: 500, w: 800, h: 400 }

describe("screenToPaper", () => {
  it("esquina sup-izq del canvas → origen del view", () => {
    const p = screenToPaper(0, 0, 400, 200, view)
    expect(p.x).toBeCloseTo(1000)
    expect(p.y).toBeCloseTo(500)
  })
  it("centro del canvas → centro del view", () => {
    const p = screenToPaper(200, 100, 400, 200, view)
    expect(p.x).toBeCloseTo(1400)
    expect(p.y).toBeCloseTo(700)
  })
  it("esquina inf-der → fin del view", () => {
    const p = screenToPaper(400, 200, 400, 200, view)
    expect(p.x).toBeCloseTo(1800)
    expect(p.y).toBeCloseTo(900)
  })
})
