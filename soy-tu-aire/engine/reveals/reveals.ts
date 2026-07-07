import type { StrokeAnchor } from "../brush/stroke-history"
import type { BrushResumeHint, Vec2 } from "../types"
import type { PixiModule, PixiStage } from "../render/pixi-stage"

const LIFE = 3
// Target longest side of a PNG word-sprite in paper-space pixels.
export const WORD_TARGET_LONG_SIDE = 360
export const WORD_REVEAL_LEADING_OFFSET = WORD_TARGET_LONG_SIDE / 2
// How far the word's leading edge tucks back INTO the painted stroke tip, so
// the word grows out of the line instead of floating detached ahead of it.
export const WORD_ENTRY_OVERLAP = 26
const WORD_REVEAL_SPEED = 560
// How long the word takes to "write" itself in. Derived from display size so the
// reveal keeps pace with the moving brush instead of lingering as a separate fade.
export const WORD_WRITE_TIME = wordWriteSecondsForLongSide()
// The four hand-drawn word PNGs that form as part of the brush stroke: the pen
// stops, the word draws itself left-to-right along the trace, then the pen
// resumes. Every other lyric cue still renders nothing (no generic text).
const REVEAL_TEXTURE_NAMES = new Set(["cuelo", "lagrima", "surco", "cosquilla"])

type Texture = InstanceType<PixiModule["Texture"]>

type Active = {
  // null until the PNG resolves (or forever, if the word has no image — then it
  // simply never renders). We never fall back to generic text: only the artist's
  // hand-drawn word PNGs appear, like the original.
  node: InstanceType<PixiModule["Sprite"]> | null
  maskNode: InstanceType<PixiModule["Graphics"]> | null
  born: number
  alive: boolean
  targetLongSide: number
  writeSeconds: number
}

export type RevealStrokeOffset = { along: number; normal: number }

export type RevealSpawnOptions = {
  strokeAnchor?: StrokeAnchor | null
  strokeOffset?: RevealStrokeOffset
  targetLongSide?: number
  writeSeconds?: number
}

export function wordWriteSecondsForLongSide(longSide = WORD_TARGET_LONG_SIDE): number {
  const seconds = Math.max(0.28, Math.min(0.82, longSide / WORD_REVEAL_SPEED))
  return round(seconds)
}

export function positionRevealOnStroke(
  anchor: StrokeAnchor,
  offset: RevealStrokeOffset,
): { x: number; y: number; rotation: number } {
  return {
    x: round(anchor.x + anchor.tangent.x * offset.along + anchor.normal.x * anchor.width * offset.normal),
    y: round(anchor.y + anchor.tangent.y * offset.along + anchor.normal.y * anchor.width * offset.normal),
    rotation: round(Math.atan2(anchor.tangent.y, anchor.tangent.x)),
  }
}

export function hasRevealTexture(word: string): boolean {
  return REVEAL_TEXTURE_NAMES.has(word)
}

// Where the pen touches down again after a word writes itself in: just inside
// the word's trailing edge along the trace (the word PNGs end in thin
// calligraphic tails, so the resumed line grows out of the last letter).
export function wordResumePoint(center: Vec2, rotation: number, longSide: number): Vec2 {
  const inset = Math.min(16, Math.max(8, longSide * 0.03))
  const reach = Math.max(0, longSide / 2 - inset)
  return {
    x: round(center.x + Math.cos(rotation) * reach),
    y: round(center.y + Math.sin(rotation) * reach),
  }
}

export class Reveals {
  private active: Active[] = []
  /** Per-word texture cache so repeat spawns skip the network round-trip. */
  private textureCache = new Map<string, Texture | null>()

  constructor(private stage: PixiStage, private pixi: PixiModule) {}

  // Returns where (and toward where) the brush should resume painting once the
  // word has written itself in, or null when the word renders nothing.
  spawn(word: string, at: Vec2, now: number, options: RevealSpawnOptions = {}): BrushResumeHint | null {
    const cached = this.textureCache.get(word)
    if (cached === null) return null // known to have no PNG -> render nothing
    if (!cached && !hasRevealTexture(word)) {
      this.textureCache.set(word, null)
      return null
    }

    void now
    const placed = options.strokeAnchor
      ? positionRevealOnStroke(options.strokeAnchor, options.strokeOffset ?? { along: 0, normal: 0 })
      : { x: at.x, y: at.y, rotation: 0 }
    const spawnAt = { x: placed.x, y: placed.y }
    const rotation = placed.rotation
    const targetLongSide = options.targetLongSide ?? WORD_TARGET_LONG_SIDE
    const active: Active = {
      node: null,
      maskNode: null,
      born: now,
      alive: true,
      targetLongSide,
      writeSeconds: options.writeSeconds ?? wordWriteSecondsForLongSide(targetLongSide),
    }
    this.active.push(active)

    const resume: BrushResumeHint = {
      pos: wordResumePoint(spawnAt, rotation, targetLongSide),
      dir: { x: Math.cos(rotation), y: Math.sin(rotation) },
    }
    if (cached) {
      this.attachSprite(active, cached, spawnAt, rotation)
      return resume
    }
    // First time for this word — try to load its PNG. Show nothing meanwhile.
    this.pixi.Assets.load(`/lab/soy-tu-aire/creatures/${word}.png`)
      .then((texture: Texture) => {
        this.textureCache.set(word, texture)
        if (active.alive) this.attachSprite(active, texture, spawnAt, rotation)
      })
      .catch(() => {
        this.textureCache.set(word, null) // no image for this word; never show
      })
    return resume
  }

