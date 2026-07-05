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
  labelIndices: number[];
  labelTexts: string[];
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
const DEFAULT_CAMERA = new THREE.Vector3(0, 9, 46);
const FOG_NEAR = 30;
const FOG_FAR = 82;
const FOCUS_DISTANCE = 14;

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
  // Lab home line rule (ink 16% over the background), resolved to a solid.
  const line = surface.clone().lerp(ink, 0.16);
  return {
    surface,
    accent: new THREE.Color(tokens.accent),
    nodeRest: ink.clone(),
    nodeDim: ink.clone().lerp(surface, 0.82),
    edgeRest: line.clone().lerp(surface, 0.4),
    edgeFaint: surface.clone().lerp(ink, 0.045),
  };
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
  inst: THREE.InstancedMesh,
  edges: THREE.LineSegments,
  palette: Palette,
  edgeIndices: number[],
  snapshot: InteractionSnapshot,
) {
  const { hovered, selected, neighbors, dimMask } = snapshot;
  const nodeCount = state.nodeFrom.length / 3;
  const edgeCount = edgeIndices.length / 2;
  const hasSelection = selected !== null;

  if (inst.instanceColor) {
    state.nodeFrom.set(inst.instanceColor.array as Float32Array);
  } else {
    for (let i = 0; i < nodeCount; i += 1) palette.nodeRest.toArray(state.nodeFrom, i * 3);
  }
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

function applyTransition(state: TransitionState, inst: THREE.InstancedMesh, edges: THREE.LineSegments) {
  if (!state.active) return;
  const t = Math.min(1, (performance.now() - state.start) / TRANSITION_MS);
  const e = easeOutCubic(t);
  if (inst.instanceColor) {
    const arr = inst.instanceColor.array as Float32Array;
    for (let i = 0; i < arr.length; i += 1) {
      arr[i] = state.nodeFrom[i] + (state.nodeTarget[i] - state.nodeFrom[i]) * e;
    }
    inst.instanceColor.needsUpdate = true;
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
  labelIndices: number[];
  labelTexts: string[];
  matrixWorld: THREE.Matrix4;
  camera: THREE.Camera;
  snapshot: InteractionSnapshot;
  worldPos: THREE.Vector3;
  projected: THREE.Vector3;
};

function updateLabels(pool: LabelPool, args: LabelFrameArgs) {
  if (!pool.container) return;
  const { positions, labelIndices, labelTexts, matrixWorld, camera, snapshot, worldPos, projected } = args;
  const { selected, hovered, neighbors, dimMask } = snapshot;
  const { width, height } = pool.container.getBoundingClientRect();

  for (let s = 0; s < pool.slots.length; s += 1) {
    const span = pool.slots[s];
    if (!span) continue;
    const nodeIndex = s < labelIndices.length ? labelIndices[s] : -1;
    if (pool.assignments[s] !== nodeIndex) {
      pool.assignments[s] = nodeIndex;
      span.textContent = nodeIndex >= 0 ? labelTexts[s] : "";
    }
    const isActive = nodeIndex >= 0 && (nodeIndex === selected || nodeIndex === hovered);
    if ((span.dataset.active === "true") !== isActive) {
      span.dataset.active = isActive ? "true" : "false";
    }
    if (nodeIndex < 0) {
      span.style.opacity = "0";
      continue;
    }
    worldPos.fromArray(positions, nodeIndex * 3).applyMatrix4(matrixWorld);
    const depth = worldPos.distanceTo(camera.position);
    projected.copy(worldPos).project(camera);
    if (projected.z > 1) {
      span.style.opacity = "0";
      continue;
    }
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const fogFade = THREE.MathUtils.clamp((FOG_FAR - 14 - depth) / (FOG_FAR - 14 - FOG_NEAR), 0, 1);
    const dimmed = selected !== null
      ? nodeIndex !== selected && !neighbors.has(nodeIndex)
      : dimMask[nodeIndex] === 1;
    span.style.opacity = String((dimmed ? 0.15 : 0.9) * fogFade);
    span.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -140%)`;
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
    labelIndices,
    labelTexts,
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

  const palette = useMemo(() => buildPalette(tokens), [tokens]);

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
      inst.setColorAt(i, palette.nodeRest);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();

    const attr = edgeGeometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let e = 0; e < edgeCount * 2; e += 1) palette.edgeRest.toArray(arr, e * 3);
    attr.needsUpdate = true;
  }, [nodeCount, edgeCount, positions, radii, palette, edgeGeometry]);

  // Replay the color transition toward new targets whenever interaction
  // state changes.
  useEffect(() => {
    const inst = instRef.current;
    const edges = edgesRef.current;
    if (!inst || !edges) return;
    if (!transitionRef.current) {
      transitionRef.current = createTransitionState(nodeCount, edgeCount);
    }
    beginTransition(transitionRef.current, inst, edges, palette, edgeIndices, {
      hovered,
      selected,
      neighbors,
      dimMask,
    });
  }, [hovered, selected, neighbors, dimMask, palette, edgeIndices, nodeCount, edgeCount]);

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

    // Auto-rotation only at rest: no drag, no selection, no reduced motion.
    if (!reducedMotion && !draggingRef.current && selected === null) {
      group.rotation.y += AUTO_ROTATION;
    }
    group.updateMatrixWorld();

    if (transitionRef.current) applyTransition(transitionRef.current, inst, edges);

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
      const away = projected.current.copy(camera.position);
      if (away.lengthSq() < 1e-6) away.copy(DEFAULT_CAMERA);
      away.setLength(DEFAULT_CAMERA.length());
      focusCamera.current.copy(away);
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
        labelIndices,
        labelTexts,
        matrixWorld: group.matrixWorld,
        camera,
        snapshot: { hovered, selected, neighbors, dimMask },
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
          <icosahedronGeometry args={[1, 2]} />
          {/* default white base color: instance colors carry the RAMS tokens */}
          <meshBasicMaterial />
        </instancedMesh>
        <lineSegments ref={edgesRef} geometry={edgeGeometry}>
          <lineBasicMaterial vertexColors />
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
