import { createCanvas2dRenderer } from "./canvas2d-fallback"
import type {
  RendererKind,
  WordmarkBackend,
  WordmarkFrame,
} from "./contracts"
import {
  createInteractionState,
  leaveInteraction,
  moveInteraction,
  shaderTime,
  stepInteraction,
} from "./interaction"
import {
  mountRenderer,
  type RendererFactories,
  type RendererMount,
} from "./renderer-mount"
import { backingDimensions } from "./sizing"
import {
  rasterizeWordmark,
  resolveCanvasColor,
} from "./text-raster"
import { createVgpuRenderer } from "./vgpu-renderer"
import { createWebglRenderer } from "./webgl-fallback"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const LAB_THEME_CHANGE_EVENT = "lab-theme-change"

export type WordmarkRuntimeState = Readonly<{
  text: string
  effect: number
  intensity: number
}>

export type WordmarkRuntime = Readonly<{
  ready: Promise<void>
  update(next: WordmarkRuntimeState): void
  dispose(): void
}>

export const defaultRendererFactories: RendererFactories = {
  webgpu: createVgpuRenderer,
  webgl: createWebglRenderer,
  canvas2d: createCanvas2dRenderer,
}

function observeDpr(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined

  let query: MediaQueryList | undefined
  let handler: (() => void) | undefined

  const remove = () => {
    if (!query || !handler) return
    if (typeof query.removeEventListener === "function") {
      query.removeEventListener("change", handler)
    } else {
      query.removeListener(handler)
    }
  }

  const bind = () => {
    remove()
    query = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`,
    )
    handler = () => {
      bind()
      onChange()
    }
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler)
    } else {
      query.addListener(handler)
    }
  }

  bind()
  return remove
}

function finiteControl(value: number, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export function startWordmarkRuntime({
  canvas,
  kind,
  initialState,
  factories = defaultRendererFactories,
  onRendererFailure,
  onRendererReady,
}: {
  canvas: HTMLCanvasElement
  kind: RendererKind
  initialState: WordmarkRuntimeState
  factories?: RendererFactories
  onRendererFailure: (kind: RendererKind, error: unknown) => void
  onRendererReady?: (kind: RendererKind) => void
}): WordmarkRuntime {
  let disposed = false
  let backend: WordmarkBackend | undefined
  let state = { ...initialState }
  let size: readonly [number, number] = [1, 1]
  let animationFrame = 0
  let failureDelivered = false
  const startedAt = performance.now()
  const interaction = createInteractionState()
  const textCanvas = document.createElement("canvas")
  const textContext = textCanvas.getContext("2d", { willReadFrequently: true })
  if (!textContext) throw new Error("Canvas2D text rasterization is unavailable.")

  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY)
  let reducedMotion = reducedMotionQuery.matches

  const currentFrame = (now: number): WordmarkFrame => ({
    resolution: size,
    mouse: interaction.mouse,
    time: shaderTime(now - startedAt, reducedMotion),
    hover: interaction.hover,
    energy: interaction.energy,
    seed: interaction.seed,
    effect: Math.round(finiteControl(state.effect, 0, 0, 15)),
    intensity: finiteControl(state.intensity, 1, 0, 2),
  })

  const fail = (error: unknown) => {
    if (disposed || failureDelivered) return
    failureDelivered = true
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[shader-experiment-01] ${kind} renderer failed`, error)
    }
    canvas.dataset.rendererStatus = "failed"
    if (animationFrame) cancelAnimationFrame(animationFrame)
    animationFrame = 0
    const failedBackend = backend
    backend = undefined
    try {
      failedBackend?.dispose()
    } catch {
      // Teardown must not replace the runtime failure that selected fallback.
    }
    onRendererFailure(kind, error)
  }

  const safely = (operation: () => void): boolean => {
    if (disposed || failureDelivered) return false
    try {
      operation()
      return !failureDelivered
    } catch (error) {
      fail(error)
      return false
    }
  }

  const renderOnce = (now = performance.now()): boolean => {
    if (disposed || !backend) return false
    return safely(() => {
      stepInteraction(interaction, reducedMotion)
      backend?.render(currentFrame(now))
    })
  }

  const loop = (now: number) => {
    if (disposed || !backend || reducedMotion || backend.kind === "canvas2d") {
      animationFrame = 0
      return
    }
    renderOnce(now)
    animationFrame = requestAnimationFrame(loop)
  }

  const ensureLoop = () => {
    if (
      disposed ||
      !backend ||
      reducedMotion ||
      backend.kind === "canvas2d" ||
      animationFrame
    ) {
      return
    }
    animationFrame = requestAnimationFrame(loop)
  }

  const requestRender = () => {
    if (reducedMotion || backend?.kind === "canvas2d") renderOnce()
    else ensureLoop()
  }

  const rasterize = (): boolean => {
    return safely(() => {
      textCanvas.width = size[0]
      textCanvas.height = size[1]
      const computed = getComputedStyle(canvas)
      rasterizeWordmark({
        context: textContext,
        width: size[0],
        height: size[1],
        text: state.text,
        fontFamily: getComputedStyle(document.body).fontFamily || "sans-serif",
        wordColor: resolveCanvasColor(
          canvas,
          "--wordmark",
          computed.color || "#f5f5f5",
        ),
        trademarkColor: resolveCanvasColor(
          canvas,
          "--wordmark-tm",
          computed.color || "#f5f5f5",
        ),
      })
      backend?.uploadText(textCanvas)
    })
  }

  const resize = (force = false): boolean => {
    if (disposed || failureDelivered) return false
    let changed = false
    const resized = safely(() => {
      const rect = canvas.getBoundingClientRect()
      const nextSize = backingDimensions(
        rect.width,
        rect.height,
        window.devicePixelRatio || 1,
      )
      if (!force && nextSize[0] === size[0] && nextSize[1] === size[1]) return
      size = nextSize
      backend?.resize(size[0], size[1])
      changed = true
    })
    if (!resized || !changed) return resized
    if (!rasterize()) return false
    requestRender()
    return !failureDelivered
  }

  const rerasterize = () => {
    if (disposed || failureDelivered || !rasterize()) return
    requestRender()
  }

  const handleResize = () => resize()

  const handlePointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    moveInteraction(
      interaction,
      [
        (event.clientX - rect.left) / width,
        1 - (event.clientY - rect.top) / height,
      ],
      reducedMotion,
    )
    requestRender()
  }

  const handlePointerLeave = () => {
    leaveInteraction(interaction, reducedMotion)
    requestRender()
  }

  const handleReducedMotionChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches
    if (reducedMotion && animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = 0
    }
    stepInteraction(interaction, reducedMotion)
    renderOnce()
    ensureLoop()
  }

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => resize())
  resizeObserver?.observe(canvas)
  window.addEventListener("resize", handleResize)
  window.visualViewport?.addEventListener("resize", handleResize)
  window.addEventListener("pointermove", handlePointerMove)
  canvas.addEventListener("pointerleave", handlePointerLeave)
  window.addEventListener(LAB_THEME_CHANGE_EVENT, rerasterize)
  reducedMotionQuery.addEventListener("change", handleReducedMotionChange)
  const stopDprObserver = observeDpr(() => resize(true))

  const themeObserver =
    typeof MutationObserver === "undefined"
      ? undefined
      : new MutationObserver(rerasterize)
  themeObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  })
  const themeRoot = canvas.closest("[data-theme]")
  if (themeRoot && themeRoot !== document.documentElement) {
    themeObserver?.observe(themeRoot, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    })
  }

  const fontSet = document.fonts
  const handleFontsLoaded = () => rerasterize()
  fontSet?.addEventListener?.("loadingdone", handleFontsLoaded)
  void fontSet?.ready.then(handleFontsLoaded)

  const rendererMount: RendererMount = mountRenderer({
    canvas,
    kind,
    factories,
    async onReady(nextBackend) {
      if (disposed) return
      backend = nextBackend
      canvas.dataset.renderer = nextBackend.kind
      if (!resize(true) || !renderOnce(startedAt)) return
      await nextBackend.settled?.({ expectVisible: state.text.length > 0 })
      if (disposed || failureDelivered) return
      canvas.dataset.rendererStatus = "ready"
      onRendererReady?.(nextBackend.kind)
      ensureLoop()
    },
    onFailure: fail,
    onFatal: fail,
  })

  return {
    ready: rendererMount.ready,
    update(next) {
      if (disposed) return
      const textChanged = next.text !== state.text
      state = { ...next }
      if (textChanged) rerasterize()
      else requestRender()
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (animationFrame) cancelAnimationFrame(animationFrame)
      animationFrame = 0
      rendererMount?.dispose()
      backend = undefined
      resizeObserver?.disconnect()
      stopDprObserver()
      themeObserver?.disconnect()
      window.removeEventListener("resize", handleResize)
      window.visualViewport?.removeEventListener("resize", handleResize)
      window.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerleave", handlePointerLeave)
      window.removeEventListener(LAB_THEME_CHANGE_EVENT, rerasterize)
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange)
      fontSet?.removeEventListener?.("loadingdone", handleFontsLoaded)
    },
  }
}
