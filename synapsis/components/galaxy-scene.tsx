"use client";

// The 3D constellation. Rendering budget (kickoff §5, verifiable):
// - all nodes in ONE InstancedMesh (one draw call)
// - all edges in ONE LineSegments BufferGeometry (one draw call)
// - labels are DOM spans in a fixed pool mutated from useFrame (no WebGL text)
// "Opacity" fades are color mixes toward the flat paper background, so no
// transparency sorting is ever needed. All imperative per-frame mutation lives
// in module-level helpers operating on ref-held state.

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { InertialControls, type InertialControlsHandle } from "./inertial-controls";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { GlassPass } from "./glass-pass";
import { createEdgeCurvePositions, EDGE_CURVE_SEGMENTS } from "./edge-curves";
import { focusVerticalOffset, cameraProgress, zoomDistance, frameNodeBounds } from "./camera-motion";
import type { LiquidGlassConfig } from "./liquid-glass";
import type {
  NodeStateAppearance,
  SynapsisAppearanceTokens,
  SynapsisThemeAppearance,
} from "./synapsis-appearance";

// Resolved per-theme colors. Only literal-valued tokens are read here —
// THREE.Color cannot parse color-mix() — so the edge/line color is derived in
// buildPalette with the same rule the Lab home uses (ink at ~16% over the
// background).
export type SceneTokens = SynapsisAppearanceTokens;

export type LabelPool = {
  container: HTMLDivElement | null;
  slots: HTMLSpanElement[];
  assignments: number[];
};

export type GalaxySceneProps = {
  positions: number[];
  radii: number[];
  /** Flat node-index pairs, one pair per edge. */
  edgeIndices: number[];
  tokens: SceneTokens;
  hovered: number | null;
  selected: number | null;
  neighbors: Set<number>;
  /** 1 = node is filtered out (cluster filter / search miss). */
  dimMask: Uint8Array;
  nodeTitles: string[];
  territories?: { label: string; position: [number, number, number] }[];
  territoryEls?: React.RefObject<(HTMLSpanElement | null)[]>;
  labelPool: React.RefObject<LabelPool>;
  fpsRef: React.RefObject<HTMLSpanElement | null>;
  reducedMotion: boolean;
  /** Increment id for every command, including repeated actions. */
  cameraCommand?: { id: number; action: "zoom-in" | "zoom-out" | "reset" };
  /** A cluster-only intent: searches do not move the camera. */
  clusterFrame?: { key: string; indices: number[] };
  /** Fraction of the viewport obscured by the bottom sheet. */
  mobileOcclusion?: number;
  /** Integer zoom relative to the initial default view; reported at most 10Hz. */
  onZoomChange?: (percent: number) => void;
  dpr: number;
  /** Tunable liquid-glass parameters, rendered by the WebGL GlassPass. */
  glass: LiquidGlassConfig;
  /** Scene refraction for the shared glass panels. */
  postprocessing?: boolean;
  /** Per-theme node states and universe background/effects. */
  appearance: SynapsisThemeAppearance;
  /** Live DOM refs of the glass panels (sidebar, detail panel). */
  panelEls: React.RefObject<(HTMLElement | null)[]>;
  onHover: (index: number | null) => void;
  onSelect: (index: number | null) => void;
};

const TRANSITION_MS = 260;
// Retain the approved graph scale while redefining the former 140% view as 100%.
const GRAPH_FRAMING_DISTANCE = 74;
const DEFAULT_CAMERA = new THREE.Vector3(0, 0, GRAPH_FRAMING_DISTANCE / 1.4);
const GRAPH_VISUAL_MARGIN = 7;
const FOG_NEAR = 58;
const FOG_FAR = 94;
const PULSE_STRENGTH = 0;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Palette = {
  surface: THREE.Color;
  accent: THREE.Color;
  nodes: {
    default: ResolvedNodeAppearance;
    filtered: ResolvedNodeAppearance;
    focused: ResolvedNodeAppearance;
  };
  edgeRest: THREE.Color;
  edgeFaint: THREE.Color;
};

type ResolvedNodeAppearance = {
  background: THREE.Color;
  core: THREE.Color;
  glow: THREE.Color;
};

function mixDisplayColors(base: THREE.Color, target: THREE.Color, amount: number) {
  return base.clone().convertLinearToSRGB().lerp(target.clone().convertLinearToSRGB(), amount).convertSRGBToLinear();
}

function resolveNodeAppearance(
  surface: THREE.Color,
  appearance: NodeStateAppearance,
): ResolvedNodeAppearance {
  const background = mixDisplayColors(surface, new THREE.Color(appearance.backgroundColor), appearance.backgroundOpacity);
  return {
    background,
    core: mixDisplayColors(background, new THREE.Color(appearance.coreColor), appearance.coreOpacity),
    // Glow opacity must resolve from the universe surface, not the node body.
    // The body and glow intentionally share a default hue, so mixing from the
    // body made the opacity dial a no-op whenever those hues matched.
    glow: mixDisplayColors(surface, new THREE.Color(appearance.glowColor), appearance.glowOpacity),
  };
}

