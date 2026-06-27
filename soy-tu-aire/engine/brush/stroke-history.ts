import type { RibbonSample, Vec2 } from "../types"

export type StrokeAnchor = Vec2 & {
  tangent: Vec2
  normal: Vec2
  width: number
  alpha: number
}

export function pointAtDistanceFromEnd(
  samples: readonly RibbonSample[],
  distance: number,
): StrokeAnchor | null {
  if (samples.length === 0) return null
  if (samples.length === 1) {
    return {
      x: samples[0].x,
      y: samples[0].y,
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      width: samples[0].width,
      alpha: samples[0].alpha,
    }
  }

  let remaining = Math.max(0, distance)
  for (let i = samples.length - 1; i > 0; i -= 1) {
    const a = samples[i - 1]
    const b = samples[i]
    const segment = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= segment) {
      const f = segment <= 1e-6 ? 0 : 1 - remaining / segment
      const tangent = normalize(b.x - a.x, b.y - a.y)
      return {
        x: round(a.x + (b.x - a.x) * f),
        y: round(a.y + (b.y - a.y) * f),
        tangent,
        normal: normalFrom(tangent),
        width: round(a.width + (b.width - a.width) * f),
        alpha: round(a.alpha + (b.alpha - a.alpha) * f),
      }
    }
    remaining -= segment
  }

  const first = samples[0]
  const second = samples[1]
  const tangent = normalize(second.x - first.x, second.y - first.y)
  return {
    x: first.x,
    y: first.y,
    tangent,
    normal: normalFrom(tangent),
    width: first.width,
    alpha: first.alpha,
  }
}

function normalFrom(tangent: Vec2): Vec2 {
  return { x: round(-tangent.y), y: round(tangent.x) }
}

function normalize(dx: number, dy: number): Vec2 {
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return { x: 1, y: 0 }
  return { x: round(dx / length), y: round(dy / length) }
}

function round(value: number): number {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}
