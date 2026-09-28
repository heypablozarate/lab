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
import { writeGlassPanelBounds } from "./glass-geometry";
import type { SynapsisThemeAppearance } from "./synapsis-appearance";

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
  uChromaPx: { value: number };
  uBlur: { value: number };
  uContrast: { value: number };
  uBrightness: { value: number };
  uSaturate: { value: number };
  uTint: { value: number };
  uEdge: { value: number };
  uPaper: { value: THREE.Color };
  uNoise: { value: number };
  uVignette: { value: number };
};

type GlassObjects = {
  uniforms: GlassUniforms;
  postScene: THREE.Scene;
  postCamera: THREE.Camera;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  panelBounds: Float32Array;
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
    uDepth: { value: 22 },
    uRimWidth: { value: 0.24 },
    uChromaPx: { value: 1.5 },
    uBlur: { value: 2 },
    uContrast: { value: 1.15 },
    uBrightness: { value: 1.05 },
    uSaturate: { value: 1.6 },
    uTint: { value: 0.5 },
    uEdge: { value: 0.5 },
    uPaper: { value: new THREE.Color() },
    uNoise: { value: 0 },
    uVignette: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(mesh);
  return { uniforms, postScene, postCamera: new THREE.Camera(), material, mesh, panelBounds: new Float32Array(4) };
}

function writeConfig(u: GlassUniforms, glass: LiquidGlassConfig, dpr: number) {
  u.uRadius.value = glass.radius * dpr;
  u.uDepth.value = glass.depth * dpr;
  u.uRimWidth.value = glass.rimWidth;
  u.uChromaPx.value = Math.min(1, Math.max(0, glass.chromaticAberration)) * 2 * dpr;
  u.uBlur.value = glass.blur * dpr;
  u.uContrast.value = glass.contrast;
  u.uBrightness.value = glass.brightness;
  u.uSaturate.value = glass.saturate;
  u.uTint.value = glass.tint;
  u.uEdge.value = glass.edgeHighlight;
}

function writeUniverse(u: GlassUniforms, universe: SynapsisThemeAppearance["universe"]) {
  u.uNoise.value = universe.noise;
  u.uVignette.value = universe.vignette;
}

