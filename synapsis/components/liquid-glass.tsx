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
  /** Rim spectral strength (0..1): up to 2 CSS px per R/B channel. 0 = clean glass. */
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

// Shared optical behavior, with theme-specific transmission for readable DOM
// content. The development DialKit remains an opt-in override of this seed.
export const LIGHT_LIQUID_GLASS: LiquidGlassConfig = {
  radius: 24,
  rimWidth: 0.24,
  depth: 22,
  chromaticAberration: 0.75,
  blur: 2.25,
  contrast: 1.04,
  brightness: 1,
  saturate: 1.03,
  tint: 0.18,
  edgeHighlight: 0.28,
};

export const DARK_LIQUID_GLASS: LiquidGlassConfig = {
  ...LIGHT_LIQUID_GLASS,
  tint: 0.24,
  edgeHighlight: 0.18,
};
