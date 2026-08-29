import { describe, expect, it, vi } from "vitest"

import type { Gpu } from "vgpu"

import { initializePrimaryGpu, type InitGpu } from "./webgpu-init"

function initMock(isFallbackAdapter: boolean | undefined) {
  const dispose = vi.fn()
  const gpu = {
    device: {
      adapterInfo:
        isFallbackAdapter === undefined ? null : { isFallbackAdapter },
    },
    dispose,
  } as unknown as Gpu
  return {
    dispose,
    gpu,
    init: vi.fn(async () => gpu) as unknown as InitGpu,
  }
}

describe("WebGPU primary adapter policy", () => {
  it("accepts a hardware adapter", async () => {
    const fixture = initMock(false)

    await expect(
      initializePrimaryGpu(new AbortController().signal, fixture.init),
    ).resolves.toBe(fixture.gpu)
    expect(fixture.dispose).not.toHaveBeenCalled()
  })

  it("rejects and disposes a software fallback adapter", async () => {
    const fixture = initMock(true)

    await expect(
      initializePrimaryGpu(new AbortController().signal, fixture.init),
    ).rejects.toThrow("software fallback adapter")
    expect(fixture.dispose).toHaveBeenCalledTimes(1)
  })

  it("keeps adapters with unavailable metadata eligible", async () => {
    const fixture = initMock(undefined)

    await expect(
      initializePrimaryGpu(new AbortController().signal, fixture.init),
    ).resolves.toBe(fixture.gpu)
  })
})
