export const NODE_FOG_NEAR_OFFSET = 10;
export const NODE_FOG_FAR_OFFSET = 12;
export const NODE_DEPTH_MIN_WASH = 0.04;
export const NODE_DEPTH_MAX_WASH = 0.82;

export function nodeFogRange(cameraDistance: number) {
  const distance = Number.isFinite(cameraDistance) ? Math.max(1, cameraDistance) : 1;
  return {
    near: Math.max(1, distance - NODE_FOG_NEAR_OFFSET),
    far: distance + NODE_FOG_FAR_OFFSET,
  };
}

export function nodeDepthWash(viewDepth: number, cameraDistance: number) {
  const { near, far } = nodeFogRange(cameraDistance);
  const t = Math.min(1, Math.max(0, (viewDepth - near) / Math.max(1e-6, far - near)));
  const eased = t * t * (3 - 2 * t);
  return NODE_DEPTH_MIN_WASH + (NODE_DEPTH_MAX_WASH - NODE_DEPTH_MIN_WASH) * eased;
}
