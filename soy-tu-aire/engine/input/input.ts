import type { Vec2 } from "../types"
export class Input {
  screen: Vec2 | null = null
  private lastMove = -Infinity
  private onMove = (e: PointerEvent) => {
    const rect = this.el.getBoundingClientRect()
    this.screen = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    this.lastMove = performance.now()
  }
  private onLeave = () => { this.screen = null }
  constructor(private el: HTMLElement) {
    el.addEventListener("pointermove", this.onMove)
    el.addEventListener("pointerleave", this.onLeave)
  }
  isActive(now: number): boolean { return now - this.lastMove < 1200 }
  destroy(): void {
    this.el.removeEventListener("pointermove", this.onMove)
    this.el.removeEventListener("pointerleave", this.onLeave)
  }
}
