import type { RibbonGeometry, RibbonSample, Vec2 } from "../types"

const EPSILON = 1e-6

type RibbonOptions = {
  taperSamples?: number
}

const EMPTY_GEOMETRY: RibbonGeometry = {
  positions: new Float32Array(0),
  uvs: new Float32Array(0),
  alphas: new Float32Array(0),
  indices: new Uint16Array(0),
}

function clean(value: number): number {
  return Math.abs(value) < EPSILON ? 0 : value
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function normalize(dx: number, dy: number): Vec2 {
  const length = Math.hypot(dx, dy)
  if (length < EPSILON) return { x: 1, y: 0 }
  return { x: dx / length, y: dy / length }
}

function tangentAt(samples: readonly RibbonSample[], index: number): Vec2 {
  const prev = samples[index - 1]
  const current = samples[index]
  const next = samples[index + 1]

  if (prev && next && distance(prev, next) >= EPSILON) {
    return normalize(next.x - prev.x, next.y - prev.y)
  }
  if (next && distance(current, next) >= EPSILON) {
    return normalize(next.x - current.x, next.y - current.y)
  }
  if (prev && distance(prev, current) >= EPSILON) {
    return normalize(current.x - prev.x, current.y - prev.y)
  }

  for (let i = index + 1; i < samples.length; i++) {
    if (distance(current, samples[i]) >= EPSILON) {
      return normalize(samples[i].x - current.x, samples[i].y - current.y)
    }
  }
  for (let i = index - 1; i >= 0; i--) {
    if (distance(samples[i], current) >= EPSILON) {
      return normalize(current.x - samples[i].x, current.y - samples[i].y)
    }
  }
  return { x: 1, y: 0 }
}

function taperAt(index: number, count: number, taperSamples: number): number {
  if (taperSamples <= 0) return 1
  const distanceToEnd = Math.min(index, count - 1 - index)
  const effectiveTaper = Math.min(taperSamples, Math.max(1, Math.floor((count - 1) / 2)))
  return Math.min(1, distanceToEnd / effectiveTaper)
}

function cumulativeUs(samples: readonly RibbonSample[]): number[] {
  const distances = new Array<number>(samples.length).fill(0)
  for (let i = 1; i < samples.length; i++) {
    distances[i] = distances[i - 1] + distance(samples[i - 1], samples[i])
  }
  const total = distances[distances.length - 1]
  if (total < EPSILON) return distances
  return distances.map((d) => d / total)
}

export function buildRibbonGeometry(
  samples: readonly RibbonSample[],
  options: RibbonOptions = {},
): RibbonGeometry {
  if (samples.length < 2) return EMPTY_GEOMETRY

  const taperSamples = options.taperSamples ?? 2
  const positions = new Float32Array(samples.length * 4)
  const uvs = new Float32Array(samples.length * 4)
  const alphas = new Float32Array(samples.length * 2)
  const indexCount = (samples.length - 1) * 6
  const vertexCount = samples.length * 2
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)
  const us = cumulativeUs(samples)

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const tangent = tangentAt(samples, i)
    const normal = { x: -tangent.y, y: tangent.x }
    const halfWidth = Math.max(0, sample.width) * taperAt(i, samples.length, taperSamples) * 0.5
    const leftIndex = i * 4
    const alphaIndex = i * 2

    positions[leftIndex] = clean(sample.x + normal.x * halfWidth)
    positions[leftIndex + 1] = clean(sample.y + normal.y * halfWidth)
    positions[leftIndex + 2] = clean(sample.x - normal.x * halfWidth)
    positions[leftIndex + 3] = clean(sample.y - normal.y * halfWidth)
    uvs[leftIndex] = us[i]
    uvs[leftIndex + 1] = 0
    uvs[leftIndex + 2] = us[i]
    uvs[leftIndex + 3] = 1
    alphas[alphaIndex] = Math.min(1, Math.max(0, sample.alpha))
    alphas[alphaIndex + 1] = alphas[alphaIndex]
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const vertex = i * 2
    const index = i * 6
    indices[index] = vertex
    indices[index + 1] = vertex + 1
    indices[index + 2] = vertex + 2
    indices[index + 3] = vertex + 1
    indices[index + 4] = vertex + 3
    indices[index + 5] = vertex + 2
  }

  return { positions, uvs, alphas, indices }
}
