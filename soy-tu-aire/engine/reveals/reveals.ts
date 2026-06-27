import { fadeAlpha } from "./fade"
import type { StrokeAnchor } from "../brush/stroke-history"
import type { Vec2 } from "../types"
import type { PixiModule, PixiStage } from "../render/pixi-stage"

const LIFE = 3
// Target longest side of a PNG word-sprite in paper-space pixels.
const PNG_TARGET_SIZE = 360

type Texture = InstanceType<PixiModule["Texture"]>

type Active = {
  // null until the PNG resolves (or forever, if the word has no image — then it
  // simply never renders). We never fall back to generic text: only the artist's
  // hand-drawn word PNGs appear, like the original.
  node: InstanceType<PixiModule["Sprite"]> | null
  born: number
  alive: boolean
}

export type RevealStrokeOffset = { along: number; normal: number }

export type RevealSpawnOptions = {
  strokeAnchor?: StrokeAnchor | null
  strokeOffset?: RevealStrokeOffset
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

export class Reveals {
  private active: Active[] = []
  /** Per-word texture cache so repeat spawns skip the network round-trip. */
  private textureCache = new Map<string, Texture | null>()

  constructor(private stage: PixiStage, private pixi: PixiModule) {}

  spawn(word: string, at: Vec2, now: number, options: RevealSpawnOptions = {}): void {
    const strokePlacement = options.strokeAnchor
      ? positionRevealOnStroke(options.strokeAnchor, options.strokeOffset ?? { along: 0, normal: -0.18 })
      : null
    const spawnAt = strokePlacement ? { x: strokePlacement.x, y: strokePlacement.y } : at
    const rotation = strokePlacement?.rotation ?? (Math.sin(now + at.x * 0.002) * Math.PI) / 28
    const active: Active = { node: null, born: now, alive: true }
    this.active.push(active)

    const cached = this.textureCache.get(word)
    if (cached === null) return // known to have no PNG → render nothing
    if (cached) {
      this.attachSprite(active, cached, spawnAt, rotation)
      return
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
  }

  private attachSprite(active: Active, texture: Texture, at: Vec2, rotation: number): void {
    const sprite = new this.pixi.Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(at.x, at.y)
    sprite.alpha = 0
    sprite.rotation = rotation
    // Hand-drawn word PNGs include white-on-transparent text meant to read over
    // the dark ink stroke; "normal" keeps white visible (multiply would hide it).
    sprite.blendMode = "normal"
    const orig = texture.orig ?? texture.frame
    const longest = Math.max(orig.width, orig.height)
    if (longest > 0) sprite.scale.set(PNG_TARGET_SIZE / longest)
    this.stage.overInkLayer.addChild(sprite)
    active.node = sprite
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
        if (active.node) {
          active.node.parent?.removeChild(active.node)
          active.node.destroy()
        }
        active.alive = false
        return false
      }
      if (active.node) {
        const alpha = fadeAlpha(age, LIFE)
        active.node.alpha = alpha * 0.72
        const orig = active.node.texture.orig ?? active.node.texture.frame
        const longest = Math.max(orig.width, orig.height)
        const breathe = 0.92 + Math.min(1, age / LIFE) * 0.1
        if (longest > 0) active.node.scale.set((PNG_TARGET_SIZE / longest) * breathe)
      }
      return true
    })
  }

  destroy(): void {
    for (const active of this.active) {
      if (active.node) {
        active.node.parent?.removeChild(active.node)
        active.node.destroy()
      }
      active.alive = false
    }
    this.active = []
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
