"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls as Controls } from "three-stdlib";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { dampingForDelta, wheelDistance } from "./inertial-controls-math";

export type InertialControlsHandle = Controls & { cancelMotion: () => void };
type Props = {
  enablePan?: boolean;
  enableDamping?: boolean;
  /** Accepted for call-site compatibility; settling is time-based (80ms tau). */
  dampingFactor?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  onStart?: () => void;
  onEnd?: () => void;
};
type Runtime = ReturnType<typeof createRuntime>;

function createRuntime(camera: PerspectiveCamera) {
  const controls = new Controls(camera) as InertialControlsHandle;
  const update = controls.update.bind(controls);
  const runtime = {
    controls, update, camera, props: {} as Props,
    desired: null as number | null, flush: false,
    point: new Vector2(), ray: new Raycaster(), plane: new Plane(),
    before: new Vector3(), after: new Vector3(), direction: new Vector3(),
    offset: new Vector3(), savedPosition: new Vector3(), savedTarget: new Vector3(),
    touches: new Map<number, Vector2>(), pinchDistance: 0,
    activePointers: new Set<number>(), gestureActive: false,
    continuation: null as number | null, continuationTheta: 0, continuationPhi: 0,
  };
  // Stock pointer handlers call update synchronously. Queue their accumulated
  // rotate/pan deltas until our single priority -1 update instead.
  controls.update = () => {};
  controls.enableZoom = false;
  controls.cancelMotion = () => { runtime.desired = null; runtime.flush = true; };
  return runtime;
}

function configure(runtime: Runtime, props: Props) {
  runtime.props = props;
  const c = runtime.controls;
  c.enablePan = props.enablePan ?? false;
  c.enableDamping = props.enableDamping ?? true;
  c.minPolarAngle = props.minPolarAngle ?? 0;
  c.maxPolarAngle = props.maxPolarAngle ?? Math.PI;
  c.rotateSpeed = props.rotateSpeed ?? 1;
  c.minDistance = props.minDistance ?? 8;
  c.maxDistance = props.maxDistance ?? 90;
}

function setPoint(runtime: Runtime, element: HTMLElement, x: number, y: number) {
  const rect = element.getBoundingClientRect();
  runtime.point.set(((x - rect.left) / Math.max(1, rect.width)) * 2 - 1, 1 - ((y - rect.top) / Math.max(1, rect.height)) * 2);
}

function connect(runtime: Runtime, element: HTMLElement) {
  const c = runtime.controls;
  const start = () => {
    runtime.desired = null;
    if (!runtime.gestureActive) runtime.props.onStart?.();
    runtime.gestureActive = true;
  };
  const end = () => {
    // Stock emits end for each lifted finger, including a 2→1 transition.
    if (runtime.activePointers.size > 0) return;
    if (runtime.gestureActive) runtime.props.onEnd?.();
    runtime.gestureActive = false;
  };
  const wheel = (event: WheelEvent) => {
    if (!c.enabled) return;
    event.preventDefault();
    const standalone = !runtime.gestureActive;
    if (standalone) runtime.props.onStart?.();
    setPoint(runtime, element, event.clientX, event.clientY);
    runtime.desired = wheelDistance(runtime.desired ?? c.getDistance(), event.deltaY, event.deltaMode, element.clientHeight, runtime.props.zoomSpeed ?? 1, c.minDistance, c.maxDistance);
    if (standalone) runtime.props.onEnd?.();
  };
  const down = (event: PointerEvent) => {
    if (!c.enabled) return;
    runtime.activePointers.add(event.pointerId);
    runtime.continuation = null;
    if (event.pointerType !== "touch") return;
    runtime.touches.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    if (runtime.touches.size === 2) {
      const [a, b] = [...runtime.touches.values()];
      runtime.pinchDistance = a.distanceTo(b);
    }
  };
  const move = (event: PointerEvent) => {
    const point = runtime.touches.get(event.pointerId);
    if (!point || !c.enabled) return;
    const dx = event.clientX - point.x;
    const dy = event.clientY - point.y;
    point.set(event.clientX, event.clientY);
    if (runtime.continuation === event.pointerId && runtime.touches.size === 1) {
      // Public angle setters update the stock spherical deltas without replaying
      // events. Stock is in NONE after a finger lift, so it cannot double-apply.
      const scale = 2 * Math.PI * c.rotateSpeed / Math.max(1, element.clientHeight);
      runtime.continuationTheta -= dx * scale;
      runtime.continuationPhi = Math.max(c.minPolarAngle, Math.min(c.maxPolarAngle, runtime.continuationPhi - dy * scale));
      c.setAzimuthalAngle(runtime.continuationTheta);
      c.setPolarAngle(runtime.continuationPhi);
      return;
    }
    if (runtime.touches.size !== 2) return;
    const [a, b] = [...runtime.touches.values()];
    const distance = a.distanceTo(b);
    if (distance > 0 && runtime.pinchDistance > 0) {
      setPoint(runtime, element, (a.x + b.x) / 2, (a.y + b.y) / 2);
      runtime.desired = Math.max(c.minDistance, Math.min(c.maxDistance, (runtime.desired ?? c.getDistance()) * Math.pow(runtime.pinchDistance / distance, runtime.props.zoomSpeed ?? 1)));
    }
    runtime.pinchDistance = distance;
  };
  const up = (event: PointerEvent) => {
    if (!runtime.activePointers.delete(event.pointerId)) return;
    runtime.touches.delete(event.pointerId);
    runtime.pinchDistance = 0;
    runtime.continuation = runtime.touches.size === 1 ? runtime.touches.keys().next().value ?? null : null;
    runtime.continuationTheta = c.getAzimuthalAngle();
    runtime.continuationPhi = c.getPolarAngle();
    if (runtime.activePointers.size === 0) end();
  };
  // Capture handlers run before stock pointer processing, without suppressing
  // its one-finger rotation or two-finger pan and start/end events.
  element.addEventListener("wheel", wheel, { passive: false, capture: true });
  element.addEventListener("pointerdown", down, true);
  element.ownerDocument.addEventListener("pointermove", move, true);
  element.ownerDocument.addEventListener("pointerup", up, true);
  element.ownerDocument.addEventListener("pointercancel", up, true);
  c.addEventListener("start", start);
  c.addEventListener("end", end);
  c.connect(element);
  return () => {
    element.removeEventListener("wheel", wheel, true);
    element.removeEventListener("pointerdown", down, true);
    element.ownerDocument.removeEventListener("pointermove", move, true);
    element.ownerDocument.removeEventListener("pointerup", up, true);
    element.ownerDocument.removeEventListener("pointercancel", up, true);
    c.removeEventListener("start", start);
    c.removeEventListener("end", end);
    c.dispose();
    runtime.touches.clear();
    runtime.activePointers.clear();
    runtime.gestureActive = false;
    runtime.continuation = null;
    runtime.desired = null;
  };
}

