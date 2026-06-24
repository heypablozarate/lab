import type { Vec2, ViewRect } from "../types"
export function screenToPaper(
  sx: number, sy: number, canvasW: number, canvasH: number, view: ViewRect,
): Vec2 {
  return { x: view.x + (sx / canvasW) * view.w, y: view.y + (sy / canvasH) * view.h }
}
