import type { BrushResumeHint, RibbonSample, Vec2 } from "../types"
import type { DirectedLayer, RevealMode, StrokeFitDirective } from "../directing/event-directives"
import type { PixiModule, PixiStage } from "../render/pixi-stage"

const LIFE = 4

// Per-sprite target long-side size in PAPER space (tunable). Any name not
// listed falls back to DEFAULT_TARGET. These are intentionally easy to tweak.
const DEFAULT_TARGET = 220
const TARGET_SIZE: Record<string, number> = {
  chica: 360,
  EntradaagujeroPortal: 500,
  Salidaagujero: 460,
  Ogrande: 390,
  labios: 360,
  salpico: 760,
  alambre: 620, // wide thin barbed wire
  cremallera: 460, // wide thin zipper
  dandelion: 320,
  pececillo: 200,
  pajaros: 170,
  pajarosVolando: 130,
  mariposa: 150,
  mariposanoloop: 150,
  mariposanoloopVolando: 135,
  surco: 330,
  lagrima: 340,
  uno: 320,
  cosquilla: 380,
}

type Texture = InstanceType<PixiModule["Texture"]>
type SpriteNode = InstanceType<PixiModule["Sprite"]>
type DisplayNode = InstanceType<PixiModule["Container"]>
export type FramePlayback = "once" | "loop" | "bounce"

// A registered creature: a single static texture, or an ordered frame sequence
// that advances over time. `koi` (when present) is a one-off static texture used
// for the very first spawn of that name (e.g. pececillo's detailed koi drawing).
type Entry = {
  frames: Texture[]
  fps: number
  playback: FramePlayback
  koi: Texture | null
}

type Active = {
  node: DisplayNode
  sprite: SpriteNode | null
  ownedTextures: Texture[]
  origin: Vec2
  revealOrigin: Vec2
  born: number
  baseScale: number
  targetLongSide: number
  life: number
  reveal: RevealMode
  revealDuration?: number
  maskNode: InstanceType<PixiModule["Graphics"]> | null
  strokeFit: StrokeFitPath | null
  // Bright light behind the portal takeover (the man is silhouetted against it).
  bloomNode: InstanceType<PixiModule["Graphics"]> | null
  drift: Vec2
  rotationBase: number
  frameOffset: number
  screenPinned: boolean
  fixed: boolean
  // Continuous flow motion: the creature rides the painted line in its flow
  // direction (`flow`), weaving around it (`orbitN` is the unit normal, with
  // amplitude/frequency), decelerating from its initial drift. It never fades
  // out — it simply travels until it leaves the camera and is then removed.
  expiresAtLife: boolean
  flow: Vec2
  orbitN: Vec2
  orbitAmp: number
  orbitFreq: number
  driftT: number
  // null => static (no per-frame swap). Otherwise the frame sequence to play.
  frames: Texture[] | null
  fps: number
  playback: FramePlayback
}

// Residual flow speed (paper px/s) kept after the initial drift decelerates, so
// a creature always keeps creeping along the line until it leaves the frame.
const RESIDUAL_FLOW = 28
const ENTRY_GRACE = 0.16
const CIRCULAR_REVEAL_TIME = 0.22
const BRUSH_DRAW_REVEAL_TIME = 0.95
const BRUSH_DRAW_REVEAL_SPEED = 540
const STROKE_EMBEDDED_REVEAL_TIME = 0.62
const STROKE_EMBEDDED_SLICE_TARGET = 24
const STROKE_EMBEDDED_MAX_SLICES = 26

const STROKE_EMBEDDED_TEXTURE_BOUNDS: Record<string, { x: number; y: number; width: number; height: number }> = {
  cremallera: { x: 34, y: 32, width: 903, height: 61 },
  alambre: { x: 0, y: 388, width: 1774, height: 137 },
}

const STROKE_EMBEDDED_STYLE: Record<string, { thicknessScale: number; overlap: number }> = {
  cremallera: { thicknessScale: 0.94, overlap: 1.25 },
  alambre: { thicknessScale: 1.12, overlap: 2.2 },
}

export type FrameOpts = { fps?: number; loop?: boolean; playback?: FramePlayback; koi?: Texture | null }

