import { describe, expect, it } from "vitest"
import { resizeCanvasToDisplaySize } from "./gl"

describe("resizeCanvasToDisplaySize", () => {
  it("ajusta width/height a clientSize*dpr y reporta cambio", () => {
    const canvas = { clientWidth: 100, clientHeight: 50, width: 0, height: 0 } as HTMLCanvasElement
    const changed = resizeCanvasToDisplaySize(canvas, 2)
    expect(changed).toBe(true)
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(100)
  })

  it("no reporta cambio si ya coincide", () => {
    const canvas = { clientWidth: 100, clientHeight: 50, width: 200, height: 100 } as HTMLCanvasElement
    expect(resizeCanvasToDisplaySize(canvas, 2)).toBe(false)
  })

  it("clampea el dpr al máximo pasado", () => {
    const canvas = { clientWidth: 100, clientHeight: 100, width: 0, height: 0 } as HTMLCanvasElement
    resizeCanvasToDisplaySize(canvas, 3, 2) // dprMax=2
    expect(canvas.width).toBe(200)
  })
})
