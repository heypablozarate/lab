import assert from "node:assert/strict";
import test from "node:test";

import { mapHotspotToContainer } from "../spatial-coordinates.js";

const master = { width: 1920, height: 1200 };
const hotspot = {
  x: 960,
  y: 600,
  width: 120,
  height: 80,
};

function mappedAtScroll(scrollLeft) {
  return mapHotspotToContainer({
    canvasRect: {
      left: -scrollLeft,
      top: 0,
      width: 1363,
      height: 852,
    },
    containerRect: {
      left: -scrollLeft,
      top: 0,
    },
    hotspot,
    master,
  });
}

test("keeps a hotspot in one panorama coordinate while its viewport scrolls", () => {
  const leftEdge = mappedAtScroll(0);
  const centered = mappedAtScroll(485);
  const rightEdge = mappedAtScroll(970);

  assert.deepEqual(centered, leftEdge);
  assert.deepEqual(rightEdge, leftEdge);
});

test("maps viewport rectangles into the overlay container coordinate space", () => {
  const mapped = mapHotspotToContainer({
    canvasRect: { left: 40, top: 25, width: 800, height: 500 },
    containerRect: { left: 12, top: 5 },
    hotspot,
    master,
    motionOffset: { x: 7, y: -3 },
  });

  assert.equal(mapped.left + mapped.width / 2, 435);
  assert.equal(mapped.top + mapped.height / 2, 267);
});

test("preserves the accessible target floor without coupling it to pan", () => {
  const mapped = mapHotspotToContainer({
    canvasRect: { left: -320, top: 0, width: 640, height: 400 },
    containerRect: { left: -320, top: 0 },
    hotspot: { ...hotspot, width: 1, height: 1 },
    master,
  });

  assert.equal(mapped.width, 44);
  assert.equal(mapped.height, 44);
});
