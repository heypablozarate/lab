import type { Bands } from "../types"

type Range = [number, number] // Hz [min, max)

const RANGES: Record<keyof Bands, Range> = {
  ritmo2: [20, 150],
  instrumental: [150, 2000],
  voz: [300, 3000],
  cascabeles: [6000, 16000],
}

function bandEnergy(freq: Uint8Array, binHz: number, [lo, hi]: Range): number {
  const start = Math.max(0, Math.floor(lo / binHz))
  const end = Math.min(freq.length, Math.ceil(hi / binHz))
  if (end <= start) return 0
  let sum = 0
  for (let i = start; i < end; i++) sum += freq[i]
  return sum / (end - start) / 255 // promedio normalizado 0..1
}

export function extractBands(freq: Uint8Array, sampleRate: number, fftSize: number): Bands {
  const binHz = sampleRate / fftSize
  return {
    voz: bandEnergy(freq, binHz, RANGES.voz),
    instrumental: bandEnergy(freq, binHz, RANGES.instrumental),
    cascabeles: bandEnergy(freq, binHz, RANGES.cascabeles),
    ritmo2: bandEnergy(freq, binHz, RANGES.ritmo2),
  }
}