  private attachSprite(active: Active, texture: Texture, at: Vec2, rotation: number): void {
    const sprite = new this.pixi.Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(at.x, at.y)
    sprite.alpha = 1
    sprite.rotation = rotation
    // Hand-drawn word PNGs include white-on-transparent text meant to read over
    // the dark ink stroke; "normal" keeps white visible (multiply would hide it).
    sprite.blendMode = "normal"
    const orig = texture.orig ?? texture.frame
    const longest = Math.max(orig.width, orig.height)
    if (longest > 0) sprite.scale.set(active.targetLongSide / longest)
    this.stage.overInkLayer.addChild(sprite)
    const maskNode = new this.pixi.Graphics()
    sprite.mask = maskNode
    this.stage.overInkLayer.addChild(maskNode)
    active.node = sprite
    active.maskNode = maskNode
  }

  // Conveyor recycle: keep live words pinned to the world as it wraps.
  shift(sx: number, sy: number): void {
    for (const active of this.active) {
      if (active.node) {
        active.node.x += sx
        active.node.y += sy
      }
    }
  }

  draw(now: number): void {
    this.active = this.active.filter((active) => {
      const age = now - active.born
      if (age > LIFE) {
        destroyActive(active)
        active.alive = false
        return false
      }
      if (active.node) {
        active.node.alpha = 1
        const orig = active.node.texture.orig ?? active.node.texture.frame
        const longest = Math.max(orig.width, orig.height)
        const scale = longest > 0 ? active.targetLongSide / longest : 1
        active.node.scale.set(scale)
        if (active.maskNode) {
          const progress = Math.min(1, Math.max(0, age / active.writeSeconds))
          if (progress >= 1) {
            active.node.mask = null
            active.maskNode.parent?.removeChild(active.maskNode)
            active.maskNode.destroy()
            active.maskNode = null
          } else {
            // Left-to-right "writing" wipe oriented along the stroke: reveal a
            // growing slice of the word from its leading (left) edge, rotated to
            // match the trace so it reads as part of the same brush line.
            drawWriteMask(
              active.maskNode,
              active.node.x,
              active.node.y,
              active.node.rotation,
              orig.width * scale,
              orig.height * scale,
              progress,
            )
          }
        }
      }
      return true
    })
  }

  destroy(): void {
    for (const active of this.active) {
      destroyActive(active)
      active.alive = false
    }
    this.active = []
  }
}

type WriteMaskTarget = {
  clear(): WriteMaskTarget | void
  poly(points: number[]): { fill(style: unknown): unknown }
}

// Draw the writing wipe: a rectangle covering the word's leading `progress`
// fraction (from the left edge), rotated by `rotation` around the word centre so
// the reveal advances along the trace direction rather than screen-horizontally.
export function drawWriteMask(
  mask: WriteMaskTarget,
  cx: number,
  cy: number,
  rotation: number,
  width: number,
  height: number,
  progress: number,
): void {
  mask.clear()
  if (progress <= 0 || width <= 0 || height <= 0) return
  const halfW = width / 2
  const halfH = height / 2
  const leadX = -halfW + width * Math.min(1, progress)
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const toWorld = (lx: number, ly: number): { x: number; y: number } => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  })
  const corners = [
    toWorld(-halfW, -halfH),
    toWorld(leadX, -halfH),
    toWorld(leadX, halfH),
    toWorld(-halfW, halfH),
  ]
  mask.poly(corners.flatMap((point) => [point.x, point.y])).fill({ color: 0xffffff, alpha: 1 })
}

function destroyActive(active: Active): void {
  active.maskNode?.parent?.removeChild(active.maskNode)
  active.maskNode?.destroy()
  active.maskNode = null
  active.node?.parent?.removeChild(active.node)
  active.node?.destroy()
  active.node = null
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