function advance(runtime: Runtime, delta: number) {
  const { controls: c, camera } = runtime;
  if (!c.enabled) return;
  c.dampingFactor = dampingForDelta(delta, !c.enableDamping);
  // Clear inaccessible stock spherical/pan residuals without moving the
  // externally authored focus pose, using the same one update for this frame.
  if (runtime.flush) {
    runtime.savedPosition.copy(camera.position);
    runtime.savedTarget.copy(c.target);
    const damping = c.enableDamping;
    c.enableDamping = false;
    runtime.update();
    c.enableDamping = damping;
    camera.position.copy(runtime.savedPosition);
    c.target.copy(runtime.savedTarget);
    camera.lookAt(c.target);
    runtime.flush = false;
    return;
  }
  if (runtime.desired !== null) {
    const distance = c.getDistance();
    const next = distance + (runtime.desired - distance) * c.dampingFactor;
    camera.updateMatrixWorld();
    camera.getWorldDirection(runtime.direction);
    runtime.plane.setFromNormalAndCoplanarPoint(runtime.direction, c.target);
    runtime.ray.setFromCamera(runtime.point, camera);
    const anchored = runtime.ray.ray.intersectPlane(runtime.plane, runtime.before);
    runtime.offset.copy(camera.position).sub(c.target).setLength(next);
    camera.position.copy(c.target).add(runtime.offset);
    camera.updateMatrixWorld();
    if (anchored) {
      runtime.ray.setFromCamera(runtime.point, camera);
      if (runtime.ray.ray.intersectPlane(runtime.plane, runtime.after)) {
        runtime.offset.copy(runtime.before).sub(runtime.after);
        camera.position.add(runtime.offset);
        c.target.add(runtime.offset);
      }
    }
    if (Math.abs(runtime.desired - next) < 0.001) runtime.desired = null;
  }
  runtime.update();
}

/** Perspective Synapsis controls; callers must not run an additional update. */
export const InertialControls = forwardRef<InertialControlsHandle, Props>(function InertialControls(props, ref) {
  const camera = useThree((state) => state.camera);
  const element = useThree((state) => state.gl.domElement);
  const runtime = useMemo(() => createRuntime(camera as PerspectiveCamera), [camera]);
  useImperativeHandle(ref, () => runtime.controls, [runtime]);
  useEffect(() => configure(runtime, props), [runtime, props]);
  useEffect(() => connect(runtime, element), [runtime, element]);
  useFrame((_, delta) => advance(runtime, delta), -1);
  return null;
});