export type CreatureSpawnOptions = {
  targetLongSide?: number
  life?: number
  offset?: Vec2
  drift?: Vec2
  rotation?: number
  frameOffset?: number
  layer?: DirectedLayer
  reveal?: RevealMode
  strokeFit?: StrokeFitDirective
  strokeSamples?: readonly RibbonSample[]
  fixed?: boolean
  revealDuration?: number
}

type CreaturePresentation = {
  targetLongSide: number
  life: number
  offset: Vec2
}

type StrokeFitPath = {
  midpoint: Vec2
  relativePoints: Vec2[]
  width: number
  length: number
  angle: number
  revealSeconds: number
}

// Directed sizes are paper-space and shrink with the camera zoom, so the
// smallest marks (seeds, scratches, hole beads) could all but disappear on wide
// shots. Every spawn is lifted to this on-screen floor so it stays readable
// without touching the choreography of the larger pieces.
const MIN_SCREEN_LONG_SIDE = 64

export function ensureVisibleLongSide(targetLongSide: number, worldScale: number): number {
  const scale = Math.abs(worldScale) || 1
  const minPaper = MIN_SCREEN_LONG_SIDE / scale
  return targetLongSide >= minPaper ? targetLongSide : Math.round(minPaper)
}

// Where the pen touches down again after an image is "drawn" by the stroke:
// the trailing edge of the left-to-right wipe, pulled slightly inside the image
// so the resumed line overlaps the art instead of leaving a gap.
export function brushResumePoint(center: Vec2, width: number): Vec2 {
  const inset = Math.min(30, Math.max(8, width * 0.08))
  return { x: center.x + Math.max(0, width * 0.5 - inset), y: center.y }
}

// The artist's PNGs for stroke-drawn figures carry ink-smudge zones meant to
// fuse with the trace: the trace feeds INTO the entry smudge and grows back out
// of the exit smudge. Coordinates are texture pixels (top-left origin), read
// off each PNG's connection marks.
export const BRUSH_DRAW_ANCHORS: Record<string, { entry: Vec2; exit: Vec2 }> = {
  chica: { entry: { x: 20, y: 468 }, exit: { x: 812, y: 355 } },
  labios: { entry: { x: 285, y: 635 }, exit: { x: 1062, y: 645 } },
  Ogrande: { entry: { x: 175, y: 665 }, exit: { x: 1205, y: 665 } },
}

// How far the artwork's connection points tuck INTO the painted line (paper
// px): the entry smudge overlaps the stroke tip and the pen resumes slightly
// inside the exit smudge, so both joins read as one continuous trace.
const BRUSH_DRAW_JOIN_OVERLAP = 14

// Position an anchored stroke-drawn image so its entry smudge sits on the
// stroke tip, and compute where the pen resumes (just inside its exit smudge).
export function anchoredBrushDrawPlacement(
  tip: Vec2,
  anchor: { entry: Vec2; exit: Vec2 },
  textureWidth: number,
  textureHeight: number,
  scale: number,
): { origin: Vec2; resume: Vec2 } {
  const halfW = textureWidth / 2
  const halfH = textureHeight / 2
  const origin = {
    x: tip.x - (anchor.entry.x - halfW) * scale - BRUSH_DRAW_JOIN_OVERLAP,
    y: tip.y - (anchor.entry.y - halfH) * scale,
  }
  return {
    origin,
    resume: {
      x: origin.x + (anchor.exit.x - halfW) * scale - BRUSH_DRAW_JOIN_OVERLAP,
      y: origin.y + (anchor.exit.y - halfH) * scale,
    },
  }
}

export function resolveCreaturePresentation(
  name: string,
  options: CreatureSpawnOptions = {},
): CreaturePresentation {
  return {
    targetLongSide: options.targetLongSide ?? (TARGET_SIZE[name] ?? DEFAULT_TARGET),
    life: options.life ?? LIFE,
    offset: options.offset ?? { x: 0, y: 0 },
  }
}

export function brushDrawRevealDuration(targetLongSide: number): number {
  const seconds = Math.max(0.28, Math.min(0.85, targetLongSide / BRUSH_DRAW_REVEAL_SPEED))
  return roundTime(seconds)
}

