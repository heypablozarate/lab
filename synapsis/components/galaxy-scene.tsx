"use client";

// The 3D constellation. Rendering budget (kickoff §5, verifiable):
// - all nodes in ONE InstancedMesh (one draw call)
// - all edges in ONE LineSegments BufferGeometry (one draw call)
// - labels are DOM spans in a fixed pool mutated from useFrame (no WebGL text)
// "Opacity" fades are color mixes toward the flat paper background, so no
// transparency sorting is ever needed. All imperative per-frame mutation lives
// in module-level helpers operating on ref-held state.

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { GlassPass } from "./glass-pass";
import type { LiquidGlassConfig } from "./liquid-glass";

// Resolved per-theme colors. Only literal-valued tokens are read here —
// THREE.Color cannot parse color-mix() — so the edge/line color is derived in
// buildPalette with the same rule the Lab home uses (ink at ~16% over the
// background).
export type SceneTokens = {
  surfaceRaised: string;
  ink: string;
  accent: string;
  /** Panel tint colour for the liquid glass (usually --paper). */
  paper: string;
};

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
  labelPool: React.RefObject<LabelPool>;
  fpsRef: React.RefObject<HTMLSpanElement | null>;
  reducedMotion: boolean;
  dpr: number;
  /** Tunable liquid-glass parameters, rendered by the WebGL GlassPass. */
  glass: LiquidGlassConfig;
  /** Live DOM refs of the glass panels (sidebar, detail panel). */
  panelEls: React.RefObject<(HTMLElement | null)[]>;
  onHover: (index: number | null) => void;
  onSelect: (index: number | null) => void;
};

const AUTO_ROTATION = 0.0003; // rad per frame, kickoff value
const TRANSITION_MS = 400;
const DEFAULT_CAMERA = new THREE.Vector3(0, 11.5, 74);
const DESKTOP_OPTICAL_OFFSET_X = 12;
const FOG_NEAR = 38;
const FOG_FAR = 124;
const FOCUS_DISTANCE = 14;
const PULSE_STRENGTH = 0.075;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Palette = {
  surface: THREE.Color;
  accent: THREE.Color;
  nodeRest: THREE.Color;
  nodeDim: THREE.Color;
  edgeRest: THREE.Color;
  edgeFaint: THREE.Color;
};

function buildPalette(tokens: SceneTokens): Palette {
  const surface = new THREE.Color(tokens.surfaceRaised);
  const ink = new THREE.Color(tokens.ink);
  const surfaceBrightness = (surface.r + surface.g + surface.b) / 3;
  const isDark = surfaceBrightness < 0.18;

  // The dsaints-style graph field needs visible hairlines in dark mode while
  // staying quiet on paper. Keep the same token source, but tune the resolved
  // mix per theme because WebGL cannot parse CSS color-mix().
  const edgeRest = isDark ? surface.clone().lerp(ink, 0.18) : surface.clone().lerp(ink, 0.075);
  const edgeFaint = isDark ? surface.clone().lerp(ink, 0.065) : surface.clone().lerp(ink, 0.03);
  const nodeRest = isDark ? surface.clone().lerp(ink, 0.44) : ink.clone().lerp(surface, 0.58);
  const nodeDim = isDark ? surface.clone().lerp(ink, 0.1) : ink.clone().lerp(surface, 0.9);

  return {
    surface,
    accent: isDark ? ink.clone() : ink.clone().lerp(surface, 0.02),
    nodeRest,
    nodeDim,
    edgeRest,
    edgeFaint,
  };
}

function relativeLuminance(color: THREE.Color) {
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

type NodeUniforms = {
  uTime: { value: number };
  uPulseStrength: { value: number };
  uCoreLighten: { value: number };
  uPulseInk: { value: THREE.Color };
  uSurface: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
};

function createNodeMaterial(): THREE.ShaderMaterial & { uniforms: NodeUniforms } {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulseStrength: { value: PULSE_STRENGTH },
      uCoreLighten: { value: 0 },
      uPulseInk: { value: new THREE.Color() },
      uSurface: { value: new THREE.Color() },
      uFogNear: { value: FOG_NEAR },
      uFogFar: { value: FOG_FAR },
    },
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
  }) as THREE.ShaderMaterial & { uniforms: NodeUniforms };
}

