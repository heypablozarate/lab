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
      at: 1.8,
      count: 1,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "inkPop",
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
      reveal: "inkPop",
      targetLongSide: 430,
      life: 4.5,
    })
  })

  it("captures birds as a staggered flock carried by the camera", () => {
    const birds = getEventDirective("pajaros", 20.5)?.creatures?.pajaros?.[0]

    expect(birds).toMatchObject({
      at: 0,
      count: 7,
      stagger: 0.055,
      layer: "foreground",
      attachment: "recentStroke",
      reveal: "hardCut",
      targetLongSide: 118,
      life: 4.4,
    })
    expect(birds?.drift).toEqual({ x: -72, y: -18 })
    expect(birds?.frameOffset).toBe(0.34)
  })

  it("captures climax fish as scattered small clusters", () => {
    const fish = getEventDirective("pececillo-climax")?.creatures?.pececillo?.[0]

    expect(fish).toMatchObject({
      at: 0,
      count: 5,
      stagger: 0.075,
      layer: "foreground",
      attachment: "recentStroke",
      reveal: "hardCut",
      targetLongSide: 105,
      life: 5.5,
    })
    expect(fish?.scatter).toEqual({ x: 210, y: 92 })
    expect(fish?.drift).toEqual({ x: -82, y: 16 })
    expect(fish?.scaleJitter).toBe(0.48)
  })

  it("directs cosquilla as a fast repeated cluster", () => {
    const burst = getEventDirective("cosquilla")?.creatures?.cosquilla?.[0]

    expect(burst).toMatchObject({
      at: 0,
      count: 1,
      layer: "insideInk",
      attachment: "recentStroke",
      reveal: "inkPop",
      targetLongSide: 245,
      life: 2.4,
    })
    expect(burst?.scatter).toEqual({ x: 42, y: 14 })
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
      count: 7,
      targetLongSide: 92,
      layer: "foreground",
      attachment: "recentStroke",
      life: 5.2,
    })
    expect(dandelion?.scatter).toEqual({ x: 230, y: 92 })
  })

  it("directs pre-climax dandelion as tiny scratches", () => {
    const dandelion = getEventDirective("dandelion", 133)?.creatures?.dandelion?.[0]

    expect(dandelion).toMatchObject({
      count: 5,
      targetLongSide: 72,
      layer: "insideInk",
      attachment: "recentStroke",
      reveal: "hardCut",
      life: 2.8,
    })
  })

  it("directs butterfly events as delayed small clusters", () => {
    const mariposa = getEventDirective("mariposa", 124.8)?.creatures?.mariposa?.[0]
    const noLoop = getEventDirective("mariposanoloop", 178.2)?.creatures?.mariposanoloop?.[0]

    expect(mariposa).toMatchObject({
      at: 1.52,
      count: 5,
      targetLongSide: 96,
      attachment: "brushHead",
      frameOffset: 0.42,
    })
    expect(noLoop).toMatchObject({
      at: 1.78,
      count: 4,
      targetLongSide: 88,
      attachment: "brushHead",
      frameOffset: 0.38,
    })
  })
})

describe("getEventDirective", () => {
  it("returns direct and grouped directives", () => {
    expect(getEventDirective("labios")?.key).toBe("labios")
    expect(getEventDirective("pececillo", 198)?.key).toBe("pececillo-climax")
    expect(getEventDirective("pececillo", 24.5)?.key).toBe("pececillo-intro")
  })
})
