import { describe, expect, it } from "vitest";

import {
  NODE_DEPTH_MAX_WASH,
  NODE_DEPTH_MIN_WASH,
  nodeDepthWash,
  nodeFogRange,
} from "./node-depth";

describe("Synapsis node depth cue", () => {
  it("adapts a finite fog range around the live camera distance", () => {
    expect(nodeFogRange(52)).toEqual({ near: 42, far: 64 });
    expect(nodeFogRange(Number.NaN)).toEqual({ near: 1, far: 13 });
  });

  it("keeps near nodes strong and washes distant nodes monotonically", () => {
    const distance = 52;
    const near = nodeDepthWash(42, distance);
    const middle = nodeDepthWash(52, distance);
    const far = nodeDepthWash(64, distance);
    expect(near).toBe(NODE_DEPTH_MIN_WASH);
    expect(middle).toBeGreaterThan(near);
    expect(far).toBe(NODE_DEPTH_MAX_WASH);
  });

  it("clamps the cue outside its depth range", () => {
    expect(nodeDepthWash(-100, 52)).toBe(NODE_DEPTH_MIN_WASH);
    expect(nodeDepthWash(100, 52)).toBe(NODE_DEPTH_MAX_WASH);
  });
});
