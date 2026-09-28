import { describe, expect, it } from "vitest";
import { createEdgeCurvePositions, EDGE_CURVE_SEGMENTS } from "./edge-curves";

describe("Synapsis curved edge buffer", () => {
  const positions = [0, 0, 0, 10, 0, 0, 10, 5, 4];
  const edges = [0, 1, 1, 2];
  it("retains the exact graph endpoints and continuous segment joins", () => {
    const result = createEdgeCurvePositions(positions, edges);
    for (let edge = 0; edge < edges.length / 2; edge += 1) {
      const offset = edge * EDGE_CURVE_SEGMENTS * 6;
      const a = edges[edge * 2] * 3, b = edges[edge * 2 + 1] * 3;
      expect(Array.from(result.slice(offset, offset + 3))).toEqual(positions.slice(a, a + 3));
      const end = offset + EDGE_CURVE_SEGMENTS * 6;
      expect(Array.from(result.slice(end - 3, end))).toEqual(positions.slice(b, b + 3));
      for (let segment = 1; segment < EDGE_CURVE_SEGMENTS; segment += 1) {
        const join = offset + segment * 6;
        expect(result.slice(join - 3, join)).toEqual(result.slice(join, join + 3));
      }
    }
  });
  it("is deterministic, non-straight and fits one LineSegments buffer", () => {
    const result = createEdgeCurvePositions(positions, edges);
    expect(result).toEqual(createEdgeCurvePositions(positions, edges));
    expect(result).toHaveLength((edges.length / 2) * EDGE_CURVE_SEGMENTS * 2 * 3);
    expect(result[(EDGE_CURVE_SEGMENTS / 2) * 6 + 1]).toBeGreaterThan(0);
    expect(positions).toEqual([0, 0, 0, 10, 0, 0, 10, 5, 4]);
  });
  it("handles depth-aligned, coincident and empty edges without NaN", () => {
    expect(createEdgeCurvePositions([], [])).toHaveLength(0);
    for (const points of [[0, 0, 0, 0, 0, 10], [0, 0, 0, 0, 0, 0]]) {
      const result = createEdgeCurvePositions(points, [0, 1]);
      expect(Array.from(result).every(Number.isFinite)).toBe(true);
    }
  });
});
