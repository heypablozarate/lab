export type Vec2 = { x: number; y: number }
export type Bands = { voz: number; instrumental: number; cascabeles: number; ritmo2: number }
export type ViewRect = { x: number; y: number; w: number; h: number }
export type BrushMod = { pressure: number; climax: number; ink?: number; hold?: boolean }
// Where (and toward where) the pen should touch down again after an image was
// "drawn" by the stroke: `pos` is just inside the image's exit edge, `dir` the
// forward direction the resumed line should continue in.
export type BrushResumeHint = { pos: Vec2; dir: Vec2 }
export type RibbonSample = Vec2 & {
  width: number
  alpha: number
  dryness?: number
  bristleSplit?: number
  headPool?: number
  edgeJitter?: number
  // Broad-nib axis angle (radians) at this sample. The visible ribbon width is
  // modulated by how perpendicular the stroke direction is to this axis, so the
  // same stroke collapses to a hairline when it runs along the nib and swells to
  // a full belly when it turns across it — the calligraphic thick/thin.
  nib?: number
}
export type RibbonGeometry = {
  positions: Float32Array
  uvs: Float32Array
  alphas: Float32Array
  indices: Uint16Array | Uint32Array
}