function buildPalette(tokens: SceneTokens, appearance: SynapsisThemeAppearance): Palette {
  const surface = new THREE.Color(appearance.universe.backgroundColor);
  const ink = new THREE.Color(tokens.ink);
  const surfaceBrightness = (surface.r + surface.g + surface.b) / 3;
  const isDark = surfaceBrightness < 0.18;

  // The dsaints-style graph field needs visible hairlines in dark mode while
  // staying quiet on paper. Keep the same token source, but tune the resolved
  // mix per theme because WebGL cannot parse CSS color-mix().
  const edgeRest = mixDisplayColors(surface, ink, isDark ? 0.14 : 0.12);
  const edgeFaint = mixDisplayColors(surface, ink, 0.025);

  return {
    surface,
    accent: new THREE.Color(tokens.accent),
    nodes: {
      default: resolveNodeAppearance(surface, appearance.nodes.default),
      filtered: resolveNodeAppearance(surface, appearance.nodes.filtered),
      focused: resolveNodeAppearance(surface, appearance.nodes.focused),
    },
    edgeRest,
    edgeFaint,
  };
}

type NodeUniforms = {
  uTime: { value: number };
  uPulseStrength: { value: number };
  uMotionEnabled: { value: number };
  uSurface: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
};

function createNodeMaterial(): THREE.ShaderMaterial & { uniforms: NodeUniforms } {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulseStrength: { value: PULSE_STRENGTH },
      uMotionEnabled: { value: 1 },
      uSurface: { value: new THREE.Color() },
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: FOG_FAR },
    },
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
  }) as THREE.ShaderMaterial & { uniforms: NodeUniforms };
}

function createNodeGeometry(nodeCount: number) {
  const geometry = new THREE.SphereGeometry(1, 20, 12);
  const pulsePhase = new Float32Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) {
    pulsePhase[i] = ((i * 0.61803398875) % 1) * Math.PI * 2;
  }
  geometry.setAttribute("pulsePhase", new THREE.InstancedBufferAttribute(pulsePhase, 1));
  const selectedAttribute = new THREE.InstancedBufferAttribute(new Float32Array(nodeCount), 1);
  selectedAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("nodeSelected", selectedAttribute);
  for (const name of ["nodeBackground", "nodeCore", "nodeGlow"]) {
    const colorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(nodeCount * 3), 3);
    colorAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, colorAttribute);
  }
  return geometry;
}

function writeNodeTheme(material: THREE.ShaderMaterial & { uniforms: NodeUniforms }, palette: Palette) {
  material.uniforms.uSurface.value.copy(palette.surface);
}

function writeNodeFrame(
  material: THREE.ShaderMaterial & { uniforms: NodeUniforms },
  elapsed: number,
  reducedMotion: boolean,
  distance: number,
) {
  material.uniforms.uFogNear.value = Math.max(1, distance - 16);
  material.uniforms.uFogFar.value = distance + 20;
  material.uniforms.uTime.value = elapsed;
  material.uniforms.uPulseStrength.value = reducedMotion ? 0 : PULSE_STRENGTH;
  material.uniforms.uMotionEnabled.value = reducedMotion ? 0 : 1;
}

// ---- Interruptible cubic color transition, held in a ref and mutated imperatively ----

type TransitionState = {
  backgroundFrom: Float32Array;
  backgroundTarget: Float32Array;
  coreFrom: Float32Array;
  coreTarget: Float32Array;
  glowFrom: Float32Array;
  glowTarget: Float32Array;
  edgeFrom: Float32Array;
  edgeTarget: Float32Array;
  start: number;
  active: boolean;
};

function createTransitionState(nodeCount: number, edgeCount: number): TransitionState {
  return {
    backgroundFrom: new Float32Array(nodeCount * 3),
    backgroundTarget: new Float32Array(nodeCount * 3),
    coreFrom: new Float32Array(nodeCount * 3),
    coreTarget: new Float32Array(nodeCount * 3),
    glowFrom: new Float32Array(nodeCount * 3),
    glowTarget: new Float32Array(nodeCount * 3),
    edgeFrom: new Float32Array(edgeCount * EDGE_CURVE_SEGMENTS * 2 * 3),
    edgeTarget: new Float32Array(edgeCount * EDGE_CURVE_SEGMENTS * 2 * 3),
    start: 0,
    active: false,
  };
}

type InteractionSnapshot = {
  hovered: number | null;
  selected: number | null;
  neighbors: Set<number>;
  dimMask: Uint8Array;
};

