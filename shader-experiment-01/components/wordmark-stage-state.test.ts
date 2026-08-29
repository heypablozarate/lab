import { describe, expect, it } from "vitest"

import {
  createWordmarkStageState,
  reduceWordmarkStageState,
} from "./wordmark-stage-state"

describe("Shader Experiment shared stage state", () => {
  it("starts with the canonical editable wordmark and the existing controls", () => {
    expect(createWordmarkStageState("PabloZarate™")).toEqual({
      effect: 0,
      intensity: 1,
      text: "PabloZarate™",
    })
  })

  it("edits text without losing the selected effect or intensity", () => {
    const configured = {
      effect: 15,
      intensity: 1.65,
      text: "PabloZarate™",
    }

    expect(
      reduceWordmarkStageState(configured, {
        type: "text",
        text: "Diseño — 東京 🚀",
      }),
    ).toEqual({
      effect: 15,
      intensity: 1.65,
      text: "Diseño — 東京 🚀",
    })
  })

  it("preserves empty, Unicode, and extreme-length text verbatim", () => {
    const initial = createWordmarkStageState("PabloZarate™")
    const values = ["", "e\u0301 — العربية — 👩🏽‍💻", "長".repeat(4096)]

    for (const text of values) {
      expect(
        reduceWordmarkStageState(initial, { type: "text", text }).text,
      ).toBe(text)
    }
  })

  it("changes either control without replacing the edited text", () => {
    const edited = {
      effect: 0,
      intensity: 1,
      text: "Custom text",
    }
    const withEffect = reduceWordmarkStageState(edited, {
      type: "effect",
      effect: 8,
    })
    const withIntensity = reduceWordmarkStageState(withEffect, {
      type: "intensity",
      intensity: 0.35,
    })

    expect(withIntensity).toEqual({
      effect: 8,
      intensity: 0.35,
      text: "Custom text",
    })
  })
})
