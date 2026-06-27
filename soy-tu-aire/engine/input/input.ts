import type { Vec2 } from "../types"
export class Input {
  screen: Vec2 | null = null
  private onMove = (e: PointerEvent) => {
    const rect = this.el.getBoundingClientRect()
    this.screen = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  private onLeave = () => { this.screen = null }
  constructor(private el: HTMLElement) {
    el.addEventListener("pointermove", this.onMove)
    el.addEventListener("pointerleave", this.onLeave)
  }
  // Seed the pointer at a client position (the Play click) so the stroke is born
  // exactly under the mouse and the head holds there — screenToPaper re-maps this
  // fixed screen point onto the advancing world each frame — until the real mouse
  // moves. Without this the canvas never saw a pointermove (the overlay ate it),
  // so the head started at the view center and wandered off until the first move.
  prime(clientX: number, clientY: number): void {
    const rect = this.el.getBoundingClientRect()
    this.screen = { x: clientX - rect.left, y: clientY - rect.top }
  }
  destroy(): void {
    this.el.removeEventListener("pointermove", this.onMove)
    this.el.removeEventListener("pointerleave", this.onLeave)
  }
}
