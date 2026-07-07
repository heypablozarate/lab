import { describe, expect, it } from "vitest"

import { getEventDirective } from "./event-directives"

describe("EVENT_DIRECTIVES", () => {
  it("captures chica as a fast brush-drawn trace figure", () => {
    const directive = getEventDirective("chica")

    expect(directive?.brushHold).toEqual({ startOffset: 1.34, duration: 0.58, pressure: 0, paint: false })
    expect(directive?.creatures?.chica?.[0]).toMatchObject({
      at: 1.42,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "brushDraw",
      targetLongSide: 340,
      fixed: true,
      revealDuration: 0.44,
    })
  })

  it("captures the delayed full-frame entrando silhouette", () => {
    const directive = getEventDirective("entrando")

    expect(directive?.brushHold).toEqual({ startOffset: 1.7, duration: 1.55, pressure: 0, paint: false })
    expect(directive?.creatures?.entrando?.[0]).toMatchObject({
      spawnName: "entrando",
      at: 1.52,
      count: 1,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "radialBurst",
      targetLongSide: 360,
      life: 0.72,
    })
    expect(directive?.creatures?.entrando?.[1]).toMatchObject({
      spawnName: "EntradaagujeroPortal",
      at: 1.82,
      count: 1,
      layer: "screenForeground",
      attachment: "screen",
      reveal: "portalTakeover",
      targetLongSide: 920,
      life: 2.8,
    })
  })

  it("captures salpico as a non-painting brush stamp", () => {
    const directive = getEventDirective("salpico")
    const burst = directive?.creatures?.salpico?.[0]

    expect(directive?.brushHold).toEqual({ startOffset: 2.2, duration: 0.36, pressure: 0, paint: false })
    expect(burst).toMatchObject({
      at: 2.2,
      count: 1,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "hardCut",
      targetLongSide: 720,
      life: 3.2,
      fixed: true,
    })
    expect(burst?.offset).toEqual({ x: 0, y: 0 })
  })

  it("anchors ink blot and splash PNGs to the brush tip", () => {
    expect(getEventDirective("salpico")?.creatures?.salpico?.[0].attachment).toBe("brushHead")
    expect(getEventDirective("pezmancha", 24)?.creatures?.pezmancha?.[0].attachment).toBe("brushHead")
    expect(getEventDirective("cera")?.creatures?.cera?.[0].attachment).toBe("brushHead")
    expect(getEventDirective("burbuja")?.creatures?.burbuja?.[0].attachment).toBe("brushHead")
    expect(getEventDirective("Ondasagua")?.creatures?.Ondasagua?.[0].attachment).toBe("brushHead")
    expect(getEventDirective("Entradaagujero")?.creatures?.Entradaagujero?.[0].attachment).toBe("brushHead")
    expect(getEventDirective("Salidaagujero")?.creatures?.Salidaagujero?.[0].attachment).toBe("brushHead")
  })

  it("captures labios as a brush pause plus progressive reveal", () => {
    const directive = getEventDirective("labios")

    expect(directive?.brushHold).toEqual({ startOffset: 1.58, duration: 0.95, pressure: 0, paint: false })
    expect(directive?.creatures?.labios?.[0]).toMatchObject({
      at: 1.72,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "brushDraw",
      targetLongSide: 480,
      life: 5.2,
      fixed: true,
    })
    expect(directive?.creatures?.labios?.[0].offset).toEqual({ x: 0, y: 0 })
    expect(directive?.creatures?.labios?.[0].drift).toEqual({ x: 0, y: 0 })
  })

  it("captures birds as a late stroke-born flock", () => {
    const birds = getEventDirective("pajaros", 20.5)?.creatures?.pajaros?.[0]
    const flyingBirds = getEventDirective("pajaros", 20.5)?.creatures?.pajaros?.[1]

    expect(birds).toMatchObject({
      spawnName: "pajaros",
      at: 2,
      count: 4,
      stagger: 0.055,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "strokeBorn",
      targetLongSide: 310,
      life: 3,
    })
    expect(birds?.offset).toEqual({ x: -116, y: 8 })
    expect(birds?.scatter).toEqual({ x: 145, y: 54 })
    expect(birds?.drift).toEqual({ x: -74, y: -12 })
    expect(flyingBirds).toMatchObject({
      spawnName: "pajarosVolando",
      at: 2.08,
      count: 3,
      stagger: 0.12,
      layer: "foreground",
      attachment: "strokeEnd",
      reveal: "strokeBorn",
      targetLongSide: 130,
      life: 3.4,
    })
    expect(flyingBirds?.drift).toEqual({ x: -180, y: -64 })
  })

  it("stages the intro koi as a large fish, school, then two sprites above the trace", () => {
    const fish = getEventDirective("pececillo", 24.5)?.creatures?.pececillo

    expect(fish).toHaveLength(3)
    expect(fish?.[0]).toMatchObject({
      at: 1.42,
      count: 1,
      targetLongSide: 210,
      attachment: "strokeEnd",
      reveal: "strokeBorn",
    })
    expect(fish?.[1]).toMatchObject({
      at: 1.62,
      count: 5,
      stagger: 0.055,
      targetLongSide: 112,
    })
    expect(fish?.[2]).toMatchObject({
      at: 1.74,
      count: 2,
      targetLongSide: 98,
      offset: { x: 16, y: -26 },
    })
  })

  it("captures climax fish as attached contact marks", () => {
    const fish = getEventDirective("pececillo-climax")?.creatures?.pececillo?.[0]

    expect(fish).toMatchObject({
      at: 0.04,
      count: 5,
      stagger: 0.065,
      layer: "overInk",
      attachment: "recentStroke",
      reveal: "strokeBorn",
      targetLongSide: 66,
      life: 2.8,
    })
    expect(fish?.scatter).toEqual({ x: 150, y: 58 })
    expect(fish?.drift).toEqual({ x: -72, y: 10 })
    expect(fish?.scaleJitter).toBe(0.46)
  })

  it("suppresses raw cosquilla repeats so the word reveal draws once", () => {
    expect(getEventDirective("cosquilla")?.skipCreature).toBe(true)
  })

  it("directs the 142-145s hole reprise as small intermittent bead-holes on the line", () => {
    const entrada = getEventDirective("Entradaagujero")?.creatures?.Entradaagujero?.[0]
    const salida = getEventDirective("Salidaagujero")?.creatures?.Salidaagujero?.[0]

    expect(entrada).toMatchObject({
      spawnName: "Salidaagujero",
      layer: "overInk",
      attachment: "brushHead",
      reveal: "inkPop",
      targetLongSide: 190,
    })
    // Short-lived so they blink intermittently as the choreography fires them ~5x.
    expect(entrada?.life).toBeLessThan(1)
    expect(salida).toMatchObject({
      layer: "overInk",
      attachment: "brushHead",
      reveal: "inkPop",
      targetLongSide: 168,
    })
    expect(salida?.life).toBeLessThan(1)
  })

  it("uses a smaller exit-hole spark at the climax attack", () => {
    const salida = getEventDirective("Salidaagujero", 168.7)?.creatures?.Salidaagujero?.[0]

    expect(getEventDirective("Salidaagujero", 168.7)?.key).toBe("Salidaagujero-climax")
    expect(salida).toMatchObject({
      attachment: "brushHead",
      reveal: "strokeBorn",
      targetLongSide: 86,
      life: 0.95,
    })
  })

  it("directs dandelion climax as small attached contact marks", () => {
    const dandelion = getEventDirective("dandelion", 194)?.creatures?.dandelion?.[0]

    expect(dandelion).toMatchObject({
      count: 5,
      targetLongSide: 76,
      layer: "overInk",
      attachment: "recentStroke",
      reveal: "strokeBorn",
      life: 2.3,
    })
    expect(dandelion?.scatter).toEqual({ x: 150, y: 54 })
  })

  it("directs pre-climax dandelion as tiny scratches", () => {
    const dandelion = getEventDirective("dandelion", 133)?.creatures?.dandelion?.[0]

    expect(dandelion).toMatchObject({
      count: 3,
      targetLongSide: 48,
      layer: "insideInk",
      attachment: "recentStroke",
      reveal: "strokeBorn",
      life: 1.5,
    })
  })

  it("directs pre-climax fish as dry hairline scratches", () => {
    const fish = getEventDirective("pececillo", 136.2)?.creatures?.pececillo?.[0]

    expect(getEventDirective("pececillo", 136.2)?.key).toBe("pececillo-preclimax")
    expect(fish).toMatchObject({
      count: 3,
      layer: "insideInk",
      attachment: "recentStroke",
      reveal: "strokeBorn",
      targetLongSide: 56,
      life: 1.55,
    })
  })

  it("directs butterfly events as delayed small clusters", () => {
    const mariposa = getEventDirective("mariposa", 124.8)?.creatures?.mariposa
    const noLoop = getEventDirective("mariposanoloop", 178.2)?.creatures?.mariposanoloop

    expect(mariposa?.[0]).toMatchObject({
      spawnName: "mariposanoloop",
      at: 1.42,
      count: 1,
      targetLongSide: 135,
      attachment: "strokeEnd",
      reveal: "strokeBorn",
    })
    expect(mariposa?.[1]).toMatchObject({
      spawnName: "mariposanoloopVolando",
      at: 1.5,
      count: 1,
      targetLongSide: 125,
      attachment: "strokeEnd",
      reveal: "strokeBorn",
    })
    expect(noLoop?.[0]).toMatchObject({
      at: 0.35,
      count: 1,
      targetLongSide: 150,
      attachment: "recentStroke",
      reveal: "strokeBorn",
    })
    expect(noLoop?.[1]).toMatchObject({
      spawnName: "mariposanoloopVolando",
      at: 0.45,
      count: 1,
      targetLongSide: 132,
      attachment: "recentStroke",
      reveal: "strokeBorn",
    })
  })

  it("directs formerly default middle-scene PNGs as attached marks", () => {
    const ceraDirective = getEventDirective("cera")
    expect(ceraDirective?.brushHold).toEqual({ startOffset: 0, duration: 0.28, pressure: 0, paint: false })
    expect(ceraDirective?.creatures?.cera?.[0]).toMatchObject({
      layer: "overInk",
      attachment: "brushHead",
      reveal: "hardCut",
      targetLongSide: 560,
      fixed: true,
    })
    expect(ceraDirective?.creatures?.cera?.[0].offset).toEqual({ x: 0, y: 132 })
    expect(getEventDirective("cremallera")?.creatures?.cremallera?.[0]).toMatchObject({
      layer: "insideInk",
      attachment: "strokeEnd",
      reveal: "strokeEmbedded",
      targetLongSide: 390,
      strokeFit: { length: 400, widthScale: 2.4, minWidth: 34, revealSeconds: 0.55 },
    })
    expect(getEventDirective("Ogrande")?.creatures?.Ogrande?.[0]).toMatchObject({
      attachment: "brushHead",
      reveal: "brushDraw",
      targetLongSide: 360,
      fixed: true,
      revealDuration: 0.61,
    })
    expect(getEventDirective("Ogrande")?.brushHold).toEqual({ startOffset: 0.2, duration: 0.72, pressure: 0, paint: false })
  })

  it("directs memory and water PNGs as trace-bound effects", () => {
    expect(getEventDirective("burbuja")?.creatures?.burbuja?.[0]).toMatchObject({
      layer: "overInk",
      attachment: "brushHead",
      reveal: "strokeBorn",
      targetLongSide: 96,
    })
    expect(getEventDirective("Ondasagua")?.creatures?.Ondasagua?.[0]).toMatchObject({
      attachment: "brushHead",
      reveal: "strokeBorn",
      targetLongSide: 178,
    })
    expect(getEventDirective("recuerdo_b")?.creatures?.recuerdo_b?.[0]).toMatchObject({
      attachment: "brushHead",
      reveal: "strokeBorn",
      targetLongSide: 60,
    })
    expect(getEventDirective("lagrima")?.creatures?.lagrima?.[0]).toMatchObject({
      attachment: "strokeEnd",
      reveal: "drawLeftToRight",
      targetLongSide: 190,
    })
  })

  it("embeds wire and zipper marks inside the brush trace", () => {
    expect(getEventDirective("cremallera")?.creatures?.cremallera?.[0]).toMatchObject({
      layer: "insideInk",
      reveal: "strokeEmbedded",
      drift: { x: 0, y: 0 },
      strokeFit: { length: 400, widthScale: 2.4, minWidth: 34, revealSeconds: 0.55 },
    })
    expect(getEventDirective("alambre")?.creatures?.alambre?.[0]).toMatchObject({
      layer: "insideInk",
      reveal: "strokeEmbedded",
      targetLongSide: 420,
      drift: { x: 0, y: 0 },
      strokeFit: { length: 520, widthScale: 4.6, minWidth: 68, revealSeconds: 0.72 },
    })
  })
})

describe("getEventDirective", () => {
  it("returns direct and grouped directives", () => {
    expect(getEventDirective("labios")?.key).toBe("labios")
    expect(getEventDirective("pececillo", 198)?.key).toBe("pececillo-climax")
    expect(getEventDirective("pececillo", 136.2)?.key).toBe("pececillo-preclimax")
    expect(getEventDirective("pececillo", 24.5)?.key).toBe("pececillo-intro")
  })
})
