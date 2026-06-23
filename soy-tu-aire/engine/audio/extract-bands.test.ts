import { describe, expect, it } from "vitest"
import { extractBands } from "./extract-bands"

// freqBinHz = sampleRate / fftSize. Con sr=44100 y fft=2048 => ~21.5 Hz/bin.
const SR = 44100
const FFT = 2048

function freqWithPeakAt(hz: number, value = 255): Uint8Array {
  const bins = FFT / 2
  const arr = new Uint8Array(bins)
  const bin = Math.round(hz / (SR / FFT))
  if (bin < bins) arr[bin] = value
  return arr
}

describe("extractBands", () => {
  it("un pico en graves (<150Hz) sube ritmo2 y casi no voz/cascabeles", () => {
    const b = extractBands(freqWithPeakAt(80), SR, FFT)
    expect(b.ritmo2).toBeGreaterThan(0)
    expect(b.cascabeles).toBe(0)
  })

  it("un pico en agudos (>6kHz) sube cascabeles", () => {
    const b = extractBands(freqWithPeakAt(9000), SR, FFT)
    expect(b.cascabeles).toBeGreaterThan(0)
    expect(b.ritmo2).toBe(0)
  })

  it("un pico en medios (~1kHz) sube voz", () => {
    const b = extractBands(freqWithPeakAt(1000), SR, FFT)
    expect(b.voz).toBeGreaterThan(0)
  })

  it("devuelve valores normalizados 0..1", () => {
    const full = new Uint8Array(FFT / 2).fill(255)
    const b = extractBands(full, SR, FFT)
    for (const v of Object.values(b)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
