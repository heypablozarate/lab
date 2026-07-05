"use client";

/* WebGL liquid glass for the Synapsis panels.

   Cross-browser refraction: instead of `backdrop-filter: url(#svg)` (which
   Safari/WebKit does not support), the constellation is rendered into an FBO and
   a fullscreen pass refracts it under each panel's rounded-rect region. The
   displacement is a rounded-box SDF lens (concentrated at the rim, flat in the
   middle) with chromatic aberration, a box blur, a paper tint and a specular
   rim — the same look the DOM version had, now running everywhere WebGL runs.

   This takes over the render loop (useFrame priority 1): every frame it renders
   the scene to the FBO, then the post scene to screen. The DOM panels sit on top
   with transparent backgrounds; WebGL provides the glass exactly under them. */

import { useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import type { LiquidGlassConfig } from "./liquid-glass";

// Uniform bag for the glass shader. Mutated only through the module-level
// writers below (never assigned as a tracked property of a hook result), which
// keeps the imperative r3f pattern clear of the React purity lint rules — the
// same shape galaxy-scene.tsx uses for its per-frame buffer mutation.
type GlassUniforms = {
  uScene: { value: THREE.Texture | null };
  uResolution: { value: THREE.Vector2 };
  uPanelCount: { value: number };
  uCenter0: { value: THREE.Vector2 };
  uHalf0: { value: THREE.Vector2 };
  uCenter1: { value: THREE.Vector2 };
  uHalf1: { value: THREE.Vector2 };
  uRadius: { value: number };
  uDepth: { value: number };
  uRimWidth: { value: number };
  uChroma: { value: number };
  uBlur: { value: number };
  uContrast: { value: number };
  uBrightness: { value: number };
  uSaturate: { value: number };
  uTint: { value: number };
  uEdge: { value: number };
  uPaper: { value: THREE.Color };
};

type GlassObjects = {
  uniforms: GlassUniforms;
  postScene: THREE.Scene;
  postCamera: THREE.Camera;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
};

function createGlassObjects(): GlassObjects {
  const uniforms: GlassUniforms = {
    uScene: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPanelCount: { value: 0 },
    uCenter0: { value: new THREE.Vector2() },
    uHalf0: { value: new THREE.Vector2() },
    uCenter1: { value: new THREE.Vector2() },
    uHalf1: { value: new THREE.Vector2() },
    uRadius: { value: 24 },
    uDepth: { value: 14 },
    uRimWidth: { value: 0.32 },
    uChroma: { value: 0.35 },
    uBlur: { value: 2 },
    uContrast: { value: 1.15 },
    uBrightness: { value: 1.05 },
    uSaturate: { value: 1.6 },
    uTint: { value: 0.5 },
    uEdge: { value: 0.5 },
    uPaper: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(mesh);
  return { uniforms, postScene, postCamera: new THREE.Camera(), material, mesh };
}

function writeConfig(u: GlassUniforms, glass: LiquidGlassConfig, dpr: number) {
  u.uRadius.value = glass.radius * dpr;
  u.uDepth.value = glass.depth * dpr;
  u.uRimWidth.value = glass.rimWidth;
  u.uChroma.value = glass.chromaticAberration;
  u.uBlur.value = glass.blur * dpr;
  u.uContrast.value = glass.contrast;
  u.uBrightness.value = glass.brightness;
  u.uSaturate.value = glass.saturate;
  u.uTint.value = glass.tint;
  u.uEdge.value = glass.edgeHighlight;
}

// Per-frame writes: bind the FBO texture, the drawing-buffer resolution, and the
// live DOM panel rects. Canvas is fixed inset-0 (= viewport), so rects are
// canvas-relative; convert to drawing-buffer pixels with a bottom-left origin to
// match gl_FragCoord.
function writeFrame(
  u: GlassUniforms,
  texture: THREE.Texture,
  els: (HTMLElement | null)[],
  cssWidth: number,
  cssHeight: number,
  dpr: number,
) {
  u.uScene.value = texture;
  u.uResolution.value.set(cssWidth * dpr, cssHeight * dpr);

  const present = els.filter((el): el is HTMLElement => el !== null);
  const slots = [
    { c: u.uCenter0.value, h: u.uHalf0.value },
    { c: u.uCenter1.value, h: u.uHalf1.value },
  ];
  const count = Math.min(present.length, slots.length);
  for (let i = 0; i < count; i += 1) {
    const rect = present[i].getBoundingClientRect();
    slots[i].c.set(
      (rect.left + rect.width / 2) * dpr,
      (cssHeight - (rect.top + rect.height / 2)) * dpr,
    );
    slots[i].h.set((rect.width / 2) * dpr, (rect.height / 2) * dpr);
  }
  u.uPanelCount.value = count;
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform int uPanelCount;
uniform vec2 uCenter0;
uniform vec2 uHalf0;
uniform vec2 uCenter1;
uniform vec2 uHalf1;
uniform float uRadius;
uniform float uDepth;
uniform float uRimWidth;
uniform float uChroma;
uniform float uBlur;
uniform float uContrast;
uniform float uBrightness;
uniform float uSaturate;
uniform float uTint;
uniform float uEdge;
uniform vec3 uPaper;

// Signed distance to a rounded rectangle centred at the origin.
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Accumulate the lens displacement + rim factor for one panel.
// (Param is halfSize, not half: half is a reserved word in GLSL.)
void panel(vec2 fragPx, vec2 center, vec2 halfSize, inout vec2 disp, inout float inside, inout float rimT) {
  vec2 p = fragPx - center;
  float d = sdRoundBox(p, halfSize, uRadius);
  if (d < 0.0) {
    float rimPx = max(1.0, uRimWidth * min(halfSize.x, halfSize.y));
    float t = smoothstep(-rimPx, 0.0, d);
    float lens = t * t * (3.0 - 2.0 * t);
    float len = length(p);
    vec2 dir = len > 0.001 ? -p / len : vec2(0.0);
    disp += dir * uDepth * lens;
    inside = 1.0;
    rimT = max(rimT, t);
  }
}

vec3 blurAt(vec2 uv) {
  vec2 ox = vec2(uBlur / uResolution.x, 0.0);
  vec2 oy = vec2(0.0, uBlur / uResolution.y);
  vec3 c = texture2D(uScene, uv).rgb * 0.36;
  c += texture2D(uScene, uv + ox).rgb * 0.16;
  c += texture2D(uScene, uv - ox).rgb * 0.16;
  c += texture2D(uScene, uv + oy).rgb * 0.16;
  c += texture2D(uScene, uv - oy).rgb * 0.16;
  return c;
}

void main() {
  vec2 fragPx = gl_FragCoord.xy;
  vec2 uv = fragPx / uResolution;

  vec2 disp = vec2(0.0);
  float inside = 0.0;
  float rimT = 0.0;

  if (uPanelCount > 0) panel(fragPx, uCenter0, uHalf0, disp, inside, rimT);
  if (uPanelCount > 1) panel(fragPx, uCenter1, uHalf1, disp, inside, rimT);

  // Outside every panel: cheap pass-through of the constellation.
  if (inside < 0.5) {
    gl_FragColor = vec4(texture2D(uScene, uv).rgb, 1.0);
    return;
  }

  // Refraction + chromatic aberration: sample the R/G/B taps at slightly
  // different displacements so colour fringes at the rim.
  vec2 d = disp / uResolution;
  float r = blurAt(uv + d * (1.0 + uChroma)).r;
  vec3 g = blurAt(uv + d);
  float b = blurAt(uv + d * (1.0 - uChroma)).b;
  vec3 col = vec3(r, g.g, b);

  // Paper tint for legibility, then contrast / brightness / saturation.
  col = mix(col, uPaper, uTint);
  col = (col - 0.5) * uContrast + 0.5;
  col *= uBrightness;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSaturate);

  // Specular rim highlight near the very edge.
  float rimLine = smoothstep(0.7, 1.0, rimT);
  col += uEdge * 0.5 * rimLine * (1.0 - col);

  // Same colour space as the pass-through above (the FBO is already display
  // sRGB), so the glass region matches the surrounding scene — no extra encode.
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function GlassPass({
  glass,
  panelEls,
  paper,
}: {
  glass: LiquidGlassConfig;
  panelEls: React.RefObject<(HTMLElement | null)[]>;
  paper: string;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const fbo = useFBO();

  // Created once; mutated only via the module-level writers (never as a tracked
  // property assignment on the memo result itself).
  const objects = useMemo(() => createGlassObjects(), []);

  useEffect(() => {
    return () => {
      objects.mesh.geometry.dispose();
      objects.material.dispose();
    };
  }, [objects]);

  useEffect(() => {
    writeConfig(objects.uniforms, glass, dpr);
  }, [glass, dpr, objects]);

  useEffect(() => {
    objects.uniforms.uPaper.value.set(paper);
  }, [paper, objects]);

  useFrame(() => {
    writeFrame(objects.uniforms, fbo.texture, panelEls.current ?? [], size.width, size.height, dpr);

    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(objects.postScene, objects.postCamera);
  }, 1);

  return null;
}
