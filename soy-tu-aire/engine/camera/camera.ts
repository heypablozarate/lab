import { PAPER_W, PAPER_H } from "../constants"
import { computeViewRect } from "./compute-view-rect"
import type { Vec2, ViewRect } from "../types"
export class Camera {
  center: Vec2 = { x: PAPER_W / 2, y: PAPER_H / 2 }
  zoom = 1.6
  follow(target: Vec2, dt: number): void {
    const k = 1 - Math.exp(-2.5 * dt) // easing exponencial, estable a cualquier dt
    this.center.x += (target.x - this.center.x) * k
    this.center.y += (target.y - this.center.y) * k
  }
  view(aspect: number): ViewRect {
    return computeViewRect(this.center, this.zoom, aspect, PAPER_W, PAPER_H)
  }
}
