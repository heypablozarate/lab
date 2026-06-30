import { describe, expect, it } from "vitest"

import { resolveCreaturePresentation } from "./creatures"

describe("resolveCreaturePresentation", () => {
  it("uses directed target size, life, and offset", () => {
    const result = resolveCreaturePresentation("salpico", {
      targetLongSide: 860,
      life: 3.2,
      offset: { x: -80, y: -24 },
    })

    expect(result).toEqual({
      targetLongSide: 860,
      life: 3.2,
      offset: { x: -80, y: -24 },
    })
  })

  it("keeps existing named defaults when no directive is passed", () => {
    const result = resolveCreaturePresentation("labios")

    expect(result.targetLongSide).toBe(360)
    expect(result.life).toBe(4)
    expect(result.offset).toEqual({ x: 0, y: 0 })
  })
})
