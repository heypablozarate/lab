import type { Vec2 } from "../types"
export function springStep(
  pos: Vec2, vel: Vec2, target: Vec2, stiffness: number, damping: number, dt: number,
): void {
  // Integración semi-implícita; subdividimos si dt es grande para estabilidad.
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    const ax = (target.x - pos.x) * stiffness - vel.x * damping
    const ay = (target.y - pos.y) * stiffness - vel.y * damping
    vel.x += ax * h; vel.y += ay * h
    pos.x += vel.x * h; pos.y += vel.y * h
  }
}
export function emitDabs(from: Vec2, to: Vec2, spacing: number): Vec2[] {
  const dx = to.x - from.x, dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const out: Vec2[] = []
  if (dist < spacing) { out.push({ x: to.x, y: to.y }); return out }
  const n = Math.floor(dist / spacing)
  for (let i = 1; i <= n; i++) {
    const t = (i * spacing) / dist
    out.push({ x: from.x + dx * t, y: from.y + dy * t })
  }
  if (out[out.length - 1].x !== to.x || out[out.length - 1].y !== to.y) out.push({ x: to.x, y: to.y })
  return out
}
