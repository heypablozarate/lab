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
      fireAt: 68.45,
      layer: "overInk",
      attachment: "world",
      reveal: "radialBurst",
      targetLongSide: 860,
      offset: { x: -80, y: -24 },
    })
    expect(result.brushHolds).toEqual([])
  })

  it("expands repeated climax fish into scattered instances", () => {
    const result = expandDirectedEvents(event({ t: 198, creatures: ["pececillo", "pececillo"] }))

    expect(result.creatures).toHaveLength(10)
    expect(result.creatures[0]).toMatchObject({ name: "pececillo", fireAt: 198, targetLongSide: 145 })
    expect(result.creatures[1].offset.x).not.toBe(result.creatures[0].offset.x)
    expect(result.creatures[1].targetLongSide).not.toBe(result.creatures[0].targetLongSide)
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
})
