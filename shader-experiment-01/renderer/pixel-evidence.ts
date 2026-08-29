export type PixelEvidence = Readonly<{
  varied: boolean
  inkPixels: number
  rgbPixels: number
}>

export function inspectPixels(
  pixels: Uint8Array | Uint8ClampedArray,
): PixelEvidence {
  if (pixels.length < 4) return { varied: false, inkPixels: 0, rgbPixels: 0 }

  const first = [pixels[0], pixels[1], pixels[2], pixels[3]]
  let varied = false
  let inkPixels = 0
  let rgbPixels = 0

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] !== 0) inkPixels += 1
    if (pixels[index] !== 0 || pixels[index + 1] !== 0 || pixels[index + 2] !== 0) {
      rgbPixels += 1
    }
    if (
      Math.abs(pixels[index] - first[0]) > 2 ||
      Math.abs(pixels[index + 1] - first[1]) > 2 ||
      Math.abs(pixels[index + 2] - first[2]) > 2 ||
      Math.abs(pixels[index + 3] - first[3]) > 2
    ) {
      varied = true
    }
  }

  return { varied, inkPixels, rgbPixels }
}

/**
 * A non-empty CPU raster must retain each observable signal after the GPU
 * texture upload. Empty input intentionally imposes no texture requirement.
 */
export function hasExpectedPixelSignal(
  source: PixelEvidence,
  candidate: PixelEvidence,
): boolean {
  if (source.inkPixels === 0) return true
  if (candidate.inkPixels === 0) return false
  if (source.rgbPixels > 0 && candidate.rgbPixels === 0) return false
  if (source.varied && !candidate.varied) return false
  return true
}
