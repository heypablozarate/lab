import { fadeAlpha } from "../reveals/fade"
import type { Vec2 } from "../types"
import type { DirectedLayer, RevealMode } from "../directing/event-directives"
import type { PixiModule, PixiStage } from "../render/pixi-stage"

const LIFE = 4

// Per-sprite target long-side size in PAPER space (tunable). Any name not
// listed falls back to DEFAULT_TARGET. These are intentionally easy to tweak.
const DEFAULT_TARGET = 220
const TARGET_SIZE: Record<string, number> = {
  chica: 360,
  Entradaagujero: 500,
  Salidaagujero: 460,
  Ogrande: 390,
  labios: 360,
  salpico: 760,
  alambre: 620, // wide thin barbed wire
  cremallera: 460, // wide thin zipper
  dandelion: 320,
  pececillo: 200,
  pajaros: 170,
  mariposa: 150,
  mariposanoloop: 150,
  surco: 330,
  lagrima: 340,
  uno: 320,
  cosquilla: 380,
}

type Texture = InstanceType<PixiModule["Texture"]>

// A registered creature: a single static texture, or an ordered frame sequence
// that advances over time. `koi` (when present) is a one-off static texture used
// for the very first spawn of that name (e.g. pececillo's detailed koi drawing).
type Entry = {
  frames: Texture[]
  fps: number
  loop: boolean
  koi: Texture | null
}

type Active = {
  node: InstanceType<PixiModule["Sprite"]>
  born: number
  baseScale: number
  life: number
  alpha: number
  reveal: RevealMode
  // null => static (no per-frame swap). Otherwise the frame sequence to play.
  frames: Texture[] | null
  fps: number
  loop: boolean
}

export type FrameOpts = { fps?: number; loop?: boolean; koi?: Texture | null }

export type CreatureSpawnOptions = {
  targetLongSide?: number
  life?: number
  alpha?: number
  offset?: Vec2
  layer?: DirectedLayer
  reveal?: RevealMode
}

type CreaturePresentation = {
  targetLongSide: number
  life: number
  alpha: number
  offset: Vec2
}

export function resolveCreaturePresentation(
  name: string,
  options: CreatureSpawnOptions = {},
): CreaturePresentation {
  return {
    targetLongSide: options.targetLongSide ?? (TARGET_SIZE[name] ?? DEFAULT_TARGET),
    life: options.life ?? LIFE,
    alpha: options.alpha ?? 1,
    offset: options.offset ?? { x: 0, y: 0 },
  }
}

export class Creatures {
  private entries = new Map<string, Entry>()
  private spawnCount = new Map<string, number>()
  private active: Active[] = []

  constructor(private stage: PixiStage, private pixi: PixiModule) {}

  // Static single-texture creature (original behavior).
  register(name: string, texture: Texture): void {
    const prev = this.entries.get(name)
    this.entries.set(name, {
      frames: [texture],
      fps: 0,
      loop: false,
      koi: prev?.koi ?? null,
    })
  }

  // Animated multi-frame creature. `opts.koi` is an optional static texture used
  // for the first spawn only (the rest use the frame sequence).
  registerFrames(name: string, textures: Texture[], opts: FrameOpts = {}): void {
    if (textures.length === 0) return
    this.entries.set(name, {
      frames: textures,
      fps: opts.fps ?? 12,
      loop: opts.loop ?? true,
      koi: opts.koi ?? null,
    })
  }

  spawn(name: string, at: Vec2, now: number, options: CreatureSpawnOptions = {}): void {
    const entry = this.entries.get(name)
    if (!entry) return

    const count = this.spawnCount.get(name) ?? 0
    this.spawnCount.set(name, count + 1)

    // First spawn uses the koi single texture if registered; later spawns animate.
    const useKoi = count === 0 && entry.koi !== null
    const frames: Texture[] | null = useKoi ? null : (entry.fps > 0 ? entry.frames : null)
    const firstTexture = useKoi ? (entry.koi as Texture) : entry.frames[0]
    const presentation = resolveCreaturePresentation(name, options)

    const node = new this.pixi.Sprite(firstTexture)
    node.anchor.set(0.5)
    node.position.set(at.x + presentation.offset.x, at.y + presentation.offset.y)
    node.alpha = 0
    node.rotation = Math.sin(now + at.y * 0.003) * 0.28
    // "normal" (not "multiply"): in this Pixi v8 setup, multiply blend makes
    // textured Sprites render invisibly — which is why no creatures ever appeared.
    // Black ink figures on transparent read correctly over the paper as normal.
    node.blendMode = "normal"
    const maxSide = Math.max(firstTexture.width || 1, firstTexture.height || 1)
    const baseScale = presentation.targetLongSide / maxSide
    node.scale.set(baseScale * 0.72)
    this.layerFor(options.layer ?? "overInk").addChild(node)
    this.active.push({
      node,
      born: now,
      baseScale,
      life: presentation.life,
      alpha: presentation.alpha,
      reveal: options.reveal ?? "fade",
      frames,
      fps: entry.fps,
      loop: entry.loop,
    })
  }

  // Conveyor recycle: keep live creatures pinned to the world as it wraps.
  shift(sx: number, sy: number): void {
    for (const active of this.active) {
      active.node.x += sx
      active.node.y += sy
    }
  }

  draw(now: number): void {
    this.active = this.active.filter((active) => {
      const age = now - active.born
      if (age > active.life) {
        active.node.parent?.removeChild(active.node)
        active.node.destroy()
        return false
      }
      // Advance frame sequence (if animated).
      if (active.frames && active.frames.length > 0) {
        const n = active.frames.length
        const raw = Math.floor(age * active.fps)
        const idx = active.loop ? ((raw % n) + n) % n : Math.min(n - 1, raw)
        const tex = active.frames[idx]
        if (active.node.texture !== tex) active.node.texture = tex
      }
      const alpha = fadeAlpha(age, active.life)
      const pulse = Math.sin(age * Math.PI * 1.2) * 0.08
      active.node.alpha = alpha * active.alpha
      active.node.scale.set(active.baseScale * (0.82 + Math.min(1, age / active.life) * 0.28 + pulse))
      return true
    })
  }

  destroy(): void {
    for (const active of this.active) {
      active.node.parent?.removeChild(active.node)
      active.node.destroy()
    }
    this.active = []
    this.entries.clear()
    this.spawnCount.clear()
  }

  private layerFor(layer: DirectedLayer): InstanceType<PixiModule["Container"]> {
    if (layer === "underInk") return this.stage.underInkLayer
    if (layer === "insideInk") return this.stage.insideInkLayer
    if (layer === "foreground") return this.stage.foregroundLayer
    if (layer === "screenForeground") return this.stage.screenForegroundLayer
    return this.stage.overInkLayer
  }
}
