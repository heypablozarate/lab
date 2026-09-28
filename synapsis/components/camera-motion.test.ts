import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { cameraProgress, focusVerticalOffset, zoomDistance, frameNodeBounds } from "./camera-motion";

describe("Synapsis camera interaction", () => {
  it("finishes immediately for reduced motion and bounds elapsed time", () => {
    expect(cameraProgress(0, true)).toBe(1);
    expect(cameraProgress(-10, false)).toBe(0);
    expect(cameraProgress(400, false)).toBe(1);
    expect(cameraProgress(800, false)).toBe(1);
  });
  it("zooms relative to the user's current distance and respects orbit limits", () => {
    expect(zoomDistance(40, "zoom-in")).toBe(32);
    expect(zoomDistance(32, "zoom-out")).toBe(40);
    expect(zoomDistance(8, "zoom-in")).toBe(8);
    expect(zoomDistance(90, "zoom-out")).toBe(90);
  });
  it.each([0, 0.3, 0.6, 0.85])("centers the node when %s of the screen is covered", (covered) => {
    const camera = new PerspectiveCamera(45, 390 / 844, 0.1, 200);
    const shift = focusVerticalOffset(20, camera.fov, covered);
    camera.position.set(0, -shift, 20);
    camera.lookAt(0, -shift, 0);
    camera.updateMatrixWorld();
    const point = new Vector3(0, 0, 0).project(camera);
    expect((1 - point.y) / 2).toBeCloseTo((1 - covered) / 2);
  });
  it("clamps invalid occlusion without corrupting the camera", () => {
    expect(focusVerticalOffset(20, 45, Number.NaN)).toBe(0);
    expect(focusVerticalOffset(20, 45, -1)).toBe(0);
    expect(focusVerticalOffset(20, 45, 1)).toBe(focusVerticalOffset(20, 45, 0.85));
  });
});


describe("cluster framing", () => {
  it.each([1.6, 0.46])("fits the complete spatial bounds within available viewport at aspect %s", aspect => {
    const points = [-4, 4].flatMap(x => [-3, 3].flatMap(y => [-2, 2].map(z => new Vector3(x + 8, y - 5, z))));
    const viewport = { left: aspect > 1 ? 0.3 : 0.06, right: 0.94, top: 0.14, bottom: 0.86 };
    const orientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.35);
    const fit = frameNodeBounds(points, orientation, 45, aspect, viewport)!;
    const camera = new PerspectiveCamera(45, aspect, 0.1, 200);
    camera.position.copy(fit.position); camera.quaternion.copy(orientation); camera.updateMatrixWorld();
    for (const point of points) {
      const projected = point.clone().project(camera);
      const x = (projected.x + 1) / 2, y = (1 - projected.y) / 2;
      expect(x).toBeGreaterThan(viewport.left); expect(x).toBeLessThan(viewport.right);
      expect(y).toBeGreaterThan(viewport.top); expect(y).toBeLessThan(viewport.bottom);
    }
    expect(fit.position.distanceTo(fit.target)).toBeGreaterThanOrEqual(8);
  });
  it("does not invent a camera position for an empty result", () => {
    expect(frameNodeBounds([], new Quaternion(), 45, 1, { left: 0, right: 1, top: 0, bottom: 1 })).toBeNull();
  });
});