function beginTransition(
  state: TransitionState,
  nodeGeometry: THREE.BufferGeometry,
  edges: THREE.LineSegments,
  palette: Palette,
  edgeIndices: number[],
  snapshot: InteractionSnapshot,
) {
  const { hovered, selected, neighbors, dimMask } = snapshot;
  const nodeCount = state.backgroundFrom.length / 3;
  const edgeCount = edgeIndices.length / 2;
  const hasSelection = selected !== null;
  const backgroundAttr = nodeGeometry.getAttribute("nodeBackground") as THREE.InstancedBufferAttribute;
  const coreAttr = nodeGeometry.getAttribute("nodeCore") as THREE.InstancedBufferAttribute;
  const glowAttr = nodeGeometry.getAttribute("nodeGlow") as THREE.InstancedBufferAttribute;

  const selectedAttribute = nodeGeometry.getAttribute("nodeSelected") as THREE.InstancedBufferAttribute;
  const selectedValues = selectedAttribute.array as Float32Array;
  selectedValues.fill(0);
  if (selected !== null) selectedValues[selected] = 1;
  selectedAttribute.needsUpdate = true;

  state.backgroundFrom.set(backgroundAttr.array as Float32Array);
  state.coreFrom.set(coreAttr.array as Float32Array);
  state.glowFrom.set(glowAttr.array as Float32Array);
  const edgeColorAttr = edges.geometry.getAttribute("color") as THREE.BufferAttribute;
  state.edgeFrom.set(edgeColorAttr.array as Float32Array);

  for (let i = 0; i < nodeCount; i += 1) {
    let node: ResolvedNodeAppearance;
    if (hasSelection) {
      node = i === selected ? palette.nodes.focused : neighbors.has(i) ? palette.nodes.default : palette.nodes.filtered;
    } else if (hovered === i) {
      node = palette.nodes.focused;
    } else if (dimMask[i]) {
      node = palette.nodes.filtered;
    } else {
      node = palette.nodes.default;
    }
    node.background.toArray(state.backgroundTarget, i * 3);
    node.core.toArray(state.coreTarget, i * 3);
    node.glow.toArray(state.glowTarget, i * 3);
  }

  for (let e = 0; e < edgeCount; e += 1) {
    const a = edgeIndices[e * 2];
    const b = edgeIndices[e * 2 + 1];
    let color: THREE.Color;
    if (hasSelection) {
      color = a === selected || b === selected ? palette.accent : palette.edgeFaint;
    } else if (dimMask[a] || dimMask[b]) {
      color = palette.edgeFaint;
    } else {
      color = palette.edgeRest;
    }
    for (let segment = 0; segment < EDGE_CURVE_SEGMENTS; segment += 1) {
      const offset = (e * EDGE_CURVE_SEGMENTS + segment) * 6;
      color.toArray(state.edgeTarget, offset);
      color.toArray(state.edgeTarget, offset + 3);
    }
  }

  state.start = performance.now();
  state.active = true;
}

function applyTransition(state: TransitionState, nodeGeometry: THREE.BufferGeometry, edges: THREE.LineSegments, reducedMotion: boolean) {
  if (!state.active) return;
  const t = reducedMotion ? 1 : Math.min(1, (performance.now() - state.start) / TRANSITION_MS);
  const e = easeOutCubic(t);
  const nodeTransitions = [
    ["nodeBackground", state.backgroundFrom, state.backgroundTarget],
    ["nodeCore", state.coreFrom, state.coreTarget],
    ["nodeGlow", state.glowFrom, state.glowTarget],
  ] as const;
  for (const [name, from, target] of nodeTransitions) {
    const attribute = nodeGeometry.getAttribute(name) as THREE.InstancedBufferAttribute;
    const values = attribute.array as Float32Array;
    for (let i = 0; i < values.length; i += 1) {
      values[i] = from[i] + (target[i] - from[i]) * e;
    }
    attribute.needsUpdate = true;
  }
  const attr = edges.geometry.getAttribute("color") as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 1) {
    arr[i] = state.edgeFrom[i] + (state.edgeTarget[i] - state.edgeFrom[i]) * e;
  }
  attr.needsUpdate = true;
  if (t >= 1) state.active = false;
}

// ---- Pooled DOM labels, projected and mutated once per frame ----

type LabelFrameArgs = {
  positions: number[];
  nodeTitles: string[];
  matrixWorld: THREE.Matrix4;
  viewDistance: number;
  camera: THREE.Camera;
  snapshot: InteractionSnapshot;
  panelEls: (HTMLElement | null)[];
  worldPos: THREE.Vector3;
  projected: THREE.Vector3;
  scratch: LabelScratch;
};

type LabelCandidate = {
  index: number;
  text: string;
  x: number;
  y: number;
  opacity: number;
  active: boolean;
  score: number;
};

type LabelScratch = {
  byNode: LabelCandidate[];
  ranked: LabelCandidate[];
  panelRects: DOMRect[];
  accepted: LabelCandidate[];
  occupied: { left: number; top: number; right: number; bottom: number }[];
  measuredWidths: Map<string, number>;
  measure: CanvasRenderingContext2D | null;
  font: string;
  widths: Float32Array;
  heights: Float32Array;
};

function createLabelScratch(nodeCount: number): LabelScratch {
  return {
    byNode: Array.from({ length: nodeCount }, (_, index) => ({
      index, text: "", x: 0, y: 0, opacity: 0, active: false, score: 0,
    })),
    ranked: [], panelRects: [], accepted: [], occupied: [],
    measuredWidths: new Map(), measure: null, font: "",
    widths: new Float32Array(25), heights: new Float32Array(25),
  };
}

