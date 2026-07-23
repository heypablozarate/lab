/* Liquid glass config for the Synapsis panels.

   The refraction itself is rendered in WebGL (see `glass-pass.tsx`) rather than
   with CSS `backdrop-filter: url(#svg)`, because Safari/WebKit does not support
   SVG filters inside `backdrop-filter` (WebKit bug 245510). Doing the SDF
   displacement + chromatic aberration as a shader over the r3f scene gives the
   same "real glass" look in Chrome, Safari and Firefox from one code path.

   This module is just the tunable shape shared by the WebGL pass and the
   dev-only Interface Craft panel (`synapsis-dials.tsx`). */

export type LiquidGlassConfig = {
  /** Corner radius (px) of the refraction lens — also drives the DOM clip. */
  radius: number;
  /** How far the refraction reaches inward from the edge (0..1 of half-size). */
  rimWidth: number;
  /** Displacement strength in px — how hard the rim bends the background. */
  depth: number;
  /** Rim colour fringing (0..1). 0 = clean glass. */
  chromaticAberration: number;
  /** Backdrop blur radius (px). */
  blur: number;
  contrast: number;
  brightness: number;
  saturate: number;
  /** Paper tint opacity (0..1) behind the panel content for legibility. */
  tint: number;
  /** Specular rim highlight opacity (0..1). */
  edgeHighlight: number;
};

// Tuned by Pablo (2026-07-23). Picked by effectiveTheme in galaxy-stage; the
// dev DialKit still overrides the active theme while tuning.
export const LIGHT_LIQUID_GLASS: LiquidGlassConfig = {
  radius: 20,
  rimWidth: 0.1,
  depth: 16,
  chromaticAberration: 0.39,
  blur: 6,
  contrast: 1.39,
  brightness: 0.91,
  saturate: 1.45,
  tint: 0.53,
  edgeHighlight: 0.43,
};

export const DARK_LIQUID_GLASS: LiquidGlassConfig = {
  radius: 20,
  rimWidth: 0.1,
  depth: 16,
  chromaticAberration: 0.39,
  blur: 6,
  contrast: 1.39,
  brightness: 0.91,
  saturate: 1.45,
  tint: 0.53,
  edgeHighlight: 0.43,
};
