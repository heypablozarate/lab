import { describe, expect, it } from "vitest"

import { PAPER_H, PAPER_W } from "../constants"
import { computeViewRect } from "./compute-view-rect"
import {
  computeConveyorCameraSpeed,
  computeConveyorCameraTarget,
  computeConveyorCameraVerticalSpeed,
} from "./camera"

const ASPECT = 16 / 9
const VIEWPORT_W = 1440
const VIEWPORT_H = 960

function targetInput(overrides: Partial<Parameters<typeof computeConveyorCameraTarget>[0]> = {}) {
  return {
    aspect: ASPECT,
    dt: 1,
    time: 0,
    timelineSpeed: 1,
    audioEnergy: 0,
    pointerScreen: { x: VIEWPORT_W * 0.58, y: VIEWPORT_H * 0.5 },
    viewportW: VIEWPORT_W,
    viewportH: VIEWPORT_H,
    climax: 0,
    ...overrides,
  }
}

describe("computeConveyorCameraSpeed", () => {
  it("scales with the combined voz+instrumental volume — the music drives the belt", () => {
    const quiet = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.05, climax: 0, pointerX01: 0.5 })
    const loud = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.7, climax: 0, pointerX01: 0.5 })

    expect(loud).toBeGreaterThan(quiet + 120)
  })

  it("uses the <velocidad> keyframe as a multiplier, and 0 stops the belt", () => {
    const normal = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.4, climax: 0, pointerX01: 0.5 })
    const faster = computeConveyorCameraSpeed({ timelineSpeed: 1.3, audioEnergy: 0.4, climax: 0, pointerX01: 0.5 })
    const stopped = computeConveyorCameraSpeed({ timelineSpeed: 0, audioEnergy: 0.4, climax: 1, pointerX01: 0.95 })

    expect(faster).toBeGreaterThan(normal)
    expect(stopped).toBe(0)
  })

  it("accelerates through the song climax (the late near-the-end rush)", () => {
    const calm = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.3, climax: 0, pointerX01: 0.5 })
    const climaxRush = computeConveyorCameraSpeed({ timelineSpeed: 1.3, audioEnergy: 0.3, climax: 1, pointerX01: 0.5 })

    expect(climaxRush).toBeGreaterThan(calm + 250)
  })

  it("mouse X biases the belt around the real speed — right faster, left slower, never stopped", () => {
    const center = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.4, climax: 0, pointerX01: 0.5 })
    const right = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.4, climax: 0, pointerX01: 0.95 })
    const left = computeConveyorCameraSpeed({ timelineSpeed: 1, audioEnergy: 0.4, climax: 0, pointerX01: 0.05 })

    expect(right).toBeGreaterThan(center)
    expect(center).toBeGreaterThan(left)
    expect(left).toBeGreaterThan(0)
  })
})

describe("computeConveyorCameraVerticalSpeed", () => {
  it("descends (positive) when the mouse is low and ascends (negative) when high — but gently", () => {
    const low = computeConveyorCameraVerticalSpeed({ pointerY01: 0.9, audioEnergy: 0, time: 0 })
    const high = computeConveyorCameraVerticalSpeed({ pointerY01: 0.1, audioEnergy: 0, time: 0 })

    // Vertical stays gentle (near-stable like the original), so only a soft offset.
    expect(low).toBeGreaterThan(20)
    expect(high).toBeLessThan(-20)
  })

  it("still drifts a little at center, so the world never feels frozen", () => {
    const drift = computeConveyorCameraVerticalSpeed({ pointerY01: 0.5, audioEnergy: 0, time: Math.PI / 2 / 0.16 })

    expect(Math.abs(drift)).toBeGreaterThan(3)
  })
})

describe("computeConveyorCameraTarget", () => {
  it("scrolls the scene forward without centering on the brush", () => {
    const start = computeConveyorCameraTarget(targetInput({ time: 0 }), 0, 0)
    const advanced = computeConveyorCameraTarget(targetInput({ time: 5 }), 520, 0)

    expect(advanced.center.x).toBeGreaterThan(start.center.x + 450)
  })

  it("travels vertically with the vertical scroll accumulator", () => {
    const up = computeConveyorCameraTarget(targetInput(), 0, -300)
    const down = computeConveyorCameraTarget(targetInput(), 0, 300)

    expect(down.center.y).toBeGreaterThan(up.center.y + 400)
  })

  it("pulls back during choreography climax", () => {
    const calm = computeConveyorCameraTarget(targetInput({ time: 12, pointerScreen: null }), 900, 0)
    const climax = computeConveyorCameraTarget(targetInput({ time: 12, pointerScreen: null, climax: 1 }), 900, 0)

    expect(climax.zoom).toBeLessThan(calm.zoom)
  })

  it("clamps target center so the view stays inside paper bounds", () => {
    const target = computeConveyorCameraTarget(
      targetInput({
        time: 40,
        audioEnergy: 1,
        pointerScreen: { x: VIEWPORT_W, y: VIEWPORT_H },
      }),
      PAPER_W * 2,
      PAPER_H * 2,
    )
    const view = computeViewRect(target.center, target.zoom, ASPECT, PAPER_W, PAPER_H)

    expect(view.x).toBeGreaterThanOrEqual(0)
    expect(view.y).toBeGreaterThanOrEqual(0)
    expect(view.x + view.w).toBeLessThanOrEqual(PAPER_W)
    expect(view.y + view.h).toBeLessThanOrEqual(PAPER_H)
  })
})
