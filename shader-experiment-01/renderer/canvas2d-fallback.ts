import type {
  RendererFailureHandler,
  WordmarkBackend,
} from "./contracts"

export function createCanvas2dRenderer(
  canvas: HTMLCanvasElement,
  onFatal: RendererFailureHandler,
): WordmarkBackend {
  const context = canvas.getContext("2d", { alpha: true })
  if (!context) throw new Error("Canvas2D is unavailable.")

  let disposed = false
  let source: HTMLCanvasElement | undefined

  const draw = () => {
    if (disposed) return
    try {
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (source) context.drawImage(source, 0, 0, canvas.width, canvas.height)
    } catch (error) {
      onFatal(error)
    }
  }

  return {
    kind: "canvas2d",
    resize(width, height) {
      if (disposed) return
      canvas.width = Math.max(1, width)
      canvas.height = Math.max(1, height)
      draw()
    },
    uploadText(nextSource) {
      source = nextSource
      draw()
    },
    render() {
      draw()
    },
    dispose() {
      if (disposed) return
      disposed = true
      source = undefined
      context.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
