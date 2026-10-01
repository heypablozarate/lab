import { Box3, Quaternion, Vector3 } from "three";

/** Camera policy shared by controls and the mobile sheet. */
export const CAMERA_TRANSITION_MS = 400;

/**
 * Keep the approved constellation scale while making the former 208% camera
 * distance the new initial/reset 100% view.
 */
export const GRAPH_LAYOUT_REFERENCE_DISTANCE = 74 / 1.4;
export const DEFAULT_CAMERA_DISTANCE = GRAPH_LAYOUT_REFERENCE_DISTANCE / 2.08;

export const AMBIENT_ORBIT_IDLE_MS = 1400;
export const AMBIENT_ORBIT_DAMPING = 4.5;
export const AMBIENT_ORBIT_RATE = 0.12;
export const AMBIENT_ORBIT_Y_AMPLITUDE = 0.16;
export const AMBIENT_ORBIT_X_AMPLITUDE = 0.052;

export function cameraZoomPercent(distance: number): number {
  return Math.round(100 * DEFAULT_CAMERA_DISTANCE / Math.max(1e-6, distance));
}

export function shouldRunAmbientOrbit(input: {
  now: number;
  lastInput: number;
  reducedMotion: boolean;
  dragging: boolean;
  cameraMoving: boolean;
}): boolean {
  return !input.reducedMotion
    && !input.dragging
    && !input.cameraMoving
    && input.now - input.lastInput >= AMBIENT_ORBIT_IDLE_MS;
}

/** Keep a focused world point at the same camera-relative target while it moves. */
export function followFocusedPoint(
  cameraPosition: Vector3,
  cameraTarget: Vector3,
  worldPoint: Vector3,
  targetOffset: Vector3,
  scratch: Vector3,
): void {
  scratch.copy(worldPoint).add(targetOffset).sub(cameraTarget);
  cameraPosition.add(scratch);
  cameraTarget.add(scratch);
}

export function cameraProgress(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const t = Math.max(0, Math.min(1, elapsedMs / CAMERA_TRANSITION_MS));
  return 1 - (1 - t) ** 3;
}

export function zoomDistance(distance: number, action: "zoom-in" | "zoom-out"): number {
  return Math.max(8, Math.min(90, distance * (action === "zoom-in" ? 0.8 : 1.25)));
}

/** World-space vertical shift giving NDC y = occluded fraction. */
export function focusVerticalOffset(distance: number, fovDegrees: number, occlusion: number): number {
  const covered = Number.isFinite(occlusion) ? Math.max(0, Math.min(0.85, occlusion)) : 0;
  return distance * Math.tan((fovDegrees * Math.PI) / 360) * covered;
}

/** Fit world-space node bounds in the unobscured viewport, preserving view direction. */
export function frameNodeBounds(
  points: Vector3[], orientation: Quaternion, fovDegrees: number, aspect: number,
  viewport: { left: number; right: number; top: number; bottom: number },
): { position: Vector3; target: Vector3 } | null {
  if (!points.length) return null;
  const inverse = orientation.clone().invert();
  const bounds = new Box3().setFromPoints(points.map(point => point.clone().applyQuaternion(inverse)));
  const center = bounds.getCenter(new Vector3());
  const half = bounds.getSize(new Vector3()).multiplyScalar(0.5);
  const tanY = Math.tan(fovDegrees * Math.PI / 360), tanX = tanY * aspect;
  const width = Math.max(0.1, viewport.right - viewport.left);
  const height = Math.max(0.1, viewport.bottom - viewport.top);
  const ndcX = viewport.left + viewport.right - 1;
  const ndcY = 1 - viewport.top - viewport.bottom;
  // Depth and an inset keep near-side nodes inside the frame, not just the center plane.
  const distance = Math.max(8, Math.min(90, Math.max(
    (half.x + Math.abs(ndcX) * half.z * tanX) / (tanX * width),
    (half.y + Math.abs(ndcY) * half.z * tanY) / (tanY * height),
  ) * 1.16 + half.z));
  const target = center.add(new Vector3(-ndcX * distance * tanX, -ndcY * distance * tanY, 0)).applyQuaternion(orientation);
  return { target, position: target.clone().add(new Vector3(0, 0, distance).applyQuaternion(orientation)) };
}