export function revealProgress(
  reveal: RevealMode,
  age: number,
  life: number,
  revealDuration?: number,
): number {
  if (reveal === "hardCut" || reveal === "portalTakeover") return 1
  if (reveal === "fade" || reveal === "strokeMask" || reveal === "strokeBorn") {
    return clamp01(age / CIRCULAR_REVEAL_TIME)
  }
  if (reveal === "inkPop") return clamp01(age / 0.12)
  if (reveal === "drawLeftToRight") return clamp01(age / 0.42)
  if (reveal === "brushDraw") return clamp01(age / (revealDuration ?? BRUSH_DRAW_REVEAL_TIME))
  if (reveal === "strokeEmbedded") return clamp01(age / STROKE_EMBEDDED_REVEAL_TIME)
  if (reveal === "radialBurst") return clamp01(age / Math.max(0.001, life * 0.07))
  return 1
}

export function creatureScaleMultiplier(reveal: RevealMode, age: number, life: number, phase = 0): number {
  if (reveal === "portalTakeover") {
    // Camera diving into the hole: the figure is born small inside the trace,
    // grows to a readable size, then keeps zooming PAST the viewport until only
    // the PNG's transparent centre fills the screen (the "we went through it"
    // beat). It never shrinks or pops away — by the time it is removed there is
    // nothing opaque left on screen.
    const enter = easeOutCubic(clamp01(age / 0.5))
    const dive = clamp01(age / Math.max(0.001, life))
    const zoom = dive ** 1.5 * 3.6
    const breathe = Math.sin((age + phase) * Math.PI * 2.2) * 0.02
    return 0.08 + enter * 0.5 + zoom + breathe
  }
  if (reveal === "inkPop") {
    const pop = clamp01(age / 0.22)
    const overshoot = Math.sin(pop * Math.PI) * 0.22
    return 0.58 + pop * 0.42 + overshoot
  }
  if (reveal === "strokeBorn") {
    const grow = clamp01(age / 0.18)
    const dry = clamp01(age / Math.max(0.001, life * 0.72))
    const wobble = Math.sin((age + phase) * Math.PI * 5.8) * 0.018 * (1 - dry)
    return 0.22 + easeOutCubic(grow) * 0.78 + wobble
  }
  if (reveal === "radialBurst") {
    const settle = clamp01(age / 0.24)
    const impact = Math.sin(settle * Math.PI) * 0.08
    return 0.96 + impact
  }
  if (reveal === "hardCut") {
    const settle = Math.min(1, age / Math.max(0.001, life * 0.4))
    return 0.94 + Math.sin((age + phase) * Math.PI * 1.8) * 0.035 * (1 - settle * 0.55)
  }
  const pulse = Math.sin((age + phase) * Math.PI * 1.2) * 0.05
  return 0.92 + Math.min(1, age / life) * 0.1 + pulse
}

// Entrance-only scale for flow creatures: they grow in from the line, then hold
// their size (they leave by travelling out of frame, never by shrinking away).
export function creatureEntranceScale(reveal: RevealMode, age: number): number {
  if (reveal === "inkPop") {
    const pop = clamp01(age / 0.22)
    return 0.58 + pop * 0.42 + Math.sin(pop * Math.PI) * 0.18
  }
  if (reveal === "radialBurst") {
    const settle = clamp01(age / 0.24)
    return 0.94 + Math.sin(settle * Math.PI) * 0.08
  }
  if (reveal === "strokeBorn") {
    return 0.24 + easeOutCubic(clamp01(age / 0.18)) * 0.76
  }
  if (reveal === "brushDraw") {
    return 1
  }
  if (reveal === "strokeEmbedded") {
    return 1
  }
  // hardCut / fade / others: a quick pop to full size.
  return 0.6 + easeOutCubic(clamp01(age / 0.14)) * 0.4
}

export function creatureExpiresAtLife(
  reveal: RevealMode,
  targetLongSide: number,
  life: number,
  isPortal = false,
): boolean {
  if (isPortal) return true
  if (life <= 1.1) return true
  return reveal === "inkPop" && targetLongSide <= 180
}

