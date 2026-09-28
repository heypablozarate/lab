import { afterEach, describe, expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import { InertialControls, type InertialControlsHandle } from "./inertial-controls";

// Run the wrapper's native event wiring against the installed real controls.
// Hooks only supply its lifecycle/frame boundary; no browser or WebGL needed.
const harness = vi.hoisted(() => ({ state: {} as Record<string, unknown>, frame: (() => {}) as (state: unknown, delta: number) => void, cleanups: [] as Array<() => void> }));
vi.mock("react", () => ({
  forwardRef: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => void | (() => void)) => { const cleanup = fn(); if (cleanup) harness.cleanups.push(cleanup); },
  useImperativeHandle: (ref: { current: unknown }, fn: () => unknown) => { ref.current = fn(); },
}));
vi.mock("@react-three/fiber", () => ({
  useThree: (select: (state: unknown) => unknown) => select(harness.state),
  useFrame: (fn: typeof harness.frame) => { harness.frame = fn; },
}));

class Surface extends EventTarget {
  ownerDocument = new EventTarget();
  style = { touchAction: "" };
  clientHeight = 600;
  clientWidth = 800;
  releasePointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
}
function pointer(target: EventTarget, type: string, id: number, x: number, y: number, pointerType = "touch") {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: id, pointerType, clientX: x, clientY: y, pageX: x, pageY: y, button: 0 });
  target.dispatchEvent(event);
}
function setup() {
  const surface = new Surface();
  const camera = new PerspectiveCamera(45, 800 / 600, 0.1, 200);
  camera.position.set(0, 0, 74);
  harness.state = { camera, gl: { domElement: surface } };
  const ref = { current: null as InertialControlsHandle | null };
  const start = vi.fn(), end = vi.fn();
  (InertialControls as unknown as (props: unknown, ref: unknown) => void)({ enablePan: true, enableDamping: false, onStart: start, onEnd: end }, ref);
  return { surface, camera, start, end, controls: ref.current! };
}
afterEach(() => { for (const cleanup of harness.cleanups.splice(0)) cleanup(); });

describe("inertial controls pointer lifecycle", () => {
  it("keeps the remaining pinch finger rotating without another pointerdown", () => {
    const { surface, controls, start, end } = setup();
    pointer(surface, "pointerdown", 1, 200, 200);
    pointer(surface, "pointerdown", 2, 300, 200);
    pointer(surface.ownerDocument, "pointerup", 2, 300, 200);
    expect(end).not.toHaveBeenCalled();
    const angle = controls.getAzimuthalAngle();
    pointer(surface.ownerDocument, "pointermove", 1, 250, 200);
    harness.frame(null, 1 / 60);
    expect(controls.getAzimuthalAngle()).not.toBe(angle);
    pointer(surface.ownerDocument, "pointerup", 1, 250, 200);
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("does not end an active mouse drag when wheel input arrives", () => {
    const { surface, start, end } = setup();
    pointer(surface, "pointerdown", 1, 200, 200, "mouse");
    const wheel = new Event("wheel", { cancelable: true });
    Object.assign(wheel, { clientX: 200, clientY: 200, deltaY: 40, deltaMode: 0 });
    surface.dispatchEvent(wheel);
    expect(start).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    pointer(surface.ownerDocument, "pointerup", 1, 200, 200, "mouse");
    expect(end).toHaveBeenCalledTimes(1);
  });
});
