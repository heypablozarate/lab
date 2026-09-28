/** Quadratic curves encoded as one shared LineSegments position buffer. */
export const EDGE_CURVE_SEGMENTS = 16;

export function createEdgeCurvePositions(positions: number[], edgeIndices: number[]): Float32Array {
  const result = new Float32Array((edgeIndices.length / 2) * EDGE_CURVE_SEGMENTS * 6);
  for (let e = 0; e < edgeIndices.length / 2; e += 1) {
    const a = edgeIndices[e * 2] * 3;
    const b = edgeIndices[e * 2 + 1] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const distance = Math.hypot(dx, dy, dz);
    // Use a stable perpendicular in the graph's main plane, falling back for
    // depth-aligned edges. No random seed, layout mutation or frame work.
    let nx = -dy, ny = dx, nz = 0;
    if (Math.hypot(nx, ny) < 1e-6) { nx = -dz; ny = 0; nz = dx; }
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    const bend = Math.min(distance * 0.18, 6) / normalLength;
    const cx = (ax + bx) / 2 + nx * bend;
    const cy = (ay + by) / 2 + ny * bend;
    const cz = (az + bz) / 2 + nz * bend;
    let px = ax, py = ay, pz = az;
    for (let segment = 0; segment < EDGE_CURVE_SEGMENTS; segment += 1) {
      const t = (segment + 1) / EDGE_CURVE_SEGMENTS;
      const u = 1 - t;
      const x = u * u * ax + 2 * u * t * cx + t * t * bx;
      const y = u * u * ay + 2 * u * t * cy + t * t * by;
      const z = u * u * az + 2 * u * t * cz + t * t * bz;
      const offset = (e * EDGE_CURVE_SEGMENTS + segment) * 6;
      result[offset] = px; result[offset + 1] = py; result[offset + 2] = pz;
      result[offset + 3] = x; result[offset + 4] = y; result[offset + 5] = z;
      px = x; py = y; pz = z;
    }
  }
  return result;
}
