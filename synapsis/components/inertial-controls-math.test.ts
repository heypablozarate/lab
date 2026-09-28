import { describe, expect, it } from "vitest";
import { dampingForDelta, wheelDistance } from "./inertial-controls-math";

describe("inertial controls time policy", () => {
  it("settles equally at 30, 60 and 120Hz", () => {
    const residuals = [30, 60, 120].map((hz) => {
      let remaining = 1;
      for (let i = 0; i < hz * 0.4; i += 1) remaining *= 1 - dampingForDelta(1 / hz);
      return remaining;
    });
    expect(residuals[0]).toBeCloseTo(residuals[1], 12);
    expect(residuals[1]).toBeCloseTo(residuals[2], 12);
    expect(residuals[0]).toBeLessThan(0.01);
    expect(dampingForDelta(1 / 120, true)).toBe(1);
  });
  it("normalizes line/page wheel units and respects zoom bounds", () => {
    expect(wheelDistance(40, 1, 1, 800, 1, 8, 90)).toBe(wheelDistance(40, 16, 0, 800, 1, 8, 90));
    expect(wheelDistance(40, 1, 2, 800, 1, 8, 90)).toBe(wheelDistance(40, 800, 0, 800, 1, 8, 90));
    expect(wheelDistance(89, 10000, 0, 800, 1, 8, 90)).toBe(90);
    expect(wheelDistance(8, -10000, 0, 800, 1, 8, 90)).toBe(8);
  });
});
