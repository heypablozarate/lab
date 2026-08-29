import { describe, expect, it } from "vitest"

import {
  createInteractionState,
  leaveInteraction,
  moveInteraction,
  shaderTime,
  stepInteraction,
} from "./interaction"

describe("wordmark pointer interaction", () => {
  it("uses raw pointer distance for proximity while keeping shader input bounded", () => {
    const state = createInteractionState(() => 0.25)

    moveInteraction(state, [8, 0.5], false, () => 0.5)

    expect(state.target).toEqual([1, 0.5])
    expect(state.hoverTarget).toBe(0)
  })

  it("preserves eased movement and decaying energy for normal motion", () => {
    const state = createInteractionState(() => 0.25)
    moveInteraction(state, [0.75, 0.25], false, () => 0.5)
    const energy = state.energy

    stepInteraction(state, false)

    expect(state.mouse[0]).toBeCloseTo(0.545)
    expect(state.mouse[1]).toBeCloseTo(0.455)
    expect(state.energy).toBeCloseTo(energy * 0.93)
    expect(shaderTime(1250, false)).toBe(1.25)
  })

  it("freezes autonomous time and responds directly under reduced motion", () => {
    const state = createInteractionState(() => 0.25)
    moveInteraction(state, [0.75, 0.25], true, () => 0.5)

    expect(state.mouse).toEqual([0.75, 0.25])
    expect(state.hover).toBe(state.hoverTarget)
    expect(state.energy).toBe(0)
    expect(shaderTime(1_000_000, true)).toBe(0)

    leaveInteraction(state, true)
    stepInteraction(state, true)
    expect(state.hover).toBe(0)
    expect(state.energy).toBe(0)
  })
})
