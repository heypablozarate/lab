export type StrokeDynamicsInput = {
  speed: number
  previousSpeed: number
  curvature: number
  pressure: number
  climax: number
  ink: number
  hold: boolean
}

export type StrokeDynamics = {
  width: number
  alpha: number
  dryness: number
  bristleSplit: number
  headPool: number
  edgeJitter: number
}

const BASE_WIDTH = 12.8

export function computeStrokeDynamics(input: StrokeDynamicsInput): StrokeDynamics {
  const speed01 = clamp01(input.speed / 2200)
  const decel01 = clamp01((input.previousSpeed - input.speed) / 900)
  const pressure = clamp01(input.pressure)
  const climax = clamp01(input.climax)
  const ink = clamp01(input.ink)
  const hold = input.hold ? 1 : 0
  const pooling = clamp01((1 - input.speed / 560) * 0.72 + decel01 * 0.34 + hold * 0.78)
  const dryness = clamp01(speed01 * 0.7 + (1 - ink) * 0.84 - pooling * 0.5)
  const expressive = 0.22 + pressure * 1.46 + pooling * 1.34 + climax * 0.42
  const speedThin = 1.24 - speed01 * 0.88
  const inkWidth = ink <= 0 ? 0 : ink < 0.25 ? ink * 1.15 : 0.18 + ink * 0.82
  const width = Math.max(0, BASE_WIDTH * expressive * speedThin * inkWidth)
  const wetAlpha = 0.12 + pressure * 0.58 + pooling * 0.28 + climax * 0.08

  return {
    width,
    alpha: clamp01(wetAlpha * ink),
    dryness,
    bristleSplit: clamp01(dryness * 0.72 + speed01 * 0.22 + input.curvature * 0.14),
    headPool: clamp01(pooling * (0.72 + pressure * 0.28)),
    edgeJitter: clamp01(0.16 + dryness * 0.42 + input.curvature * 0.28),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
