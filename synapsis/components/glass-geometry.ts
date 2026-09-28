type Rect = { left: number; top: number; width: number; height: number };

/** Writes center/half-size in framebuffer pixels with a bottom-left origin. */
export function writeGlassPanelBounds(
  out: Float32Array,
  panel: Rect,
  canvas: Rect,
  pixelWidth: number,
  pixelHeight: number,
): boolean {
  if (panel.width <= 0 || panel.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return false;
  if (panel.left >= canvas.left + canvas.width || panel.top >= canvas.top + canvas.height ||
      panel.left + panel.width <= canvas.left || panel.top + panel.height <= canvas.top) return false;
  const scaleX = pixelWidth / canvas.width;
  const scaleY = pixelHeight / canvas.height;
  out[0] = (panel.left - canvas.left + panel.width / 2) * scaleX;
  out[1] = (canvas.height - (panel.top - canvas.top + panel.height / 2)) * scaleY;
  out[2] = panel.width / 2 * scaleX;
  out[3] = panel.height / 2 * scaleY;
  return true;
}