function compareLabels(a: LabelCandidate, b: LabelCandidate) {
  return a.score - b.score || a.index - b.index;
}

function updateLabels(pool: LabelPool, args: LabelFrameArgs) {
  if (!pool.container) return;
  const { positions, nodeTitles, matrixWorld, camera, snapshot, panelEls, worldPos, projected, scratch, viewDistance } = args;
  const { selected, hovered, neighbors, dimMask } = snapshot;
  const containerRect = pool.container.getBoundingClientRect();
  const { width, height } = containerRect;
  const panelRects = scratch.panelRects;
  panelRects.length = 0;
  for (const panel of panelEls) if (panel) panelRects.push(panel.getBoundingClientRect());
  const candidates = scratch.ranked;
  candidates.length = 0;
  // Read every slot before any text/style mutation: one layout read phase,
  // not one forced layout per label. New text sizes are available next frame.
  for (let slot = 0; slot < pool.slots.length; slot += 1) {
    scratch.widths[slot] = pool.slots[slot]?.offsetWidth ?? 0;
    scratch.heights[slot] = pool.slots[slot]?.offsetHeight ?? 0;
  }

  for (let nodeIndex = 0; nodeIndex < nodeTitles.length; nodeIndex += 1) {
    if (selected !== null) {
      if (nodeIndex !== selected && !neighbors.has(nodeIndex)) continue;
    } else if (dimMask[nodeIndex] === 1 && nodeIndex !== hovered) continue;
    worldPos.fromArray(positions, nodeIndex * 3).applyMatrix4(matrixWorld);
    const depth = worldPos.distanceTo(camera.position);
    projected.copy(worldPos).project(camera);
    if (projected.z > 1) continue;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const onScreen = x > -80 && x < width + 80 && y > -60 && y < height + 60;
    if (!onScreen && nodeIndex !== selected && nodeIndex !== hovered) continue;

    const fogFade = THREE.MathUtils.clamp((viewDistance + 20 - depth) / 36, 0.2, 1);
    const active = nodeIndex === selected || nodeIndex === hovered;
    const connected = selected !== null && neighbors.has(nodeIndex);
    const centerPenalty = Math.abs(projected.x) * 6 + Math.abs(projected.y) * 3;
    const priority = active ? -10000 : connected ? -5000 : 0;
    const candidate = scratch.byNode[nodeIndex];
    candidate.text = nodeTitles[nodeIndex];
    candidate.x = x;
    candidate.y = y;
    candidate.opacity = 0.92 * (active || connected ? 1 : fogFade);
    candidate.active = active || connected;
    candidate.score = priority + depth + centerPenalty;
    candidates.push(candidate);
  }

  candidates.sort(compareLabels);
  const accepted = scratch.accepted;
  const occupied = scratch.occupied;
  accepted.length = 0;
  occupied.length = 0;
  const mobile = width <= 720;
  const font = pool.slots[0] ? getComputedStyle(pool.slots[0]).font : "";
  if (font !== scratch.font) { scratch.font = font; scratch.measuredWidths.clear(); }
  if (!scratch.measure) scratch.measure = document.createElement("canvas").getContext("2d");
  if (scratch.measure && font) scratch.measure.font = font;
  const limit = selected === null ? (mobile ? 3 : 6) : 10;
  for (const candidate of candidates) {
    const isSelected = candidate.index === selected;
    let measuredWidth = scratch.measuredWidths.get(candidate.text);
    if (measuredWidth === undefined) {
      measuredWidth = scratch.measure?.measureText(candidate.text).width ?? candidate.text.length * 8;
      scratch.measuredWidths.set(candidate.text, measuredWidth);
    }
    const labelWidth = Math.min(mobile ? Math.min(160, width * 0.42) : 256, measuredWidth);
    const labelHeight = 20;
    const left = containerRect.left + candidate.x + (isSelected ? 12 : -labelWidth / 2);
    const top = containerRect.top + candidate.y + (isSelected ? 12 : -labelHeight * 1.4);
    const right = left + labelWidth;
    const bottom = top + labelHeight;
    if (left < containerRect.left + 20 || right > containerRect.right - 20 ||
        top < containerRect.top + (mobile ? 130 : 80) || bottom > containerRect.bottom - 100) continue;
    const overlaps = (rect: { left: number; top: number; right: number; bottom: number }) =>
      right + 8 > rect.left && left - 8 < rect.right && bottom + 8 > rect.top && top - 8 < rect.bottom;
    if (panelRects.some(overlaps) || occupied.some(overlaps)) continue;
    accepted.push(candidate);
    occupied.push({ left, top, right, bottom });
    if (accepted.length >= limit) break;
  }

  for (let s = 0; s < pool.slots.length; s += 1) {
    const span = pool.slots[s];
    if (!span) continue;
    const candidate = accepted[s];
    const nodeIndex = candidate?.index ?? -1;
    if (pool.assignments[s] !== nodeIndex) {
      pool.assignments[s] = nodeIndex;
      span.textContent = candidate?.text ?? "";
    }
    if ((span.dataset.active === "true") !== Boolean(candidate?.active)) {
      span.dataset.active = candidate?.active ? "true" : "false";
    }
    const isSelected = nodeIndex !== -1 && nodeIndex === selected;
    if ((span.dataset.selected === "true") !== isSelected) {
      span.dataset.selected = isSelected ? "true" : "false";
    }
    if (!candidate) {
      if (span.dataset.glass === "true") span.dataset.glass = "false";
      span.style.opacity = "0";
      continue;
    }
    const labelWidth = scratch.widths[s];
    const labelHeight = scratch.heights[s];
    const labelLeft = containerRect.left + candidate.x + (isSelected ? 12 : -labelWidth / 2);
    const labelTop = containerRect.top + candidate.y + (isSelected ? 12 : -labelHeight * 1.4);
    const labelRight = labelLeft + labelWidth;
    const labelBottom = labelTop + labelHeight;
    let underGlass = false;
    for (const rect of panelRects) {
      if (labelRight >= rect.left && labelLeft <= rect.right && labelBottom >= rect.top && labelTop <= rect.bottom) {
        underGlass = true;
        break;
      }
    }
    if ((span.dataset.glass === "true") !== underGlass) {
      span.dataset.glass = underGlass ? "true" : "false";
    }
    span.style.opacity = String(candidate.opacity * (underGlass ? 0 : 1));
    span.style.transform = `translate3d(${candidate.x.toFixed(1)}px, ${candidate.y.toFixed(1)}px, 0) ${isSelected ? "translate(12px, 12px)" : "translate(-50%, -140%)"}`;
  }
}

