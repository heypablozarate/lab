export type Vec2 = { x: number; y: number }
export type Bands = { voz: number; instrumental: number; cascabeles: number; ritmo2: number }
export type ViewRect = { x: number; y: number; w: number; h: number }
export type Dab = { x: number; y: number; size: number; alpha: number }
export type BrushMod = { pressure: number; climax: number; ink?: number; hold?: boolean }
export type RibbonSample = Vec2 & {
  width: number
  alpha: number
  dryness?: number
  bristleSplit?: number
  headPool?: number
  edgeJitter?: number
}
export type RibbonGeometry = {
  positions: Float32Array
  uvs: Float32Array
  alphas: Float32Array
  indices: Uint16Array | Uint32Array
}
