import { describe, expect, it } from "vitest"

import { PIXI_LAYER_ORDER } from "./pixi-stage"

describe("PIXI_LAYER_ORDER", () => {
  it("places directed artwork around ink in the same order as the reference composition", () => {
    expect(PIXI_LAYER_ORDER).toEqual([
      "paper",
      "effectsLayer",
      "underInkLayer",
      "inkLayer",
      "insideInkLayer",
      "overInkLayer",
      "foregroundLayer",
    ])
  })
})