export function frameIndexForPlayback(rawFrame: number, frameCount: number, playback: FramePlayback): number {
  if (frameCount <= 1) return 0
  if (playback === "once") return Math.max(0, Math.min(frameCount - 1, rawFrame))
  if (playback === "bounce") {
    const period = frameCount * 2 - 2
    const wrapped = ((rawFrame % period) + period) % period
    return wrapped < frameCount ? wrapped : period - wrapped
  }
  return ((rawFrame % frameCount) + frameCount) % frameCount
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
      playback: "once",
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
      playback: opts.playback ?? (opts.loop === false ? "once" : "loop"),
      koi: opts.koi ?? null,
    })
  }

  // Returns where (and toward where) the brush should resume painting when
  // this creature is "drawn" by the stroke (brushDraw/drawLeftToRight reveals),
  // or null when the stroke does not need to detour around it.
  spawn(name: string, at: Vec2, now: number, options: CreatureSpawnOptions = {}): BrushResumeHint | null {
    const entry = this.entries.get(name)
    if (!entry) return null

    const count = this.spawnCount.get(name) ?? 0
    this.spawnCount.set(name, count + 1)

    // First spawn uses the koi single texture if registered; later spawns animate.
    const useKoi = count === 0 && entry.koi !== null
    const frames: Texture[] | null = useKoi ? null : (entry.fps > 0 ? entry.frames : null)
    const firstTexture = useKoi ? (entry.koi as Texture) : entry.frames[0]
    const presentation = resolveCreaturePresentation(name, options)
    const initialReveal = options.reveal ?? "strokeBorn"
    // The portal takeover uses screen scale, not paper scale: the PNG starts
    // small inside the trace and grows past the viewport like the reference cut.
    const isPortal = options.layer === "screenForeground" && options.reveal === "portalTakeover"
    // Screen-space visibility floor: portal (screen-scaled) and stroke-embedded
    // art (sized by the ribbon itself) keep their own sizing.
    if (!isPortal && initialReveal !== "strokeEmbedded" && options.layer !== "screenForeground") {
      presentation.targetLongSide = ensureVisibleLongSide(
        presentation.targetLongSide,
        this.stage.world.scale.x,
      )
    }
    const revealDuration = options.revealDuration
      ?? (initialReveal === "brushDraw" ? brushDrawRevealDuration(presentation.targetLongSide) : undefined)
    const strokeFit = options.strokeFit
      ? resolveStrokeFitPath(options.strokeSamples ?? [], options.strokeFit)
      : null
    const embedded = strokeFit && initialReveal === "strokeEmbedded"
      ? createStrokeEmbeddedNode(this.pixi, firstTexture, name, strokeFit)
      : null

    const node: DisplayNode = embedded?.node ?? new this.pixi.Sprite(firstTexture)
    const sprite = embedded ? null : (node as SpriteNode)
    sprite?.anchor.set(0.5)
    const maxSide = Math.max(firstTexture.width || 1, firstTexture.height || 1)
    const screen = this.stage.app.screen
    const portalBase = Math.max(
      screen.width / (firstTexture.width || 1),
      screen.height / (firstTexture.height || 1),
    ) * 0.74
    const baseScale = embedded ? 1 : isPortal ? portalBase : presentation.targetLongSide / maxSide
    // Stroke-drawn art with smudge anchors fuses with the trace: the entry
    // smudge sits on (slightly behind) the stroke tip and the pen later resumes
    // from the exit smudge.
    const anchor = !embedded && initialReveal === "brushDraw" ? BRUSH_DRAW_ANCHORS[name] : undefined
    const anchoredPlacement = anchor
      ? anchoredBrushDrawPlacement(at, anchor, firstTexture.width || 1, firstTexture.height || 1, baseScale)
      : null
    const originBase = anchoredPlacement?.origin ?? strokeFit?.midpoint ?? at
    const origin = { x: originBase.x + presentation.offset.x, y: originBase.y + presentation.offset.y }
    node.position.set(origin.x, origin.y)
    node.alpha = 1
    // Anchored art stays axis-aligned with its left-to-right wipe so the smudge
    // joins land exactly on the trace (a rotation wobble would break the fuse).
    const rotationBase = embedded || anchoredPlacement
      ? 0
      : strokeFit
      ? strokeFit.angle + (options.rotation ?? 0)
      : (options.rotation ?? (Math.sin(now + at.y * 0.003) * 0.28))
    node.rotation = rotationBase
    // "normal" (not "multiply"): in this Pixi v8 setup, multiply blend makes
    // textured Sprites render invisibly — which is why no creatures ever appeared.
    // Black ink figures on transparent read correctly over the paper as normal.
    node.blendMode = "normal"
    const initialScale = isPortal
      ? creatureScaleMultiplier(initialReveal, 0, presentation.life, options.frameOffset ?? 0)
      : creatureEntranceScale(initialReveal, 0)
    node.scale.set(baseScale * initialScale)
    this.layerFor(options.layer ?? "overInk").addChild(node)
    // Every creature except hard-cuts and the portal is revealed by a mask, never
    // a fade — it emerges out of the stroke. drawLeftToRight/brushDraw use a
    // directional wipe; everything else a circular mask from the stroke point.
    const needsMask = !isPortal && options.reveal !== "hardCut"
    const maskNode = needsMask ? new this.pixi.Graphics() : null
    if (maskNode) {
      node.mask = maskNode
      node.parent?.addChild(maskNode)
    }

    // The portal's hole opens onto bright light (the figure is silhouetted against
    // it, as in the reference). Draw a soft white bloom around the origin and put
    // it BEHIND the takeover sprite so it shows through the sprite's transparent
    // hole; the ragged ink ring occludes the rest.
    let bloomNode: InstanceType<PixiModule["Graphics"]> | null = null
    if (isPortal) {
      const r = Math.min(screen.width, screen.height) * 0.62
      bloomNode = new this.pixi.Graphics()
      for (let k = 0; k < 6; k += 1) {
        const t = k / 5
        bloomNode.circle(0, 0, r * (1 - t * 0.82)).fill({ color: 0xfffdf6, alpha: 0.08 + t * 0.16 })
      }
      bloomNode.blendMode = "screen"
      bloomNode.position.set(screen.width / 2, screen.height * 0.46)
      bloomNode.alpha = 0
      this.stage.screenForegroundLayer.addChildAt(bloomNode, 0)
    }
    // Flow motion: travel the painted line in the drift direction, weaving
    // around it. With no drift hint, default to the line's flow (leftward).
    const driftVec = options.drift ?? { x: 0, y: 0 }
    const flowLen = Math.hypot(driftVec.x, driftVec.y)
    const strokeFlow = strokeFit ? { x: Math.cos(strokeFit.angle), y: Math.sin(strokeFit.angle) } : null
    const flow = flowLen > 1e-3
      ? { x: driftVec.x / flowLen, y: driftVec.y / flowLen }
      : (strokeFlow ?? { x: -1, y: 0 })
    const orbitN = { x: -flow.y, y: flow.x }
    const fixed = options.fixed === true
    const orbitAmp = fixed || isPortal || strokeFit ? 0 : 8 + presentation.targetLongSide * 0.05
    const orbitFreq = 1.7 + Math.abs(Math.sin(now * 1.27 + origin.y * 0.011)) * 1.7
    // Travellers and substantial marks live until they leave the camera, so they
    // never disappear in place. Only intentional blinks (small hole beads, tiny
    // impacts) expire by time. The portal keeps its own scripted life.
    const traveler = flowLen > 40
    const expiresAtLife = creatureExpiresAtLife(
      options.reveal ?? "strokeBorn",
      presentation.targetLongSide,
      presentation.life,
      isPortal,
    )
    const life = isPortal
      ? presentation.life
      : expiresAtLife ? presentation.life : Math.max(presentation.life, traveler ? 5 : 4.5)

    this.active.push({
      node,
      sprite,
      ownedTextures: embedded?.ownedTextures ?? [],
      origin,
      revealOrigin: { x: at.x, y: at.y },
      born: now,
      baseScale,
      targetLongSide: presentation.targetLongSide,
      life,
      reveal: options.reveal ?? "strokeBorn",
      revealDuration,
      maskNode,
      strokeFit,
      bloomNode,
      drift: options.drift ?? { x: 0, y: 0 },
      rotationBase,
      frameOffset: options.frameOffset ?? 0,
      screenPinned: options.layer === "screenForeground",
      fixed,
      expiresAtLife,
      flow,
      orbitN,
      orbitAmp,
      orbitFreq,
      driftT: Math.max(0.5, presentation.life * 0.7),
      frames,
      fps: entry.fps,
      playback: entry.playback,
    })

    if (initialReveal === "brushDraw" || initialReveal === "drawLeftToRight") {
      const pos = anchoredPlacement
        ? {
            x: anchoredPlacement.resume.x + presentation.offset.x,
            y: anchoredPlacement.resume.y + presentation.offset.y,
          }
        : brushResumePoint(origin, (firstTexture.width || 1) * baseScale)
      return { pos, dir: { x: 1, y: 0 } }
    }
    return null
  }

  // Conveyor recycle: keep live creatures pinned to the world as it wraps.
  shift(sx: number, sy: number): void {
    for (const active of this.active) {
      if (active.screenPinned) continue
      active.origin.x += sx
      active.origin.y += sy
      active.revealOrigin.x += sx
      active.revealOrigin.y += sy
      active.node.x += sx
      active.node.y += sy
    }
  }

  draw(now: number): void {
    const screenW = this.stage.app.screen.width
    const screenH = this.stage.app.screen.height
    const worldScale = Math.abs(this.stage.world.scale.x) || 1
    this.active = this.active.filter((active) => {
      const age = now - active.born
      if (active.expiresAtLife && age > active.life) {
        destroyActive(active)
        return false
      }
      // Advance frame sequence according to its playback mode.
      if (active.sprite && active.frames && active.frames.length > 0) {
        const raw = Math.floor((age + active.frameOffset) * active.fps)
        const idx = frameIndexForPlayback(raw, active.frames.length, active.playback)
        const tex = active.frames[idx]
        if (active.sprite.texture !== tex) active.sprite.texture = tex
      }
      const phase = active.frameOffset

      // The hole takeover keeps its own scripted entrance / hold / recede.
      if (active.reveal === "portalTakeover") {
        active.node.alpha = 1
        const driftProgress = easeOutCubic(clamp01(age / Math.max(0.001, active.life * 0.78)))
        active.node.position.set(
          active.origin.x + active.drift.x * driftProgress,
          active.origin.y + active.drift.y * driftProgress,
        )
        active.node.scale.set(active.baseScale * creatureScaleMultiplier(active.reveal, age, active.life, phase))
        if (active.bloomNode) {
          active.bloomNode.alpha = clamp01(age / 0.3) * 0.92
          active.bloomNode.scale.set(0.5 + easeOutCubic(clamp01(age / 0.5)) * 0.85)
        }
        return true
      }

      // Flow creatures: grow in and hold (never fade out). They ride the painted
      // line in the flow direction — the initial drift decelerates into a steady
      // residual creep — while weaving around it, then leave the camera and stop.
      active.node.alpha = 1
      const driftEase = active.fixed ? 0 : easeOutCubic(clamp01(age / active.driftT))
      const wobble = active.fixed ? 0 : Math.sin((age + phase) * active.orbitFreq) * active.orbitAmp
      const residualFlow = active.fixed || active.strokeFit ? 0 : RESIDUAL_FLOW
      active.node.position.set(
        active.origin.x + active.drift.x * driftEase + active.flow.x * residualFlow * age + active.orbitN.x * wobble,
        active.origin.y + active.drift.y * driftEase + active.flow.y * residualFlow * age + active.orbitN.y * wobble,
      )
      active.node.rotation = active.rotationBase + (active.fixed || active.strokeFit ? 0 : Math.cos((age + phase) * active.orbitFreq) * 0.05)
      active.node.scale.set(active.baseScale * creatureEntranceScale(active.reveal, age))

      if (active.maskNode) {
        const progress = active.strokeFit
          ? clamp01(age / active.strokeFit.revealSeconds)
          : revealProgress(active.reveal, age, active.life, active.revealDuration)
        if (active.strokeFit) {
          active.maskNode.clear()
          drawStrokeFitMask(active.maskNode, active.node.x, active.node.y, active.strokeFit, progress)
        } else if (progress >= 1) {
          active.node.mask = null
          active.maskNode.parent?.removeChild(active.maskNode)
          active.maskNode.destroy()
          active.maskNode = null
        } else if (active.sprite && (active.reveal === "drawLeftToRight" || active.reveal === "brushDraw")) {
          active.maskNode.clear()
          const textureFrame = active.sprite.texture.orig ?? active.sprite.texture.frame
          const width = textureFrame.width * active.node.scale.x
          const height = textureFrame.height * active.node.scale.y
          active.maskNode
            .rect(
              active.node.x - width * 0.5,
              active.node.y - height * 0.5,
              width * progress,
              height,
            )
            .fill({ color: 0xffffff, alpha: 1 })
        } else {
          active.maskNode.clear()
          const center = active.reveal === "radialBurst" || active.reveal === "inkPop"
            ? { x: active.node.x, y: active.node.y }
            : active.revealOrigin
          const radius = Math.max(active.targetLongSide, 1) * (0.08 + progress * 0.72)
          active.maskNode
            .circle(center.x, center.y, radius)
            .fill({ color: 0xffffff, alpha: 1 })
        }
      }

      // Off-screen removal: once it has entered and travelled past the frame, it
      // simply leaves — no fade. Margin is the on-screen half-size plus slack.
      if (age > ENTRY_GRACE + 0.1) {
        const screenX = active.screenPinned ? active.node.x : active.node.x * worldScale + this.stage.world.position.x
        const screenY = active.screenPinned ? active.node.y : active.node.y * worldScale + this.stage.world.position.y
        const margin = active.targetLongSide * creatureEntranceScale(active.reveal, age) * worldScale * 0.5 + 48
        if (screenX < -margin || screenX > screenW + margin || screenY < -margin || screenY > screenH + margin) {
          destroyActive(active)
          return false
        }
      }
      return true
    })
  }

  clearActive(): void {
    for (const active of this.active) {
      destroyActive(active)
    }
    this.active = []
    this.spawnCount.clear()
  }

  destroy(): void {
    this.clearActive()
    this.entries.clear()
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

type StrokeFitPoint = Vec2 & { width: number }

function resolveStrokeFitPath(
  samples: readonly RibbonSample[],
  fit: StrokeFitDirective,
): StrokeFitPath | null {
  const points = recentStrokeSegment(samples, fit.length)
  if (points.length < 2) return null

  const total = pathLength(points)
  if (total <= 1e-3) return null

  const midpoint = pointAlongPath(points, total * 0.5)
  const first = points[0]
  const last = points[points.length - 1]
  const avgWidth = points.reduce((sum, point) => sum + Math.max(0, point.width), 0) / points.length
  const width = Math.max(fit.minWidth ?? 0, avgWidth * fit.widthScale)

  return {
    midpoint,
    relativePoints: points.map((point) => ({ x: point.x - midpoint.x, y: point.y - midpoint.y })),
    width,
    length: total,
    angle: Math.atan2(last.y - first.y, last.x - first.x),
    revealSeconds: fit.revealSeconds ?? STROKE_EMBEDDED_REVEAL_TIME,
  }
}

function createStrokeEmbeddedNode(
  pixi: PixiModule,
  texture: Texture,
  name: string,
  path: StrokeFitPath,
): { node: DisplayNode; ownedTextures: Texture[] } | null {
  if (path.relativePoints.length < 2 || path.length <= 1e-3) return null

  const bounds = strokeEmbeddedBounds(name, texture)
  const style = STROKE_EMBEDDED_STYLE[name] ?? { thicknessScale: 1, overlap: 1.5 }
  const sliceCount = Math.max(
    5,
    Math.min(STROKE_EMBEDDED_MAX_SLICES, Math.ceil(path.length / STROKE_EMBEDDED_SLICE_TARGET)),
  )
  const node = new pixi.Container()
  const ownedTextures: Texture[] = []

  for (let index = 0; index < sliceCount; index += 1) {
    const startDistance = path.length * index / sliceCount
    const endDistance = path.length * (index + 1) / sliceCount
    const centerDistance = (startDistance + endDistance) * 0.5
    const start = pointAlongPath(path.relativePoints, startDistance)
    const end = pointAlongPath(path.relativePoints, endDistance)
    const center = pointAlongPath(path.relativePoints, centerDistance)
    const segmentLength = Math.max(1, distance(start, end))

    const sourceStart = Math.round(bounds.x + bounds.width * index / sliceCount)
    const sourceEnd = Math.round(bounds.x + bounds.width * (index + 1) / sliceCount)
    const sourceWidth = Math.max(1, sourceEnd - sourceStart)
    const frame = new pixi.Rectangle(sourceStart, bounds.y, sourceWidth, bounds.height)
    const slice = new pixi.Texture({ source: texture.source, frame })
    ownedTextures.push(slice)

    const sprite = new pixi.Sprite(slice)
    sprite.anchor.set(0.5)
    sprite.position.set(center.x, center.y)
    sprite.rotation = Math.atan2(end.y - start.y, end.x - start.x)
    sprite.width = segmentLength + style.overlap
    sprite.height = path.width * style.thicknessScale
    sprite.alpha = 1
    sprite.blendMode = "normal"
    node.addChild(sprite)
  }

  return { node, ownedTextures }
}

function strokeEmbeddedBounds(
  name: string,
  texture: Texture,
): { x: number; y: number; width: number; height: number } {
  const configured = STROKE_EMBEDDED_TEXTURE_BOUNDS[name]
  if (!configured) return { x: 0, y: 0, width: texture.width || 1, height: texture.height || 1 }

  return {
    x: Math.max(0, configured.x),
    y: Math.max(0, configured.y),
    width: Math.max(1, Math.min(configured.width, (texture.width || 1) - configured.x)),
    height: Math.max(1, Math.min(configured.height, (texture.height || 1) - configured.y)),
  }
}

function recentStrokeSegment(samples: readonly RibbonSample[], length: number): StrokeFitPoint[] {
  if (samples.length < 2) return []
  const result: StrokeFitPoint[] = [strokePoint(samples[samples.length - 1])]
  let covered = 0

  for (let index = samples.length - 1; index > 0 && covered < length; index -= 1) {
    const current = samples[index]
    const previous = samples[index - 1]
    const segment = distance(previous, current)
    if (segment <= 1e-3) continue

    if (covered + segment >= length) {
      const backtrack = (length - covered) / segment
      result.unshift({
        x: current.x + (previous.x - current.x) * backtrack,
        y: current.y + (previous.y - current.y) * backtrack,
        width: current.width + (previous.width - current.width) * backtrack,
      })
      break
    }

    covered += segment
    result.unshift(strokePoint(previous))
  }

  return result
}

function drawStrokeFitMask(
  mask: InstanceType<PixiModule["Graphics"]>,
  originX: number,
  originY: number,
  path: StrokeFitPath,
  progress: number,
): void {
  const points = partialPath(path.relativePoints, progress)
  if (points.length < 2) return

  const first = points[0]
  const last = points[points.length - 1]
  mask.moveTo(originX + first.x, originY + first.y)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    mask.lineTo(originX + point.x, originY + point.y)
  }
  mask.stroke({ color: 0xffffff, alpha: 1, width: Math.max(1, path.width) })
  const cap = Math.max(1, path.width * 0.5)
  mask.circle(originX + first.x, originY + first.y, cap).fill({ color: 0xffffff, alpha: 1 })
  mask.circle(originX + last.x, originY + last.y, cap).fill({ color: 0xffffff, alpha: 1 })
}

