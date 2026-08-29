export type RendererKind = "webgpu" | "webgl" | "canvas2d"

export type Point = readonly [number, number]

export type WordmarkFrame = Readonly<{
  resolution: Point
  mouse: Point
  time: number
  hover: number
  energy: number
  seed: number
  effect: number
  intensity: number
}>

export interface WordmarkBackend {
  readonly kind: RendererKind
  resize(width: number, height: number): void
  uploadText(source: HTMLCanvasElement): void
  render(frame: WordmarkFrame): void
  settled?(options?: { expectVisible?: boolean }): Promise<void>
  dispose(): void
}

export type RendererFailureHandler = (error: unknown) => void

export type WordmarkBackendFactory = (
  canvas: HTMLCanvasElement,
  onFatal: RendererFailureHandler,
  signal: AbortSignal,
) => Promise<WordmarkBackend> | WordmarkBackend

export const RENDERER_ORDER: readonly RendererKind[] = [
  "webgpu",
  "webgl",
  "canvas2d",
]

export function nextRendererKind(kind: RendererKind): RendererKind | undefined {
  const index = RENDERER_ORDER.indexOf(kind)
  return RENDERER_ORDER[index + 1]
}
