import { describe, expect, it } from "vitest"

import { hasExpectedPixelSignal, inspectPixels } from "./pixel-evidence"

describe("pixel evidence", () => {
  const inkSource = inspectPixels(
    new Uint8Array([
      0, 0, 0, 0,
      255, 240, 220, 255,
    ]),
  )

  it("rejects a uniform opaque texture even though every alpha byte is non-zero", () => {
    const uniformOpaque = inspectPixels(
      new Uint8Array([
        0, 0, 0, 255,
        0, 0, 0, 255,
      ]),
    )

    expect(uniformOpaque.inkPixels).toBe(2)
    expect(uniformOpaque.varied).toBe(false)
    expect(hasExpectedPixelSignal(inkSource, uniformOpaque)).toBe(false)
  })

  it("accepts visible RGB and alpha variation", () => {
    const visible = inspectPixels(
      new Uint8Array([
        0, 0, 0, 0,
        255, 240, 220, 255,
      ]),
    )

    expect(visible.rgbPixels).toBe(1)
    expect(visible.varied).toBe(true)
    expect(hasExpectedPixelSignal(inkSource, visible)).toBe(true)
  })

  it("does not require a pixel signal for an empty raster", () => {
    const empty = inspectPixels(
      new Uint8Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]),
    )
    const uniformOpaque = inspectPixels(
      new Uint8Array([
        0, 0, 0, 255,
        0, 0, 0, 255,
      ]),
    )

    expect(hasExpectedPixelSignal(empty, uniformOpaque)).toBe(true)
  })
})
