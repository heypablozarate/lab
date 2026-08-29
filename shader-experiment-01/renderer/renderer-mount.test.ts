import { describe, expect, it, vi } from "vitest"

import type {
  RendererKind,
  WordmarkBackend,
  WordmarkBackendFactory,
} from "./contracts"
import { nextRendererKind } from "./contracts"
import { mountRenderer, type RendererFactories } from "./renderer-mount"

function backend(kind: RendererKind, dispose = vi.fn()): WordmarkBackend {
  return {
    kind,
    resize() {},
    uploadText() {},
    render() {},
    dispose,
  }
}

function factories(
  overrides: Partial<Record<RendererKind, WordmarkBackendFactory>> = {},
): RendererFactories {
  return {
    webgpu: async () => backend("webgpu"),
    webgl: async () => backend("webgl"),
    canvas2d: async () => backend("canvas2d"),
    ...overrides,
  }
}

describe("renderer selection and mount lifecycle", () => {
  it("selects vgpu/WebGPU as the primary renderer", async () => {
    const onReady = vi.fn()
    const mounted = mountRenderer({
      canvas: {} as HTMLCanvasElement,
      kind: "webgpu",
      factories: factories(),
      onReady,
      onFailure: vi.fn(),
      onFatal: vi.fn(),
    })

    await mounted.ready

    expect(onReady).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webgpu" }),
    )
    mounted.dispose()
  })

  it.each(["adapter unavailable", "device request rejected"])(
    "surfaces %s so the owner can remount a fresh WebGL canvas",
    async (message) => {
      const onFailure = vi.fn()
      const createWebgl = vi.fn(async () => backend("webgl"))
      const mounted = mountRenderer({
        canvas: {} as HTMLCanvasElement,
        kind: "webgpu",
        factories: factories({
          webgpu: async () => {
            throw new Error(message)
          },
          webgl: createWebgl,
        }),
        onReady: vi.fn(),
        onFailure,
        onFatal: vi.fn(),
      })

      await mounted.ready

      expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ message }))
      expect(createWebgl).not.toHaveBeenCalled()
      expect(nextRendererKind("webgpu")).toBe("webgl")
    },
  )

  it("orders the isolated WebGL and static Canvas2D fallbacks", () => {
    expect(nextRendererKind("webgl")).toBe("canvas2d")
    expect(nextRendererKind("canvas2d")).toBeUndefined()
  })

  it("turns an asynchronous first-frame rejection into a fallback request", async () => {
    const onFailure = vi.fn()
    const firstFrameError = new Error("transparent first frame")
    const mounted = mountRenderer({
      canvas: {} as HTMLCanvasElement,
      kind: "webgpu",
      factories: factories(),
      async onReady() {
        await Promise.resolve()
        throw firstFrameError
      },
      onFailure,
      onFatal: vi.fn(),
    })

    await mounted.ready

    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith(firstFrameError)
    mounted.dispose()
  })

  it("disposes a late backend after Strict Mode cleanup", async () => {
    let resolveBackend: ((value: WordmarkBackend) => void) | undefined
    const lateDispose = vi.fn()
    const create = vi.fn(
      (_canvas: HTMLCanvasElement, _fatal: (error: unknown) => void, signal: AbortSignal) =>
        new Promise<WordmarkBackend>((resolve) => {
          expect(signal.aborted).toBe(true)
          resolveBackend = resolve
        }),
    )
    const mounted = mountRenderer({
      canvas: {} as HTMLCanvasElement,
      kind: "webgpu",
      factories: factories({ webgpu: create }),
      onReady: vi.fn(),
      onFailure: vi.fn(),
      onFatal: vi.fn(),
    })

    mounted.dispose()
    await Promise.resolve()
    resolveBackend?.(backend("webgpu", lateDispose))
    await mounted.ready

    expect(lateDispose).toHaveBeenCalledTimes(1)
  })

  it("delivers a post-init device/context loss once", async () => {
    let fatal: ((error: unknown) => void) | undefined
    const onFatal = vi.fn()
    const mounted = mountRenderer({
      canvas: {} as HTMLCanvasElement,
      kind: "webgpu",
      factories: factories({
        webgpu: async (_canvas, nextFatal) => {
          fatal = nextFatal
          return backend("webgpu")
        },
      }),
      onReady: vi.fn(),
      onFailure: vi.fn(),
      onFatal,
    })
    await mounted.ready

    fatal?.(new Error("device lost"))
    fatal?.(new Error("duplicate loss"))

    expect(onFatal).toHaveBeenCalledTimes(1)
    mounted.dispose()
  })
})
