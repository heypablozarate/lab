export function snapLabelCoordinate(value: number, dpr: number) {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.round(value * scale) / scale;
}

export const LABEL_REVEAL_DELAY_MS = 480;

export function shouldHideLabels(
  now: number,
  revealAfter: number,
  dragging: boolean,
  cameraMotionActive: boolean,
) {
  return dragging || cameraMotionActive || now < revealAfter;
}
