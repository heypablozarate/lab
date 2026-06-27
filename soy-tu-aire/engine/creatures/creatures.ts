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
  origin: Vec2
  born: number
  baseScale: number
  life: number
  alpha: number
  reveal: RevealMode
  maskNode: InstanceType<PixiModule["Graphics"]> | null
  drift: Vec2
  rotationBase: number
  frameOffset: number
  screenPinned: boolean
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
  drift?: Vec2
  rotation?: number
  frameOffset?: number
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

export function revealProgress(reveal: RevealMode, age: number, life: number): number {
  if (reveal === "hardCut" || reveal === "fade" || reveal === "strokeMask" || reveal === "inkPop") return 1
  if (reveal === "drawLeftToRight") return clamp01(age / 0.42)
  if (reveal === "radialBurst") return clamp01(age / Math.max(0.001, life * 0.07))
  return 1
}

export function creatureAlpha(reveal: RevealMode, age: number, life: number): number {
  if (age < 0 || age > life) return 0
  if (reveal === "hardCut" || reveal === "inkPop") {
    const inAlpha = reveal === "inkPop" ? clamp01(age / 0.08) : 1
    const outStart = life * 0.78
    const outAlpha = age > outStart ? clamp01((life - age) / Math.max(0.001, life - outStart)) : 1
    return inAlpha * outAlpha
  }
  if (reveal === "strokeMask") {
    const inAlpha = clamp01(age / 0.12)
    const outStart = life * 0.72
    const outAlpha = age > outStart ? clamp01((life - age) / Math.max(0.001, life - outStart)) : 1
    return inAlpha * outAlpha
  }
  return fadeAlpha(age, life)
}

export function creatureScaleMultiplier(reveal: RevealMode, age: number, life: number, phase = 0): number {
  if (reveal === "inkPop") {
    const pop = clamp01(age / 0.22)
    const overshoot = Math.sin(pop * Math.PI) * 0.22
    return 0.58 + pop * 0.42 + overshoot
  }
  if (reveal === "hardCut") {
    const settle = Math.min(1, age / Math.max(0.001, life * 0.4))
    return 0.94 + Math.sin((age + phase) * Math.PI * 1.8) * 0.035 * (1 - settle * 0.55)
  }
  const pulse = Math.sin((age + phase) * Math.PI * 1.2) * 0.05
  return 0.92 + Math.min(1, age / life) * 0.1 + pulse
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
    const origin = { x: at.x + presentation.offset.x, y: at.y + presentation.offset.y }
    node.position.set(origin.x, origin.y)
    node.alpha = 0
    const rotationBase = options.rotation ?? (Math.sin(now + at.y * 0.003) * 0.28)
    node.rotation = rotationBase
    // "normal" (not "multiply"): in this Pixi v8 setup, multiply blend makes
    // textured Sprites render invisibly — which is why no creatures ever appeared.
    // Black ink figures on transparent read correctly over the paper as normal.
    node.blendMode = "normal"
    const maxSide = Math.max(firstTexture.width || 1, firstTexture.height || 1)
    const baseScale = presentation.targetLongSide / maxSide
    node.scale.set(baseScale * 0.72)
    this.layerFor(options.layer ?? "overInk").addChild(node)
    const maskNode = options.reveal === "drawLeftToRight" || options.reveal === "radialBurst"
      ? new this.pixi.Graphics()
      : null
    if (maskNode) {
      node.mask = maskNode
      node.parent?.addChild(maskNode)
    }
    this.active.push({
      node,
      origin,
      born: now,
      baseScale,
      life: presentation.life,
      alpha: presentation.alpha,
      reveal: options.reveal ?? "fade",
      maskNode,
      drift: options.drift ?? { x: 0, y: 0 },
      rotationBase,
      frameOffset: options.frameOffset ?? 0,
      screenPinned: options.layer === "screenForeground",
      frames,
      fps: entry.fps,
      loop: entry.loop,
    })
  }

  // Conveyor recycle: keep live creatures pinned to the world as it wraps.
  shift(sx: number, sy: number): void {
    for (const active of this.active) {
      if (active.screenPinned) continue
      active.origin.x += sx
      active.origin.y += sy
      active.node.x += sx
      active.node.y += sy
    }
  }

  draw(now: number): void {
    this.active = this.active.filter((active) => {
      const age = now - active.born
      if (age > active.life) {
        destroyActive(active)
        return false
      }
      // Advance frame sequence (if animated).
      if (active.frames && active.frames.length > 0) {
        const n = active.frames.length
        const raw = Math.floor((age + active.frameOffset) * active.fps)
        const idx = active.loop ? ((raw % n) + n) % n : Math.min(n - 1, raw)
        const tex = active.frames[idx]
        if (active.node.texture !== tex) active.node.texture = tex
      }
      const phase = active.frameOffset
      const alpha = creatureAlpha(active.reveal, age, active.life)
      const driftProgress = easeOutCubic(clamp01(age / Math.max(0.001, active.life * 0.78)))
      active.node.alpha = alpha * active.alpha
      active.node.position.set(
        active.origin.x + active.drift.x * driftProgress,
        active.origin.y + active.drift.y * driftProgress + Math.sin((age + phase) * 4.2) * 2.8,
      )
      active.node.rotation = active.rotationBase + Math.sin((age + phase) * 3.1) * 0.045
      active.node.scale.set(active.baseScale * creatureScaleMultiplier(active.reveal, age, active.life, phase))
      if (active.maskNode) {
        const progress = revealProgress(active.reveal, age, active.life)
        active.maskNode.clear()
        if (active.reveal === "drawLeftToRight") {
          const bounds = active.node.getLocalBounds()
          active.maskNode
            .rect(
              active.node.x + bounds.x * active.node.scale.x,
              active.node.y + bounds.y * active.node.scale.y,
              bounds.width * active.node.scale.x * progress,
              bounds.height * active.node.scale.y,
            )
            .fill({ color: 0xffffff, alpha: 1 })
        } else if (active.reveal === "radialBurst") {
          active.maskNode
            .circle(active.node.x, active.node.y, Math.max(active.node.width, active.node.height) * progress * 0.72)
            .fill({ color: 0xffffff, alpha: 1 })
        }
      }
      return true
    })
  }

  destroy(): void {
    for (const active of this.active) {
      destroyActive(active)
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3
}

function destroyActive(active: Active): void {
  active.maskNode?.parent?.removeChild(active.maskNode)
  active.maskNode?.destroy()
  active.node.parent?.removeChild(active.node)
  active.node.destroy()
}
