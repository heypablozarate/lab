import { PAPER_W, PAPER_H } from "../constants"
import { springStep, emitDabs } from "./spring"
import type { BrushMod, Dab, Vec2 } from "../types"

const STIFFNESS = 90
const DAMPING = 14
const DAB_SPACING = 4
const BASE_SIZE = 22

export class Brush {
  pos: Vec2 = { x: PAPER_W / 2, y: PAPER_H / 2 }
  private vel: Vec2 = { x: 0, y: 0 }
  private prev: Vec2 = { ...this.pos }
  private wanderT = 0

  update(dt: number, target: Vec2 | null, mod: BrushMod): Dab[] {
    let t = target
    if (!t) {
      // Wander procedural suave (figura de Lissajous lenta) cuando no hay input.
      this.wanderT += dt
      t = {
        x: PAPER_W / 2 + Math.sin(this.wanderT * 0.5) * PAPER_W * 0.22,
        y: PAPER_H / 2 + Math.sin(this.wanderT * 0.37) * PAPER_H * 0.22,
      }
    }
    this.prev.x = this.pos.x; this.prev.y = this.pos.y
    springStep(this.pos, this.vel, t, STIFFNESS, DAMPING, dt)
    const speed = Math.hypot(this.pos.x - this.prev.x, this.pos.y - this.prev.y) / Math.max(dt, 1e-3)
    const size = BASE_SIZE * (0.6 + mod.pressure) * (1 + mod.climax * 0.8)
    const alpha = Math.min(1, 0.25 + mod.pressure * 0.5 + Math.min(speed / 4000, 0.3))
    return emitDabs(this.prev, this.pos, DAB_SPACING).map((p) => ({ x: p.x, y: p.y, size, alpha }))
  }
}
