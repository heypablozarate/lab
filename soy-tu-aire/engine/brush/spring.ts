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
