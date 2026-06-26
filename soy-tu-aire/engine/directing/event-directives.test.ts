import { describe, expect, it } from "vitest"

import { EVENT_DIRECTIVES, getEventDirective } from "./event-directives"

describe("EVENT_DIRECTIVES", () => {
  it("captures the delayed full-frame entrando silhouette", () => {
    const directive = getEventDirective("entrando")

    expect(directive?.brushHold).toEqual({ startOffset: 1.85, duration: 0.82, pressure: 0.05 })
    expect(directive?.creatures?.entrando?.[0]).toMatchObject({
      at: 2.12,
      count: 1,
      layer: "screenForeground",
      attachment: "screen",
      reveal: "hardCut",
      targetLongSide: 760,
      life: 0.95,
    })
  })

  it("captures salpico as a delayed burst, not an immediate centered sprite", () => {
    const burst = getEventDirective("salpico")?.creatures?.salpico?.[0]

    expect(burst).toMatchObject({
      at: 1.95,
      count: 1,
      layer: "overInk",
      attachment: "world",
      reveal: "radialBurst",
      targetLongSide: 860,
      life: 3.2,
    })
    expect(burst?.offset).toEqual({ x: -80, y: -24 })
  })

  it("captures labios as a brush pause plus progressive reveal", () => {
    const directive = getEventDirective("labios")

    expect(directive?.brushHold).toEqual({ startOffset: -0.05, duration: 1.25, pressure: 0.08 })
    expect(directive?.creatures?.labios?.[0]).toMatchObject({
      at: 1.85,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "drawLeftToRight",
      targetLongSide: 430,
      life: 4.5,
    })
  })

  it("captures climax fish as scattered small clusters", () => {
    const fish = getEventDirective("pececillo-climax")?.creatures?.pececillo?.[0]

    expect(fish).toMatchObject({
      at: 0,
      count: 5,
      layer: "underInk",
      attachment: "world",
      reveal: "fade",
      targetLongSide: 145,
      life: 5.5,
    })
    expect(fish?.scatter).toEqual({ x: 220, y: 86 })
    expect(fish?.scaleJitter).toBe(0.42)
  })
})

describe("getEventDirective", () => {
  it("returns direct and grouped directives", () => {
    expect(getEventDirective("labios")?.key).toBe("labios")
    expect(getEventDirective("pececillo", 198)?.key).toBe("pececillo-climax")
    expect(getEventDirective("pececillo", 24.5)?.key).toBe("pececillo-intro")
  })
})
