import type { Vec2, ViewRect } from "../types"
export function computeViewRect(
  center: Vec2, zoom: number, aspect: number, paperW: number, paperH: number,
): ViewRect {
  // El view mantiene el aspect del canvas. Base: alto = paperH/zoom.
  let h = paperH / zoom
  let w = h * aspect
  if (w > paperW) { w = paperW; h = w / aspect } // no exceder el ancho
  const x = Math.min(Math.max(center.x - w / 2, 0), Math.max(0, paperW - w))
  const y = Math.min(Math.max(center.y - h / 2, 0), Math.max(0, paperH - h))
  return { x, y, w, h }
}