// DOM and canvas rectangles share viewport coordinates; map their difference
// into actual framebuffer pixels, including canvas offsets and fractional DPR.
function writeFrame(
  u: GlassUniforms,
  texture: THREE.Texture,
  els: (HTMLElement | null)[],
  canvasRect: DOMRect,
  pixelWidth: number,
  pixelHeight: number,
  bounds: Float32Array,
) {
  u.uScene.value = texture;
  u.uResolution.value.set(pixelWidth, pixelHeight);
  let count = 0;
  for (const element of els) {
    if (!element || count === 2) continue;
    if (!writeGlassPanelBounds(bounds, element.getBoundingClientRect(), canvasRect, pixelWidth, pixelHeight)) continue;
    const center = count === 0 ? u.uCenter0.value : u.uCenter1.value;
    const halfSize = count === 0 ? u.uHalf0.value : u.uHalf1.value;
    center.set(bounds[0], bounds[1]);
    halfSize.set(bounds[2], bounds[3]);
    count += 1;
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
uniform float uChromaPx;
uniform float uBlur;
uniform float uContrast;
uniform float uBrightness;
uniform float uSaturate;
uniform float uTint;
uniform float uEdge;
uniform vec3 uPaper;
uniform float uNoise;
uniform float uVignette;

// Rounded-box distance and its analytical outward normal. Straight edges
// refract perpendicular to themselves; corners follow their circular arc.
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 roundBoxNormal(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  vec2 corner = max(q, 0.0);
  vec2 signs = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  float cornerLength = length(corner);
  if (cornerLength > 0.0001) return corner / cornerLength * signs;
  return q.x > q.y ? vec2(signs.x, 0.0) : vec2(0.0, signs.y);
}

void panel(vec2 fragPx, vec2 center, vec2 halfSize,
           inout vec2 disp, inout float coverage, inout float rimT,
           inout float specular) {
  vec2 p = fragPx - center;
  float shortest = min(halfSize.x, halfSize.y);
  float radius = clamp(uRadius, 0.0, shortest);
  float distance = sdRoundBox(p, halfSize, radius);
  if (distance > 1.0) return;
  float mask = 1.0 - smoothstep(-0.75, 0.75, distance);
  float rimPx = max(1.0, clamp(uRimWidth, 0.01, 1.0) * shortest);
  float rim = smoothstep(-rimPx, 0.0, distance);
  vec2 normal = roundBoxNormal(p, halfSize, radius);
  // Restrict distortion to the edge; preserve a quiet, legible interior.
  float lens = rim * rim;
  float depth = clamp(uDepth, 0.0, shortest * 0.35);
  disp = -normal * depth * lens;
  rimT = rim;
  coverage = mask;
  // Directional top-left light plus a softer opposite rim reflection.
  float light = max(dot(normal, normalize(vec2(-0.6, 0.8))), 0.0);
  float opposite = max(dot(normal, normalize(vec2(0.6, -0.8))), 0.0);
  float hairline = 1.0 - smoothstep(0.0, 1.8, abs(distance + 0.65));
  specular = hairline * (0.15 + 0.65 * light + 0.2 * opposite);
}

vec2 boundedUv(vec2 uv) {
  vec2 texel = 0.5 / uResolution;
  return clamp(uv, texel, vec2(1.0) - texel);
}

// Five taps once, then two extra spectral samples, instead of three blurs.
vec3 blurAt(vec2 uv, float radius) {
  vec2 ox = vec2(radius / uResolution.x, 0.0);
  vec2 oy = vec2(0.0, radius / uResolution.y);
  vec3 c = texture2D(uScene, boundedUv(uv)).rgb * 0.4;
  c += texture2D(uScene, boundedUv(uv + ox)).rgb * 0.15;
  c += texture2D(uScene, boundedUv(uv - ox)).rgb * 0.15;
  c += texture2D(uScene, boundedUv(uv + oy)).rgb * 0.15;
  c += texture2D(uScene, boundedUv(uv - oy)).rgb * 0.15;
  return c;
}

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 applyUniverseEffects(vec3 color, vec2 uv) {
  float noise = (grain(gl_FragCoord.xy) - 0.5) * uNoise * 0.16;
  vec2 centered = uv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  centered.x *= aspect;
  float edge = smoothstep(0.34, 1.35, length(centered));
  color += noise;
  color *= 1.0 - edge * uVignette * 0.62;
  return clamp(color, 0.0, 1.0);
}

void main() {
  vec2 fragPx = gl_FragCoord.xy;
  vec2 uv = fragPx / uResolution;
  vec2 disp = vec2(0.0);
  float coverage = 0.0;
  float rim = 0.0;
  float specular = 0.0;
  if (uPanelCount > 0) panel(fragPx, uCenter0, uHalf0, disp, coverage, rim, specular);
  if (uPanelCount > 1) panel(fragPx, uCenter1, uHalf1, disp, coverage, rim, specular);

  vec3 source = texture2D(uScene, boundedUv(uv)).rgb;
  vec3 color = source;
  if (coverage > 0.0) {
    vec2 refracted = boundedUv(uv + disp / uResolution);
    // The rim stays optically crisp, while the middle gently diffuses detail.
    color = blurAt(refracted, max(uBlur, 0.0) * mix(1.0, 0.35, rim));
    // Spectral strength is a CSS-pixel distance, independent of lens depth
    // and DPR. The default reaches 1.5px per channel only at the rim.
    float spectralRim = smoothstep(0.15, 0.95, rim);
    vec2 direction = disp / max(length(disp), 0.0001);
    vec2 spectral = direction * uChromaPx * spectralRim / uResolution;
    if (uChromaPx > 0.0 && spectralRim > 0.0) {
      vec3 redTap = texture2D(uScene, boundedUv(refracted + spectral)).rgb;
      vec3 blueTap = texture2D(uScene, boundedUv(refracted - spectral)).rgb;
      color.r = mix(color.r, redTap.r, spectralRim * 0.85);
      color.b = mix(color.b, blueTap.b, spectralRim * 0.85);
    }
    // All texture values and RAMS colors are linear here. Paper-relative
    // contrast avoids crushing dark glass or muddying light glass.
    color = uPaper + (color - uPaper) * max(uContrast, 0.0);
    color *= max(uBrightness, 0.0);
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, max(uSaturate, 0.0));
    color = mix(color, uPaper, clamp(uTint, 0.0, 1.0) * mix(1.0, 0.35, rim));
    color = mix(color, vec3(1.0), clamp(uEdge, 0.0, 1.0) * specular * 0.3);
    color = mix(source, color, coverage);
  }
  color = applyUniverseEffects(color, uv);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  // Three renders FBOs in linear working space. Encode exactly once on output.
  #include <colorspace_fragment>
}

`;

export function GlassPass({
  glass,
  panelEls,
  paper,
  universe,
}: {
  glass: LiquidGlassConfig;
  panelEls: React.RefObject<(HTMLElement | null)[]>;
  paper: string;
  universe: SynapsisThemeAppearance["universe"];
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const dpr = useThree((s) => s.viewport.dpr);

  const fbo = useFBO({
    type: gl.extensions.has("EXT_color_buffer_float") ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    stencilBuffer: false,
    samples: Math.min(4, gl.capabilities.maxSamples),
  });

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

  useEffect(() => {
    writeUniverse(objects.uniforms, universe);
  }, [universe, objects]);

  useFrame(() => {
    writeFrame(objects.uniforms, fbo.texture, panelEls.current ?? [], gl.domElement.getBoundingClientRect(), fbo.width, fbo.height, objects.panelBounds);
    if (objects.uniforms.uPanelCount.value === 0 && universe.noise === 0 && universe.vignette === 0) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(objects.postScene, objects.postCamera);
  }, 1);

  return null;
}