function partialPath(points: readonly Vec2[], progress: number): Vec2[] {
  if (points.length < 2 || progress <= 0) return []
  if (progress >= 1) return points.map((point) => ({ ...point }))

  const total = pathLength(points)
  const target = total * progress
  const result: Vec2[] = [{ ...points[0] }]
  let covered = 0

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const segment = distance(previous, current)
    if (segment <= 1e-3) continue

    if (covered + segment >= target) {
      const local = (target - covered) / segment
      result.push({
        x: previous.x + (current.x - previous.x) * local,
        y: previous.y + (current.y - previous.y) * local,
      })
      break
    }

    covered += segment
    result.push({ ...current })
  }

  return result
}

function pathLength(points: readonly Vec2[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index])
  }
  return total
}

function pointAlongPath(points: readonly Vec2[], target: number): Vec2 {
  let covered = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const segment = distance(previous, current)
    if (segment <= 1e-3) continue
    if (covered + segment >= target) {
      const local = (target - covered) / segment
      return {
        x: previous.x + (current.x - previous.x) * local,
        y: previous.y + (current.y - previous.y) * local,
      }
    }
    covered += segment
  }
  return { ...points[points.length - 1] }
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000
}

function strokePoint(sample: RibbonSample): StrokeFitPoint {
  return { x: sample.x, y: sample.y, width: sample.width }
}

function destroyActive(active: Active): void {
  active.maskNode?.parent?.removeChild(active.maskNode)
  active.maskNode?.destroy()
  active.bloomNode?.parent?.removeChild(active.bloomNode)
  active.bloomNode?.destroy()
  for (const texture of active.ownedTextures) texture.destroy()
  active.node.parent?.removeChild(active.node)
  active.node.destroy({ children: true })
}
