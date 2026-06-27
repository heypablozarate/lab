import { describe, expect, it } from "vitest"

import { getEventDirective } from "./event-directives"

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

  it("directs cosquilla as a fast repeated cluster", () => {
    const burst = getEventDirective("cosquilla")?.creatures?.cosquilla?.[0]

    expect(burst).toMatchObject({
      at: 0,
      count: 3,
      layer: "insideInk",
      attachment: "recentStroke",
      reveal: "strokeMask",
      targetLongSide: 210,
      life: 2.4,
    })
    expect(burst?.scatter).toEqual({ x: 120, y: 36 })
  })

  it("directs hole events as tiny low-pressure marks", () => {
    const entrada = getEventDirective("Entradaagujero")?.creatures?.Entradaagujero?.[0]
    const salida = getEventDirective("Salidaagujero")?.creatures?.Salidaagujero?.[0]

    expect(entrada?.targetLongSide).toBe(180)
    expect(salida?.targetLongSide).toBe(160)
    expect(entrada?.layer).toBe("underInk")
    expect(salida?.layer).toBe("underInk")
  })

  it("directs dandelion climax as many small world-space marks", () => {
    const dandelion = getEventDirective("dandelion", 194)?.creatures?.dandelion?.[0]

    expect(dandelion).toMatchObject({
      count: 10,
      targetLongSide: 150,
      layer: "underInk",
      attachment: "world",
      life: 5.2,
    })
    expect(dandelion?.scatter).toEqual({ x: 260, y: 90 })
  })
})

describe("getEventDirective", () => {
  it("returns direct and grouped directives", () => {
    expect(getEventDirective("labios")?.key).toBe("labios")
    expect(getEventDirective("pececillo", 198)?.key).toBe("pececillo-climax")
    expect(getEventDirective("pececillo", 24.5)?.key).toBe("pececillo-intro")
  })
})