function createNodeGeometry(nodeCount: number) {
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const pulsePhase = new Float32Array(nodeCount);
  const nodeColor = new Float32Array(nodeCount * 3);
  for (let i = 0; i < nodeCount; i += 1) {
    pulsePhase[i] = ((i * 0.61803398875) % 1) * Math.PI * 2;
  }
  geometry.setAttribute("pulsePhase", new THREE.InstancedBufferAttribute(pulsePhase, 1));
  const colorAttribute = new THREE.InstancedBufferAttribute(nodeColor, 3);
  colorAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("nodeColor", colorAttribute);
  return geometry;
}

function writeNodeTheme(material: THREE.ShaderMaterial & { uniforms: NodeUniforms }, palette: Palette) {
  material.uniforms.uCoreLighten.value = relativeLuminance(palette.surface) < 0.2 ? 1 : 0;
  material.uniforms.uPulseInk.value.copy(palette.nodeRest);
  material.uniforms.uSurface.value.copy(palette.surface);
}

function writeNodeFrame(
  material: THREE.ShaderMaterial & { uniforms: NodeUniforms },
  elapsed: number,
  reducedMotion: boolean,
) {
  material.uniforms.uTime.value = elapsed;
  material.uniforms.uPulseStrength.value = reducedMotion ? 0 : PULSE_STRENGTH;
}

// ---- 400ms cubic color transition, held in a ref and mutated imperatively ----

type TransitionState = {
  nodeFrom: Float32Array;
  nodeTarget: Float32Array;
  edgeFrom: Float32Array;
  edgeTarget: Float32Array;
  start: number;
  active: boolean;
};