function writeTerritoryLabel(label: HTMLSpanElement, x: number, y: number, hidden: boolean) {
  label.style.opacity = hidden ? "0" : "0.7";
  label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateX(-50%)`;
}

function updateFpsMeter(el: HTMLSpanElement, window: { frames: number; last: number }, elapsed: number) {
  window.frames += 1;
  if (elapsed - window.last >= 0.5) {
    el.textContent = `${Math.round(window.frames / (elapsed - window.last))} fps`;
    window.frames = 0;
    window.last = elapsed;
  }
}

const nodeVertexShader = /* glsl */ `
attribute vec3 nodeBackground;
attribute vec3 nodeCore;
attribute vec3 nodeGlow;
attribute float pulsePhase;
attribute float nodeSelected;

uniform float uTime;
uniform float uPulseStrength;
uniform float uMotionEnabled;

varying vec3 vBackground;
varying vec3 vCore;
varying vec3 vGlow;
varying vec3 vViewNormal;
varying float vDepth;
varying float vBreath;
varying float vSelected;

void main() {
  vSelected = nodeSelected;
  vBackground = nodeBackground;
  vCore = nodeCore;
  vGlow = nodeGlow;
  vViewNormal = normalize(normalMatrix * normal);

  vBreath = 0.0;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position * 3.0, 1.0);
  vDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const nodeFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uSurface;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vBackground;
varying vec3 vCore;
varying vec3 vGlow;
varying vec3 vViewNormal;
varying float vDepth;
varying float vBreath;
varying float vSelected;

void main() {
  float radial = sqrt(max(0.0, 1.0 - normalize(vViewNormal).z * normalize(vViewNormal).z));
  float aa = max(fwidth(radial), 0.002);
  float body = 1.0 - smoothstep(0.333 - aa, 0.333 + aa, radial);
  float halo = exp(-radial * radial * 6.0) * (1.0 - body);
  float ring = (1.0 - smoothstep(aa, aa * 2.0, abs(radial - 0.82))) * vSelected;
  vec3 color = mix(uSurface, vGlow, halo);
  color = mix(color, vBackground, body);
  color = mix(color, vGlow, ring);
  float depthFade = smoothstep(uFogNear, uFogFar, vDepth) * (1.0 - vSelected);
  gl_FragColor = vec4(mix(color, uSurface, depthFade), max(body, max(halo, ring)));
  #include <colorspace_fragment>
}
`;

function GalaxyContents(props: GalaxySceneProps) {
  const {
    positions,
    radii,
    edgeIndices,
    tokens,
    appearance,
    hovered,
    selected,
    neighbors,
    dimMask,
    nodeTitles,
    labelPool,
    fpsRef,
    reducedMotion,
    cameraCommand,
    clusterFrame,
    mobileOcclusion = 0,
    onHover,
    onSelect,
  } = props;

  const nodeCount = radii.length;
  const edgeCount = edgeIndices.length / 2;

  const instRef = useRef<THREE.InstancedMesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<InertialControlsHandle>(null);
  const draggingRef = useRef(false);
  const drift = useRef({ phase: 0, weight: 0, lastInput: 0 });
  const transitionRef = useRef<TransitionState | null>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const framing = useMemo(() => {
    if (positions.length === 0) return { scale: 1, x: 0 };
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      left = Math.min(left, positions[i]); right = Math.max(right, positions[i]);
      bottom = Math.min(bottom, positions[i + 1]); top = Math.max(top, positions[i + 1]);
    }
    const pixelsPerUnit = size.height / (2 * DEFAULT_CAMERA.length() * Math.tan(Math.PI / 8));
    const mobile = size.width <= 720;
    const availableWidth = mobile ? size.width - 24 : size.width - 380;
    const availableHeight = mobile ? size.height - 300 : size.height - 260;
    const visualWidth = right - left + GRAPH_VISUAL_MARGIN * 2;
    const visualHeight = top - bottom + GRAPH_VISUAL_MARGIN * 2;
    const scale = Math.min(
      1,
      Math.max(0.18, availableWidth / Math.max(1, visualWidth * pixelsPerUnit)),
      Math.max(0.18, availableHeight / Math.max(1, visualHeight * pixelsPerUnit)),
    );
    const opticalOffset = mobile ? 0 : 50 / pixelsPerUnit;
    return { scale, x: opticalOffset - (left + right) * 0.5 * scale };
  }, [positions, size.width, size.height]);

  const palette = useMemo(() => buildPalette(tokens, appearance), [tokens, appearance]);
  const nodeGeometry = useMemo(() => createNodeGeometry(nodeCount), [nodeCount]);
  const nodeMaterial = useMemo(() => createNodeMaterial(), []);
  const labelScratch = useMemo(() => createLabelScratch(nodeCount), [nodeCount]);

  useEffect(() => () => nodeGeometry.dispose(), [nodeGeometry]);
  useEffect(() => () => nodeMaterial.dispose(), [nodeMaterial]);

  useEffect(() => {
    writeNodeTheme(nodeMaterial, palette);
  }, [nodeMaterial, palette]);

  const edgeGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const pos = createEdgeCurvePositions(positions, edgeIndices);
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(edgeCount * EDGE_CURVE_SEGMENTS * 2 * 3), 3));
    return geometry;
  }, [edgeIndices, positions, edgeCount]);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  // Static instance matrices (position + relevance scale) and initial colors.
  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < nodeCount; i += 1) {
      const r = radii[i];
      m.makeScale(r, r, r);
      m.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    const initialNodeAttributes = [
      ["nodeBackground", palette.nodes.default.background],
      ["nodeCore", palette.nodes.default.core],
      ["nodeGlow", palette.nodes.default.glow],
    ] as const;
    for (const [name, color] of initialNodeAttributes) {
      const attribute = nodeGeometry.getAttribute(name) as THREE.InstancedBufferAttribute;
      const values = attribute.array as Float32Array;
      for (let i = 0; i < nodeCount; i += 1) color.toArray(values, i * 3);
      attribute.needsUpdate = true;
    }

    const attr = edgeGeometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let e = 0; e < edgeCount * EDGE_CURVE_SEGMENTS * 2; e += 1) palette.edgeRest.toArray(arr, e * 3);
    attr.needsUpdate = true;
  }, [nodeCount, edgeCount, positions, radii, palette, edgeGeometry, nodeGeometry]);

  // Replay the color transition toward new targets whenever interaction
  // state changes.
  useEffect(() => {
    const inst = instRef.current;
    const edges = edgesRef.current;
    if (!inst || !edges) return;
    if (!transitionRef.current) {
      transitionRef.current = createTransitionState(nodeCount, edgeCount);
    }
    beginTransition(transitionRef.current, nodeGeometry, edges, palette, edgeIndices, {
      hovered,
      selected,
      neighbors,
      dimMask,
    });
  }, [hovered, selected, neighbors, dimMask, palette, edgeIndices, nodeCount, edgeCount, nodeGeometry]);

  // Schedule once per intent; orbit/pinch cancels rather than fighting focus.
  const cameraMotion = useRef({
    active: false, start: 0,
    from: new THREE.Vector3(), to: new THREE.Vector3(),
    targetFrom: new THREE.Vector3(), targetTo: new THREE.Vector3(),
    rotationFrom: new THREE.Quaternion(), rotationTo: new THREE.Quaternion(),
    savedPosition: new THREE.Vector3(), savedTarget: new THREE.Vector3(),
    savedRotation: new THREE.Quaternion(), hasSaved: false,
    previousSelection: null as number | null,
    commandId: undefined as number | undefined,
    clusterKey: clusterFrame?.key ?? "",
    focusCancelled: false,
  });

  useEffect(() => {
    const controls = controlsRef.current;
    const group = groupRef.current;
    if (!controls || !group) return;
    const motion = cameraMotion.current;
    const selectionChanged = motion.previousSelection !== selected;
    const clusterChanged = motion.clusterKey !== (clusterFrame?.key ?? "");
    const isCommand = cameraCommand !== undefined && motion.commandId !== cameraCommand.id;
    // Resizing a sheet must not take control back after the user's gesture.
    if (!selectionChanged && !isCommand && !clusterChanged && (selected === null || motion.focusCancelled)) return;
    controls.cancelMotion();
    motion.from.copy(camera.position);
    motion.targetFrom.copy(controls.target);
    motion.rotationFrom.copy(group.quaternion);
    motion.rotationTo.copy(group.quaternion);
    motion.to.copy(camera.position);
    motion.targetTo.copy(controls.target);
    if (selectionChanged && selected !== null && !motion.hasSaved) {
      motion.savedPosition.copy(camera.position);
      motion.savedTarget.copy(controls.target);
      motion.savedRotation.copy(group.quaternion);
      motion.hasSaved = true;
    }
    if (selectionChanged) motion.focusCancelled = false;
    motion.clusterKey = clusterFrame?.key ?? "";
    if (clusterChanged) {
      motion.hasSaved = false;
      motion.focusCancelled = false;
      if (!clusterFrame?.indices.length) {
        motion.to.copy(DEFAULT_CAMERA);
        motion.targetTo.set(0, 0, 0);
        motion.rotationTo.identity();
      } else {
        group.position.x = framing.x;
        group.scale.setScalar(framing.scale);
        group.updateMatrixWorld();
        const points = clusterFrame.indices.flatMap(index => {
          const center = new THREE.Vector3().fromArray(positions, index * 3);
          const radius = radii[index] ?? 0;
          return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
            center.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(radius)).applyMatrix4(group.matrixWorld))));
        });
        const canvas = controls.domElement?.getBoundingClientRect();
        const sidebar = props.panelEls.current?.[0]?.getBoundingClientRect();
        const left = size.width > 720 && sidebar && canvas ? Math.min(0.65, (sidebar.right - canvas.left + 24) / size.width) : 0.06;
        const fit = frameNodeBounds(points, camera.quaternion, (camera as THREE.PerspectiveCamera).fov, size.width / size.height,
          { left, right: 0.94, top: 0.14, bottom: 0.86 });
        if (fit) { motion.to.copy(fit.position); motion.targetTo.copy(fit.target); }
      }
    } else if (isCommand) {
      motion.commandId = cameraCommand.id;
      motion.focusCancelled = true;
      if (cameraCommand.action === "reset") {
        motion.to.copy(DEFAULT_CAMERA);
        motion.targetTo.set(0, 0, 0);
        motion.rotationTo.identity();
        motion.savedPosition.copy(DEFAULT_CAMERA);
        motion.savedTarget.set(0, 0, 0);
        motion.savedRotation.identity();
      } else {
        const distance = zoomDistance(camera.position.distanceTo(controls.target), cameraCommand.action);
        motion.to.sub(controls.target).setLength(distance).add(controls.target);
      }
    } else if (selected !== null) {
      group.position.x = framing.x;
      group.scale.setScalar(framing.scale);
      group.updateMatrixWorld();
      motion.targetTo.fromArray(positions, selected * 3).applyMatrix4(group.matrixWorld);
      const away = new THREE.Vector3().copy(camera.position).sub(controls.target);
      if (away.lengthSq() < 1e-6) away.copy(DEFAULT_CAMERA);
      const distance = camera.position.distanceTo(controls.target);
      away.setLength(distance);
      // Translate eye and target down camera-up so the node projects above
      // the sheet, at the center of the remaining visible viewport.
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const offset = focusVerticalOffset(distance, (camera as THREE.PerspectiveCamera).fov, mobileOcclusion);
      motion.targetTo.addScaledVector(up, -offset);
      motion.to.copy(motion.targetTo).add(away);
    } else if (motion.hasSaved) {
      motion.to.copy(motion.savedPosition);
      motion.targetTo.copy(motion.savedTarget);
      motion.rotationTo.copy(motion.savedRotation);
      motion.hasSaved = false;
    }
    motion.previousSelection = selected;
    motion.start = performance.now();
    motion.active = true;
    if (reducedMotion) {
      camera.position.copy(motion.to);
      controls.target.copy(motion.targetTo);
      group.quaternion.copy(motion.rotationTo);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      motion.active = false;
    }
  }, [selected, cameraCommand, clusterFrame, mobileOcclusion, reducedMotion, camera, positions, radii, size.width, size.height, framing, props.panelEls]);

  const worldPos = useRef(new THREE.Vector3());
  const projected = useRef(new THREE.Vector3());
  const fpsWindow = useRef({ frames: 0, last: 0 });
  const zoomReport = useRef({ percent: 100, last: -1 });

  useFrame((state, delta) => {
    const group = groupRef.current;
    const controls = controlsRef.current;
    const inst = instRef.current;
    const edges = edgesRef.current;
    if (!group || !controls || !inst || !edges) return;
    group.position.x = framing.x;
    group.scale.setScalar(framing.scale);
    const distance = camera.position.distanceTo(controls.target);
    writeNodeFrame(nodeMaterial, state.clock.elapsedTime, reducedMotion, distance);
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) { fog.near = Math.max(1, distance - 16); fog.far = distance + 20; }
    const orbit = drift.current;
    const allowed = !reducedMotion && selected === null && hovered === null && !draggingRef.current && !cameraMotion.current.active && performance.now() - orbit.lastInput > 1800;
    orbit.weight = THREE.MathUtils.damp(orbit.weight, allowed ? 1 : 0, 8, Math.min(delta, 0.05));
    if (reducedMotion || selected !== null || cameraMotion.current.active) orbit.weight = 0;
    const previousPhase = orbit.phase;
    orbit.phase += Math.min(delta, 0.05) * 0.085 * orbit.weight;
    group.rotation.y += (Math.sin(orbit.phase) - Math.sin(previousPhase)) * 0.11;
    group.rotation.x += (Math.cos(orbit.phase) - Math.cos(previousPhase)) * 0.035;

    group.updateMatrixWorld();

    if (transitionRef.current) applyTransition(transitionRef.current, nodeGeometry, edges, reducedMotion);
    const motion = cameraMotion.current;
    if (motion.active) {
      const progress = cameraProgress(performance.now() - motion.start, reducedMotion);
      camera.position.lerpVectors(motion.from, motion.to, progress);
      controls.target.lerpVectors(motion.targetFrom, motion.targetTo, progress);
      group.quaternion.slerpQuaternions(motion.rotationFrom, motion.rotationTo, progress);
      group.updateMatrixWorld();
      if (progress === 1) motion.active = false;
    }
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    if (props.onZoomChange && state.clock.elapsedTime - zoomReport.current.last >= 0.1) {
      zoomReport.current.last = state.clock.elapsedTime;
      const percent = Math.round(100 * DEFAULT_CAMERA.length() / Math.max(1e-6, camera.position.distanceTo(controls.target)));
      if (percent !== zoomReport.current.percent) {
        zoomReport.current.percent = percent;
        props.onZoomChange(percent);
      }
    }

    if (labelPool.current) {
      updateLabels(labelPool.current, {
        positions,
        nodeTitles,
        matrixWorld: group.matrixWorld,
        viewDistance: distance,
        camera,
        snapshot: { hovered, selected, neighbors, dimMask },
        panelEls: props.panelEls.current ?? [],
        worldPos: worldPos.current,
        projected: projected.current,
        scratch: labelScratch,
      });
    }

    for (let i = 0; i < (props.territories?.length ?? 0); i += 1) {
      const label = props.territoryEls?.current[i];
      if (!label) continue;
      projected.current.fromArray(props.territories![i].position).applyMatrix4(group.matrixWorld).project(camera);
      const x = (projected.current.x * 0.5 + 0.5) * size.width;
      const y = (-projected.current.y * 0.5 + 0.5) * size.height;
      const rects = labelScratch.panelRects;
      const hidden = selected !== null || x < (size.width > 720 ? 380 : 70) || x > size.width - 100 || y < 145 || y > size.height - 120 || rects.some(rect => x > rect.left - 80 && x < rect.right + 80 && y > rect.top - 20 && y < rect.bottom + 20) || labelScratch.occupied.some(rect => x + 80 > rect.left && x - 80 < rect.right && y + 16 > rect.top && y < rect.bottom);
      writeTerritoryLabel(label, x, y, hidden);
    }

    // Local FPS meter, mounted only by the non-production ?fps=1 switch.
    if (fpsRef.current) {
      updateFpsMeter(fpsRef.current, fpsWindow.current, state.clock.elapsedTime);
    }
  });

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const id = event.instanceId ?? null;
    if (id !== hovered) onHover(id);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.instanceId !== undefined) onSelect(event.instanceId);
  };

  return (
    <group>
      <InertialControls
        ref={controlsRef}
        enablePan
        minPolarAngle={Math.PI * 0.23}
        maxPolarAngle={Math.PI * 0.77}
        enableDamping={!reducedMotion}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        minDistance={8}
        maxDistance={90}
        onStart={() => {
          draggingRef.current = true;
          drift.current.lastInput = performance.now();
          cameraMotion.current.active = false;
          cameraMotion.current.focusCancelled = true;
        }}
        onEnd={() => {
          draggingRef.current = false;
          drift.current.lastInput = performance.now();
        }}
      />
      <group ref={groupRef}>
        <instancedMesh
          ref={instRef}
          args={[undefined, undefined, nodeCount]}
          onPointerMove={handleMove}
          onPointerOut={() => onHover(null)}
          onClick={handleClick}
        >
          <primitive attach="geometry" object={nodeGeometry} />
          <primitive attach="material" object={nodeMaterial} />
        </instancedMesh>
        <lineSegments ref={edgesRef} geometry={edgeGeometry} renderOrder={-1}>
          <lineBasicMaterial vertexColors transparent opacity={0.96} toneMapped={false} />
        </lineSegments>
      </group>
    </group>
  );
}

export default function GalaxyScene(props: GalaxySceneProps) {
  const { dpr, glass, appearance, panelEls, onSelect, postprocessing = false } = props;
  const background = appearance.universe.backgroundColor;
  return (
    <Canvas
      dpr={dpr}
      frameloop="always"
      camera={{ position: DEFAULT_CAMERA.toArray(), fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, FOG_NEAR, FOG_FAR]} />
      <GalaxyContents {...props} />
      {postprocessing && (
        <GlassPass
          glass={glass}
          panelEls={panelEls}
          paper={props.tokens.paper}
          universe={appearance.universe}
        />
      )}
    </Canvas>
  );
}
