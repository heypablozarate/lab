export function mapHotspotToContainer({
  canvasRect,
  containerRect,
  hotspot,
  master,
  motionOffset = { x: 0, y: 0 },
  minimumTarget = 44,
}) {
  if (!(master.width > 0) || !(master.height > 0)) {
    throw new RangeError("El plano maestro debe tener dimensiones positivas");
  }

  const width = Math.max(
    (hotspot.width / master.width) * canvasRect.width,
    minimumTarget,
  );
  const height = Math.max(
    (hotspot.height / master.height) * canvasRect.height,
    minimumTarget,
  );
  const centerX = canvasRect.left - containerRect.left
    + (hotspot.x / master.width) * canvasRect.width
    + motionOffset.x;
  const centerY = canvasRect.top - containerRect.top
    + (hotspot.y / master.height) * canvasRect.height
    + motionOffset.y;

  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}
