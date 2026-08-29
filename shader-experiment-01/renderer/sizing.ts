const MAX_DPR = 2

export function backingDimensions(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): readonly [number, number] {
  const width = Number.isFinite(cssWidth) ? Math.max(0, cssWidth) : 0
  const height = Number.isFinite(cssHeight) ? Math.max(0, cssHeight) : 0
  const rawDpr = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1
  const dpr = Math.min(MAX_DPR, Math.max(1, rawDpr))
  return [
    Math.max(1, Math.floor(width * dpr)),
    Math.max(1, Math.floor(height * dpr)),
  ]
}
