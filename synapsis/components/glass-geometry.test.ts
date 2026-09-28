import { describe, expect, it } from "vitest";
import { writeGlassPanelBounds } from "./glass-geometry";

describe("glass masks follow actual panel and canvas geometry", () => {
  it("maps an offset canvas into a retina framebuffer with inverted Y", () => {
    const out = new Float32Array(4);
    expect(writeGlassPanelBounds(out,
      { left: 30, top: 50, width: 100, height: 200 },
      { left: 10, top: 20, width: 390, height: 844 }, 780, 1688)).toBe(true);
    expect(Array.from(out)).toEqual([140, 1428, 100, 200]);
  });
  it("keeps a partially visible sheet's true dimensions rather than changing its lens", () => {
    const out = new Float32Array(4);
    expect(writeGlassPanelBounds(out,
      { left: 0, top: 600, width: 390, height: 400 },
      { left: 0, top: 0, width: 390, height: 844 }, 390, 844)).toBe(true);
    expect(Array.from(out)).toEqual([195, 44, 195, 200]);
  });
  it("skips collapsed and fully offscreen panels for the no-panel render path", () => {
    const out = new Float32Array(4);
    const canvas = { left: 0, top: 0, width: 390, height: 844 };
    expect(writeGlassPanelBounds(out, { left: 0, top: 0, width: 0, height: 100 }, canvas, 390, 844)).toBe(false);
    expect(writeGlassPanelBounds(out, { left: 390, top: 0, width: 100, height: 100 }, canvas, 390, 844)).toBe(false);
    expect(writeGlassPanelBounds(out, { left: 0, top: 844, width: 100, height: 100 }, canvas, 390, 844)).toBe(false);
  });
});