function createTransitionState(nodeCount: number, edgeCount: number): TransitionState {
  return {
    nodeFrom: new Float32Array(nodeCount * 3),
    nodeTarget: new Float32Array(nodeCount * 3),
    edgeFrom: new Float32Array(edgeCount * 2 * 3),
    edgeTarget: new Float32Array(edgeCount * 2 * 3),
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
  const nodeCount = state.nodeFrom.length / 3;
  const edgeCount = edgeIndices.length / 2;
  const hasSelection = selected !== null;
  const nodeColorAttr = nodeGeometry.getAttribute("nodeColor") as THREE.InstancedBufferAttribute;

  state.nodeFrom.set(nodeColorAttr.array as Float32Array);
  const edgeColorAttr = edges.geometry.getAttribute("color") as THREE.BufferAttribute;
  state.edgeFrom.set(edgeColorAttr.array as Float32Array);

  for (let i = 0; i < nodeCount; i += 1) {
    let color: THREE.Color;
    if (hasSelection) {
      color = i === selected || neighbors.has(i) ? palette.accent : palette.nodeDim;
    } else if (hovered === i) {
      color = palette.accent;
    } else if (dimMask[i]) {
      color = palette.nodeDim;
    } else {
      color = palette.nodeRest;
    }
    color.toArray(state.nodeTarget, i * 3);
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
    color.toArray(state.edgeTarget, e * 6);
    color.toArray(state.edgeTarget, e * 6 + 3);
  }

  state.start = performance.now();
  state.active = true;
}

function applyTransition(state: TransitionState, nodeGeometry: THREE.BufferGeometry, edges: THREE.LineSegments) {
  if (!state.active) return;
  const t = Math.min(1, (performance.now() - state.start) / TRANSITION_MS);
  const e = easeOutCubic(t);
  const nodeColorAttr = nodeGeometry.getAttribute("nodeColor") as THREE.InstancedBufferAttribute;
  const nodeColorArr = nodeColorAttr.array as Float32Array;
  for (let i = 0; i < nodeColorArr.length; i += 1) {
    nodeColorArr[i] = state.nodeFrom[i] + (state.nodeTarget[i] - state.nodeFrom[i]) * e;
  }
  nodeColorAttr.needsUpdate = true;
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
  camera: THREE.Camera;
  snapshot: InteractionSnapshot;
  panelEls: (HTMLElement | null)[];
  worldPos: THREE.Vector3;
  projected: THREE.Vector3;
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

function updateLabels(pool: LabelPool, args: LabelFrameArgs) {
  if (!pool.container) return;
  const { positions, nodeTitles, matrixWorld, camera, snapshot, panelEls, worldPos, projected } = args;
  const { selected, hovered, neighbors, dimMask } = snapshot;
  const containerRect = pool.container.getBoundingClientRect();
  const { width, height } = containerRect;
  const panelRects = panelEls
    .filter((el): el is HTMLElement => el !== null)
    .map((el) => el.getBoundingClientRect());
  const candidates: LabelCandidate[] = [];

  for (let nodeIndex = 0; nodeIndex < nodeTitles.length; nodeIndex += 1) {
    if (dimMask[nodeIndex] === 1 && nodeIndex !== selected && nodeIndex !== hovered) continue;
    worldPos.fromArray(positions, nodeIndex * 3).applyMatrix4(matrixWorld);
    const depth = worldPos.distanceTo(camera.position);
    projected.copy(worldPos).project(camera);
    if (projected.z > 1) continue;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const onScreen = x > -80 && x < width + 80 && y > -60 && y < height + 60;
    if (!onScreen && nodeIndex !== selected && nodeIndex !== hovered) continue;

    const fogFade = THREE.MathUtils.clamp((FOG_FAR - 12 - depth) / (FOG_FAR - 12 - FOG_NEAR), 0, 1);
    const active = nodeIndex === selected || nodeIndex === hovered;
    const connected = selected !== null && neighbors.has(nodeIndex);
    const centerPenalty = Math.abs(projected.x) * 6 + Math.abs(projected.y) * 3;
    const priority = active ? -10000 : connected ? -5000 : 0;
    candidates.push({
      index: nodeIndex,
      text: nodeTitles[nodeIndex],
      x,
      y,
      opacity: (selected !== null && !active && !connected ? 0.24 : 0.92) * fogFade,
      active,
      score: priority + depth + centerPenalty,
    });
  }

  candidates.sort((a, b) => a.score - b.score || a.index - b.index);

  for (let s = 0; s < pool.slots.length; s += 1) {
    const span = pool.slots[s];
    if (!span) continue;
    const candidate = candidates[s];
    const nodeIndex = candidate?.index ?? -1;
    if (pool.assignments[s] !== nodeIndex) {
      pool.assignments[s] = nodeIndex;
      span.textContent = candidate?.text ?? "";
    }
    if ((span.dataset.active === "true") !== Boolean(candidate?.active)) {
      span.dataset.active = candidate?.active ? "true" : "false";
    }
    if (!candidate) {
      if (span.dataset.glass === "true") span.dataset.glass = "false";
      span.style.opacity = "0";
      continue;
    }
    const labelWidth = span.offsetWidth;
    const labelHeight = span.offsetHeight;
    const labelLeft = containerRect.left + candidate.x - labelWidth / 2;
    const labelTop = containerRect.top + candidate.y - labelHeight * 1.4;
    const labelRight = labelLeft + labelWidth;
    const labelBottom = labelTop + labelHeight;
    const underGlass = panelRects.some(
      (rect) =>
        labelRight >= rect.left &&
        labelLeft <= rect.right &&
        labelBottom >= rect.top &&
        labelTop <= rect.bottom,
    );
    if ((span.dataset.glass === "true") !== underGlass) {
      span.dataset.glass = underGlass ? "true" : "false";
    }
    span.style.opacity = String(candidate.opacity * (underGlass ? 0.42 : 1));
    span.style.transform = `translate3d(${candidate.x.toFixed(1)}px, ${candidate.y.toFixed(1)}px, 0) translate(-50%, -140%)`;
  }
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
attribute vec3 nodeColor;
attribute float pulsePhase;

uniform float uTime;
uniform float uPulseStrength;

varying vec3 vInstanceColor;
varying vec3 vViewNormal;
varying float vDepth;
varying float vPulse;
varying float vBreath;

void main() {
  vInstanceColor = nodeColor;
  vViewNormal = normalize(normalMatrix * normal);

  float pulse = 0.5 + 0.5 * sin(uTime * 2.45 + pulsePhase);
  float breath = smoothstep(0.22, 1.0, pulse);
  vPulse = pulse;
  vBreath = breath;
  vec3 pulsed = position * (1.0 + uPulseStrength * breath);

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pulsed, 1.0);
  vDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const nodeFragmentShader = /* glsl */ `
precision highp float;

uniform float uCoreLighten;
uniform vec3 uPulseInk;
uniform vec3 uSurface;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vInstanceColor;
varying vec3 vViewNormal;
varying float vDepth;
varying float vPulse;
varying float vBreath;

void main() {
  float facing = clamp(vViewNormal.z, 0.0, 1.0);
  float depthFade = smoothstep(uFogNear, uFogFar, vDepth);
  float presence = 1.0 - depthFade;

  float shellMask = smoothstep(0.04, 0.42, facing);
  float ringMask = smoothstep(0.14, 0.38, facing) * (1.0 - smoothstep(0.64, 0.96, facing));
  float centerMask = smoothstep(0.74, 0.95, facing);

  float shellShade = mix(0.42, 1.18, presence) * mix(0.86, 1.08, facing);
  vec3 shell = mix(uSurface, vInstanceColor * shellShade, shellMask);

  vec3 pulseColor = mix(uSurface, uPulseInk, mix(0.36, 0.84, presence));
  shell = mix(shell, pulseColor, ringMask * vBreath * mix(0.12, 0.62, presence));

  vec3 coreDark = vInstanceColor * mix(0.28, 0.46, presence);
  vec3 coreLight = mix(vInstanceColor, vec3(1.0), mix(0.36, 0.58, presence));
  vec3 core = mix(coreDark, coreLight, uCoreLighten);
  vec3 color = mix(shell, core, centerMask * mix(0.68, 0.94, presence));

  color = mix(color, uSurface, depthFade * 0.88);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

function GalaxyContents(props: GalaxySceneProps) {
  const {
    positions,
    radii,
    edgeIndices,
    tokens,
    hovered,
    selected,
    neighbors,
    dimMask,
    nodeTitles,
    labelPool,
    fpsRef,
    reducedMotion,
    onHover,
    onSelect,
  } = props;

  const nodeCount = radii.length;
  const edgeCount = edgeIndices.length / 2;

  const instRef = useRef<THREE.InstancedMesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const draggingRef = useRef(false);
  const transitionRef = useRef<TransitionState | null>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const palette = useMemo(() => buildPalette(tokens), [tokens]);
  const nodeGeometry = useMemo(() => createNodeGeometry(nodeCount), [nodeCount]);
  const nodeMaterial = useMemo(() => createNodeMaterial(), []);

  useEffect(() => () => nodeGeometry.dispose(), [nodeGeometry]);
  useEffect(() => () => nodeMaterial.dispose(), [nodeMaterial]);

  useEffect(() => {
    writeNodeTheme(nodeMaterial, palette);
  }, [nodeMaterial, palette]);

  const edgeGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(edgeCount * 2 * 3);
    for (let e = 0; e < edgeCount; e += 1) {
      const a = edgeIndices[e * 2];
      const b = edgeIndices[e * 2 + 1];
      pos.set(positions.slice(a * 3, a * 3 + 3), e * 6);
      pos.set(positions.slice(b * 3, b * 3 + 3), e * 6 + 3);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(edgeCount * 2 * 3), 3));
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
    const nodeColorAttr = nodeGeometry.getAttribute("nodeColor") as THREE.InstancedBufferAttribute;
    const nodeColorArr = nodeColorAttr.array as Float32Array;
    for (let i = 0; i < nodeCount; i += 1) palette.nodeRest.toArray(nodeColorArr, i * 3);
    nodeColorAttr.needsUpdate = true;

    const attr = edgeGeometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let e = 0; e < edgeCount * 2; e += 1) palette.edgeRest.toArray(arr, e * 3);
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

  const focusTarget = useRef(new THREE.Vector3());
  const focusCamera = useRef(DEFAULT_CAMERA.clone());
  const worldPos = useRef(new THREE.Vector3());
  const projected = useRef(new THREE.Vector3());
  const fpsWindow = useRef({ frames: 0, last: 0 });

  useFrame((state, delta) => {
    const group = groupRef.current;
    const controls = controlsRef.current;
    const inst = instRef.current;
    const edges = edgesRef.current;
    if (!group || !controls || !inst || !edges) return;
    const opticalOffsetX = size.width > 720 ? DESKTOP_OPTICAL_OFFSET_X : 0;
    group.position.x = opticalOffsetX;
    writeNodeFrame(nodeMaterial, state.clock.elapsedTime, reducedMotion);

    // Auto-rotation only at rest: no drag, no selection, no reduced motion.
    if (!reducedMotion && !draggingRef.current && selected === null) {
      group.rotation.y += AUTO_ROTATION;
    }
    group.updateMatrixWorld();

    if (transitionRef.current) applyTransition(transitionRef.current, nodeGeometry, edges);

    // Focus: ease the camera toward the selected node; back to the wide view
    // when nothing is selected.
    if (selected !== null) {
      worldPos.current.fromArray(positions, selected * 3).applyMatrix4(group.matrixWorld);
      focusTarget.current.copy(worldPos.current);
      const away = projected.current.copy(camera.position).sub(worldPos.current);
      if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
      away.setLength(FOCUS_DISTANCE + radii[selected] * 8);
      focusCamera.current.copy(worldPos.current).add(away);
    } else {
      focusTarget.current.set(0, 0, 0);
      const away = projected.current.copy(camera.position).sub(focusTarget.current);
      if (away.lengthSq() < 1e-6) away.copy(DEFAULT_CAMERA);
      focusCamera.current.copy(focusTarget.current).add(away);
    }
    if (!draggingRef.current) {
      const alpha = reducedMotion ? 1 : 1 - Math.exp(-5 * delta);
      controls.target.lerp(focusTarget.current, alpha);
      camera.position.lerp(focusCamera.current, alpha);
    }
    controls.update();

    if (labelPool.current) {
      updateLabels(labelPool.current, {
        positions,
        nodeTitles,
        matrixWorld: group.matrixWorld,
        camera,
        snapshot: { hovered, selected, neighbors, dimMask },
        panelEls: props.panelEls.current ?? [],
        worldPos: worldPos.current,
        projected: projected.current,
      });
    }

    // Dev FPS meter (kickoff: present from the first scene commit).
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
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        minDistance={8}
        maxDistance={90}
        onStart={() => {
          draggingRef.current = true;
        }}
        onEnd={() => {
          draggingRef.current = false;
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
        <lineSegments ref={edgesRef} geometry={edgeGeometry}>
          <lineBasicMaterial vertexColors transparent opacity={0.96} />
        </lineSegments>
      </group>
    </group>
  );
}

export default function GalaxyScene(props: GalaxySceneProps) {
  const { tokens, dpr, glass, panelEls, onSelect } = props;
  return (
    <Canvas
      dpr={dpr}
      frameloop="always"
      camera={{ position: DEFAULT_CAMERA.toArray(), fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[tokens.surfaceRaised]} />
      <fog attach="fog" args={[tokens.surfaceRaised, FOG_NEAR, FOG_FAR]} />
      <GalaxyContents {...props} />
      <GlassPass glass={glass} panelEls={panelEls} paper={tokens.paper} />
    </Canvas>
  );
}
