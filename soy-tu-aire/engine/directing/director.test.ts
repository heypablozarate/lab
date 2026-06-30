import { describe, expect, it } from "vitest"

import { expandDirectedEvents } from "./director"
import type { ChoreoEvent } from "../timeline/choreography"

function event(overrides: Partial<ChoreoEvent>): ChoreoEvent {
  return {
    t: 0,
    velocidad: 1,
    presion: 1,
    climax: 0,
    reveals: [],
    creatures: [],
    ...overrides,
  }
}

describe("expandDirectedEvents", () => {
  it("expands salpico to a delayed non-painting brush stamp", () => {
    const result = expandDirectedEvents(event({ t: 66.5, creatures: ["salpico"] }))

    expect(result.creatures).toHaveLength(1)
    expect(result.creatures[0]).toMatchObject({
      name: "salpico",
      fireAt: 68.7,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "hardCut",
      targetLongSide: 720,
      offset: { x: 0, y: 0 },
      fixed: true,
      rotation: 0,
      frameOffset: 0,
    })
    expect(result.creatures[0].drift).toEqual({ x: 0, y: 0 })
    expect(result.brushHolds).toEqual([
      { startAt: 68.7, endAt: 69.06, pressure: 0, paint: false },
    ])
  })

  it("expands repeated climax fish into scattered instances", () => {
    const result = expandDirectedEvents(event({ t: 198, creatures: ["pececillo", "pececillo"] }))

    expect(result.creatures).toHaveLength(5)
    expect(result.creatures[0]).toMatchObject({
      name: "pececillo",
      fireAt: 198.04,
      layer: "overInk",
      attachment: "recentStroke",
      reveal: "strokeBorn",
      targetLongSide: 66,
    })
    expect(result.creatures[1].fireAt).toBe(198.105)
    expect(result.creatures[1].offset.x).not.toBe(result.creatures[0].offset.x)
    expect(result.creatures[1].targetLongSide).not.toBe(result.creatures[0].targetLongSide)
    expect(result.creatures[1].drift.x).toBeLessThan(0)
    expect(result.creatures[1].frameOffset).toBeGreaterThan(0)
  })

  it("passes through unspecified creatures as stroke-born full-opacity marks", () => {
    const result = expandDirectedEvents(event({ t: 30.5, creatures: ["unmapped-png"] }))

    expect(result.creatures).toEqual([
      {
        name: "unmapped-png",
        fireAt: 30.5,
        layer: "overInk",
        attachment: "strokeEnd",
        reveal: "strokeBorn",
        targetLongSide: undefined,
        life: 4,
        offset: { x: 0, y: 0 },
        drift: { x: 0, y: 0 },
        rotation: 0,
        frameOffset: 0,
      },
    ])
  })

  it("emits brush holds from directives", () => {
    const result = expandDirectedEvents(event({ t: 87, creatures: ["labios"] }))

    expect(result.brushHolds).toEqual([
      { startAt: 88.58, endAt: 89.83, pressure: 0.12, paint: true },
    ])
    expect(result.creatures).toHaveLength(1)
    expect(result.creatures[0]).toMatchObject({
      name: "labios",
      fireAt: 88.72,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "brushDraw",
      targetLongSide: 360,
      life: 5.2,
      offset: { x: 178, y: 12 },
    })
    expect(result.creatures[0].drift.x).toBeLessThan(0)
  })

  it("passes explicit brush-drawn reveal durations through directed spawns", () => {
    const chica = expandDirectedEvents(event({ t: 18.7, creatures: ["chica"] }))
    const ogrande = expandDirectedEvents(event({ t: 95.4, creatures: ["Ogrande"] }))

    expect(chica.creatures[0]).toMatchObject({
      name: "chica",
      fireAt: 20.12,
      reveal: "brushDraw",
      revealDuration: 0.36,
    })
    expect(chica.brushHolds).toEqual([
      { startAt: 20.04, endAt: 20.62, pressure: 0, paint: false, freeze: false },
    ])
    expect(ogrande.creatures[0]).toMatchObject({
      name: "Ogrande",
      fireAt: 95.64,
      reveal: "brushDraw",
      revealDuration: 0.61,
    })
    expect(ogrande.brushHolds).toEqual([
      { startAt: 95.6, endAt: 96.32, pressure: 0, paint: false },
    ])
  })

  it("maps the early entrando cue onto the full Entradaagujero portal asset", () => {
    const result = expandDirectedEvents(event({ t: 36.66, creatures: ["entrando"] }))

    expect(result.creatures).toHaveLength(2)
    expect(result.creatures[0]).toMatchObject({
      name: "entrando",
      fireAt: 38.18,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "radialBurst",
      targetLongSide: 360,
    })
    expect(result.creatures[1]).toMatchObject({
      name: "EntradaagujeroPortal",
      fireAt: 38.48,
      layer: "screenForeground",
      attachment: "screen",
      reveal: "portalTakeover",
      targetLongSide: 920,
    })
    expect(result.brushHolds).toEqual([
      { startAt: 38.36, endAt: 39.91, pressure: 0, paint: false },
    ])
  })

  it("maps late Entradaagujero reprise cues away from the bowler-man portal asset", () => {
    const result = expandDirectedEvents(event({ t: 145.15, creatures: ["Entradaagujero"] }))

    expect(result.creatures).toHaveLength(1)
    expect(result.creatures[0]).toMatchObject({
      name: "Salidaagujero",
      fireAt: 145.15,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "inkPop",
      targetLongSide: 190,
    })
  })

  it("keeps future delayed spawns out of the current frame window", () => {
    const batch = expandDirectedEvents(event({ t: 66.5, creatures: ["salpico"] }))
    const readyAtNominalTime = batch.creatures.filter((spawn) => spawn.fireAt > 66.4 && spawn.fireAt <= 66.6)
    const readyAtBurstTime = batch.creatures.filter((spawn) => spawn.fireAt > 68.6 && spawn.fireAt <= 68.75)

    expect(readyAtNominalTime).toHaveLength(0)
    expect(readyAtBurstTime).toHaveLength(1)
  })

  it("expands late butterflies as staggered unsynchronized clusters", () => {
    const result = expandDirectedEvents(event({ t: 124.8, creatures: ["mariposa"] }))

    expect(result.creatures).toHaveLength(2)
    expect(result.creatures[0]).toMatchObject({
      name: "mariposanoloop",
      fireAt: 126.22,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "strokeBorn",
      targetLongSide: 135,
    })
    expect(result.creatures[1]).toMatchObject({
      name: "mariposanoloopVolando",
      fireAt: 126.3,
      layer: "foreground",
      attachment: "strokeEnd",
      reveal: "strokeBorn",
      targetLongSide: 125,
    })
  })

  it("expands cera as a fixed brush stamp instead of a default fade", () => {
    const result = expandDirectedEvents(event({ t: 30.5, creatures: ["cera"] }))

    expect(result.creatures).toHaveLength(1)
    expect(result.creatures[0]).toMatchObject({
      name: "cera",
      fireAt: 30.55,
      layer: "overInk",
      attachment: "brushHead",
      reveal: "hardCut",
      targetLongSide: 560,
      offset: { x: 0, y: 132 },
      fixed: true,
    })
    expect(result.brushHolds).toEqual([
      { startAt: 30.5, endAt: 30.78, pressure: 0, paint: false },
    ])
  })

  it("expands zipper and barbed-wire PNGs as stroke-embedded marks", () => {
    const zipper = expandDirectedEvents(event({ t: 32.8, creatures: ["cremallera"] }))
    const wire = expandDirectedEvents(event({ t: 150, creatures: ["alambre"] }))

    expect(zipper.creatures[0]).toMatchObject({
      name: "cremallera",
      fireAt: 32.98,
      layer: "insideInk",
      attachment: "strokeEnd",
      reveal: "strokeEmbedded",
      targetLongSide: 390,
      drift: { x: 0, y: 0 },
      strokeFit: { length: 400, widthScale: 2.4, minWidth: 34, revealSeconds: 0.55 },
    })
    expect(wire.creatures[0]).toMatchObject({
      name: "alambre",
      fireAt: 150.05,
      layer: "insideInk",
      attachment: "strokeEnd",
      reveal: "strokeEmbedded",
      targetLongSide: 420,
      drift: { x: 0, y: 0 },
      strokeFit: { length: 520, widthScale: 4.6, minWidth: 68, revealSeconds: 0.72 },
    })
  })

  it("expands late birds after the raw cue and keeps them attached to the stroke", () => {
    const result = expandDirectedEvents(event({ t: 20.5, creatures: ["pajaros"] }))

    expect(result.creatures).toHaveLength(7)
    expect(result.creatures[0]).toMatchObject({
      name: "pajaros",
      fireAt: 22.5,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "strokeBorn",
      targetLongSide: 310,
    })
    expect(result.creatures[0].offset.x).toBeLessThan(-70)
    expect(result.creatures[0].offset.y).toBeGreaterThan(-50)
    expect(result.creatures[1].offset.x).not.toBe(result.creatures[0].offset.x)
    expect(result.creatures[4]).toMatchObject({
      name: "pajarosVolando",
      fireAt: 22.58,
      layer: "foreground",
      attachment: "strokeEnd",
      reveal: "strokeBorn",
      targetLongSide: 150,
    })
    expect(result.creatures[4].drift.x).toBeLessThan(-130)
    expect(result.creatures[4].drift.y).toBeLessThan(-40)
  })

  it("expands intro koi as a large fish, school, and two sprites above the trace", () => {
    const result = expandDirectedEvents(event({ t: 24.5, creatures: ["pececillo", "pececillo"] }))

    expect(result.creatures).toHaveLength(8)
    expect(result.creatures[0]).toMatchObject({
      name: "pececillo",
      fireAt: 25.92,
      targetLongSide: 210,
      offset: { x: -38, y: 34 },
    })
    expect(result.creatures[1]).toMatchObject({
      fireAt: 26.12,
    })
    expect(result.creatures[1].targetLongSide).toBeGreaterThan(80)
    expect(result.creatures[1].targetLongSide).toBeLessThan(145)
    expect(result.creatures[6]).toMatchObject({
      fireAt: 26.24,
    })
    expect(result.creatures[6].targetLongSide).toBeGreaterThan(70)
    expect(result.creatures[6].targetLongSide).toBeLessThan(125)
    expect(result.creatures[6].offset.y).toBeLessThan(0)
  })

  it("suppresses raw word-sprite repeats that are handled by the reveal layer", () => {
    const result = expandDirectedEvents(event({ t: 41.2, creatures: ["cosquilla", "cosquilla", "cosquilla"] }))

    expect(result.creatures).toEqual([])
  })
})
