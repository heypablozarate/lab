import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  RendererKind,
  WordmarkBackend,
  WordmarkFrame,
} from "./contracts"

const moduleMocks = vi.hoisted(() => ({
  rasterizeWordmark: vi.fn(() => ({
    width: 1,
    height: 1,
    fontSize: 1,
    measuredWidth: 1,
    drawnWidth: 1,
    startX: 0,
    baseY: 0,
  })),
}))

vi.mock("./text-raster", () => ({
  rasterizeWordmark: moduleMocks.rasterizeWordmark,
  resolveCanvasColor: () => "rgb(255, 255, 255)",
}))
vi.mock("./vgpu-renderer", () => ({ createVgpuRenderer: vi.fn() }))
vi.mock("./webgl-fallback", () => ({ createWebglRenderer: vi.fn() }))
vi.mock("./canvas2d-fallback", () => ({ createCanvas2dRenderer: vi.fn() }))

import { startWordmarkRuntime } from "./wordmark-runtime"

class FakeCanvas extends EventTarget {
  width = 1
  height = 1
  dataset: Record<string, string> = {}
  parentElement = null

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: 640,
      height: 360,
      right: 640,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON() {},
    }
  }

  getContext() {
    return {}
  }

  closest() {
    return null
  }
}

function fakeBackend(kind: RendererKind, overrides: Partial<WordmarkBackend> = {}) {
  let disposed = false
  const disposeSpy = vi.fn(() => {
    if (disposed) return
    disposed = true
  })
  const value: WordmarkBackend = {
    kind,
    resize: vi.fn(),
    uploadText: vi.fn(),
    render: vi.fn(),
    dispose: disposeSpy,
    ...overrides,
  }
  return { value, disposeSpy }
}

beforeEach(() => {
  moduleMocks.rasterizeWordmark.mockClear()
  const fakeWindow = new EventTarget() as EventTarget & {
    devicePixelRatio: number
    visualViewport: EventTarget
    matchMedia(query: string): MediaQueryList
  }
  fakeWindow.devicePixelRatio = 1
  fakeWindow.visualViewport = new EventTarget()
  fakeWindow.matchMedia = (query) =>
    ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList

  const textCanvas = new FakeCanvas()
  const fonts = {
    ready: new Promise<FontFaceSet>(() => undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal("window", fakeWindow)
  vi.stubGlobal("document", {
    createElement: () => textCanvas,
    body: {},
    documentElement: {},
    fonts,
  })
  vi.stubGlobal("getComputedStyle", () => ({
    color: "rgb(255, 255, 255)",
    fontFamily: "Test Sans",
    getPropertyValue: () => "",
  }))
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  vi.stubGlobal("ResizeObserver", undefined)
  vi.stubGlobal("MutationObserver", undefined)
})

describe("wordmark shared runtime", () => {
  it("turns a post-ready upload error into one fallback request", async () => {
    let uploadCount = 0
    const renderer = fakeBackend("webgpu", {
      uploadText: vi.fn(() => {
        uploadCount += 1
        if (uploadCount > 1) throw new Error("upload failed")
      }),
    })
    const onRendererFailure = vi.fn()
    const runtime = startWordmarkRuntime({
      canvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      kind: "webgpu",
      initialState: { text: "PabloZarate™", effect: 3, intensity: 1.2 },
      factories: {
        webgpu: async () => renderer.value,
        webgl: async () => fakeBackend("webgl").value,
        canvas2d: async () => fakeBackend("canvas2d").value,
      },
      onRendererFailure,
    })
    await runtime.ready

    expect(() =>
      runtime.update({ text: "Unicode 東京", effect: 3, intensity: 1.2 }),
    ).not.toThrow()
    expect(onRendererFailure).toHaveBeenCalledTimes(1)
    expect(renderer.disposeSpy).toHaveBeenCalledTimes(1)

    runtime.update({ text: "another", effect: 3, intensity: 1.2 })
    expect(onRendererFailure).toHaveBeenCalledTimes(1)
    runtime.dispose()
  })

  it("falls back without a public console warning in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const renderer = fakeBackend("webgpu", {
      uploadText: vi.fn(() => {
        throw new Error("initial upload failed")
      }),
    })
    const onRendererFailure = vi.fn()

    try {
      const runtime = startWordmarkRuntime({
        canvas: new FakeCanvas() as unknown as HTMLCanvasElement,
        kind: "webgpu",
        initialState: { text: "PabloZarate™", effect: 0, intensity: 1 },
        factories: {
          webgpu: async () => renderer.value,
          webgl: async () => fakeBackend("webgl").value,
          canvas2d: async () => fakeBackend("canvas2d").value,
        },
        onRendererFailure,
      })
      await runtime.ready

      expect(onRendererFailure).toHaveBeenCalledTimes(1)
      expect(warning).not.toHaveBeenCalled()
      runtime.dispose()
    } finally {
      warning.mockRestore()
      vi.unstubAllEnvs()
    }
  })

  it("recomputes capped DPR without resetting shared state", async () => {
    const frames: WordmarkFrame[] = []
    const renderer = fakeBackend("webgpu", {
      render: vi.fn((current) => frames.push(current)),
    })
    const runtime = startWordmarkRuntime({
      canvas: new FakeCanvas() as unknown as HTMLCanvasElement,
      kind: "webgpu",
      initialState: { text: "Diseño 東京", effect: 15, intensity: 1.75 },
      factories: {
        webgpu: async () => renderer.value,
        webgl: async () => fakeBackend("webgl").value,
        canvas2d: async () => fakeBackend("canvas2d").value,
      },
      onRendererFailure: vi.fn(),
    })
    await runtime.ready

    ;(window as unknown as { devicePixelRatio: number }).devicePixelRatio = 3
    window.dispatchEvent(new Event("resize"))

    expect(renderer.value.resize).toHaveBeenNthCalledWith(1, 640, 360)
    expect(renderer.value.resize).toHaveBeenNthCalledWith(2, 1280, 720)
    expect(frames.at(-1)).toMatchObject({
      resolution: [1280, 720],
      effect: 15,
      intensity: 1.75,
      time: 0,
    })
    expect(moduleMocks.rasterizeWordmark).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: "Diseño 東京", width: 1280, height: 720 }),
    )
    runtime.dispose()
  })
})
