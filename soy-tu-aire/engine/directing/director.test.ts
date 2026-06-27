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
  it("expands salpico to its delayed directed spawn", () => {
    const result = expandDirectedEvents(event({ t: 66.5, creatures: ["salpico"] }))

    expect(result.creatures).toHaveLength(1)
    expect(result.creatures[0]).toMatchObject({
      name: "salpico",
      fireAt: 68.3,
      layer: "overInk",
      attachment: "strokeEnd",
      reveal: "inkPop",
      targetLongSide: 860,
      offset: { x: -80, y: -24 },
      drift: { x: 0, y: 0 },
      rotation: 0,
      frameOffset: 0,
    })
    expect(result.brushHolds).toEqual([])
  })

  it("expands repeated climax fish into scattered instances", () => {
    const result = expandDirectedEvents(event({ t: 198, creatures: ["pececillo", "pececillo"] }))

    expect(result.creatures).toHaveLength(5)
    expect(result.creatures[0]).toMatchObject({ name: "pececillo", fireAt: 198, targetLongSide: 105 })
    expect(result.creatures[1].fireAt).toBe(198.075)
    expect(result.creatures[1].offset.x).not.toBe(result.creatures[0].offset.x)
    expect(result.creatures[1].targetLongSide).not.toBe(result.creatures[0].targetLongSide)
    expect(result.creatures[1].drift.x).toBeLessThan(0)
    expect(result.creatures[1].frameOffset).toBeGreaterThan(0)
  })

  it("passes through unspecified creatures with default directed values", () => {
    const result = expandDirectedEvents(event({ t: 30.5, creatures: ["cera"] }))

    expect(result.creatures).toEqual([
      {
        name: "cera",
        fireAt: 30.5,
        layer: "overInk",
        attachment: "world",
        reveal: "fade",
        targetLongSide: undefined,
        life: 4,
        offset: { x: 0, y: 0 },
        drift: { x: 0, y: 0 },
        rotation: 0,
        frameOffset: 0,
        alpha: 1,
      },
    ])
  })

  it("emits brush holds from directives", () => {
    const result = expandDirectedEvents(event({ t: 87, creatures: ["labios"] }))

    expect(result.brushHolds).toEqual([
      { startAt: 86.95, endAt: 88.2, pressure: 0.08 },
    ])
  })

  it("keeps future delayed spawns out of the current frame window", () => {
    const batch = expandDirectedEvents(event({ t: 66.5, creatures: ["salpico"] }))
    const readyAtNominalTime = batch.creatures.filter((spawn) => spawn.fireAt > 66.4 && spawn.fireAt <= 66.6)
    const readyAtBurstTime = batch.creatures.filter((spawn) => spawn.fireAt > 68.2 && spawn.fireAt <= 68.35)

    expect(readyAtNominalTime).toHaveLength(0)
    expect(readyAtBurstTime).toHaveLength(1)
  })

  it("expands late butterflies as staggered unsynchronized clusters", () => {
    const result = expandDirectedEvents(event({ t: 124.8, creatures: ["mariposa"] }))

    expect(result.creatures).toHaveLength(5)
    expect(result.creatures[0]).toMatchObject({
      name: "mariposa",
      fireAt: 126.32,
      layer: "foreground",
      attachment: "brushHead",
      reveal: "hardCut",
    })
    expect(result.creatures[1].fireAt).toBe(126.4)
    expect(result.creatures[1].frameOffset).toBeGreaterThan(0)
    expect(result.creatures[1].rotation).not.toBe(0)
  })
})
