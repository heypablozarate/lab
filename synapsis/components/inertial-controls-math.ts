/** Match damping across refresh rates; tau=80ms settles to 98% in ~313ms. */
export function dampingForDelta(deltaSeconds: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  return 1 - Math.exp(-Math.max(0, Math.min(deltaSeconds, 0.1)) / 0.08);
}

export function wheelDistance(distance: number, delta: number, mode: number, viewport: number, speed: number, min: number, max: number): number {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? viewport : 1);
  return Math.max(min, Math.min(max, distance * Math.exp(Math.max(-1, Math.min(1, pixels * 0.0015 * speed)))));
}
