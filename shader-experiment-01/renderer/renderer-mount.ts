import type {
  RendererFailureHandler,
  RendererKind,
  WordmarkBackend,
  WordmarkBackendFactory,
} from "./contracts"

export type RendererFactories = Readonly<
  Record<RendererKind, WordmarkBackendFactory>
>

export type RendererMount = Readonly<{
  ready: Promise<void>
  dispose(): void
}>

/**
 * Owns one renderer attempt on one canvas. A failed backend is never replaced on
 * that canvas: WebGPU/WebGL contexts are exclusive, so the React owner must
 * remount a fresh canvas before trying the next renderer.
 */
export function mountRenderer({
  canvas,
  kind,
  factories,
  onReady,
  onFailure,
  onFatal,
}: {
  canvas: HTMLCanvasElement
  kind: RendererKind
  factories: RendererFactories
  onReady: (backend: WordmarkBackend) => void | Promise<void>
  onFailure: RendererFailureHandler
  onFatal: RendererFailureHandler
}): RendererMount {
  let disposed = false
  let backend: WordmarkBackend | undefined
  let fatalDelivered = false
  const controller = new AbortController()

  const failFatally = (error: unknown) => {
    if (disposed || fatalDelivered) return
    fatalDelivered = true
    onFatal(error)
  }

  const ready = Promise.resolve()
    .then(() => factories[kind](canvas, failFatally, controller.signal))
    .then(async (candidate) => {
      if (disposed) {
        candidate.dispose()
        return
      }
      backend = candidate
      await onReady(candidate)
    })
    .catch((error: unknown) => {
      if (!disposed) onFailure(error)
    })

  return {
    ready,
    dispose() {
      if (disposed) return
      disposed = true
      controller.abort()
      backend?.dispose()
      backend = undefined
    },
  }
}
