import { describe, expect, it } from "vitest"

import { frameIndexForPlayback } from "./creatures"

describe("frameIndexForPlayback", () => {
  it("loops forward for regular animated sprites", () => {
    expect([0, 1, 2, 3, 4, 5].map((raw) => frameIndexForPlayback(raw, 3, "loop"))).toEqual([
      0, 1, 2, 0, 1, 2,
    ])
  })

  it("holds the last frame for one-shot sprites", () => {
    expect([0, 1, 2, 3, 4, 5].map((raw) => frameIndexForPlayback(raw, 3, "once"))).toEqual([
      0, 1, 2, 2, 2, 2,
    ])
  })

  it("bounces forward and backward without repeating edge frames", () => {
    expect(Array.from({ length: 14 }, (_, raw) => frameIndexForPlayback(raw, 7, "bounce"))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0, 1,
    ])
  })
})
