// engine.ts
import { Brush } from "./brush/brush"
import { pointAtDistanceFromEnd } from "./brush/stroke-history"
import { Camera } from "./camera/camera"
import { Input } from "./input/input"
import { screenToPaper } from "./input/screen-to-paper"
import { expandDirectedEvents, type DirectedBrushHold, type DirectedSpawn } from "./directing/director"
import { InkSurface } from "./render/ink-surface"
import { PixiCompositor } from "./render/pixi-compositor"
import { PixiStage, type PixiModule } from "./render/pixi-stage"
import { Reveals } from "./reveals/reveals"
import { Creatures } from "./creatures/creatures"
import type { BrushMod } from "./types"
import type { AudioEngine } from "./audio/audio-engine"
import type { Timeline } from "./timeline/timeline"

// Names that animate as frame sequences (loaded separately below); they must NOT
// be loaded as a single {name}.png the old way.
const ANIMATED_NAMES = new Set(["pececillo", "pajaros", "mariposa", "mariposanoloop"])

const CREATURE_NAMES = [
  "chica", "pajaros", "pezmancha", "pececillo", "surco", "cera", "cremallera",
  "entrando", "cosquilla", "Ogrande", "burbuja", "Ondasagua", "salpico",
  "recuerdo_b", "lagrima", "labios", "mariposa", "dandelion", "Entradaagujero",
  "Salidaagujero", "alambre", "uno", "mariposanoloop",
] as const

const CREATURES_BASE = "/lab/soy-tu-aire/creatures"

// Frame sequences (filenames already exist in public/lab/soy-tu-aire/creatures/).
const PECECILLO_FRAMES = [
  "_0000_Pececillo-01", "_0001_Pececillo-02", "_0002_Pececillo-03", "_0003_Pececillo-04",
  "_0004_Pececillo-05", "_0005_Pececillo-06", "_0006_Pececillo-07", "_0007_Pececillo-08",
]
const PAJAROS_FRAMES = [
  "pajaros__0000_Bird-Sprite-01", "pajaros__0001_Bird-Sprite-02", "pajaros__0002_Bird-Sprite-03",
  "pajaros__0003_Bird-Sprite-04", "pajaros__0004_Bird-Sprite-05", "pajaros__0005_Bird-Sprite-06",
]
// Butterfly opening, ordered by the Mariposa-0X token (01..07).
const MARIPOSA_FRAMES = [
  "mariposanoloop__0006_Mariposa-01", "mariposanoloop__0005_Mariposa-02", "mariposanoloop__0004_Mariposa-03",
  "mariposanoloop__0003_Mariposa-04", "mariposanoloop__0002_Mariposa-05", "mariposanoloop__0001_Mariposa-06",
  "mariposanoloop__0001_Mariposa-07",
]

export async function createEngine(canvas: HTMLCanvasElement, pixi: PixiModule): Promise<Engine> {
  const stage = await PixiStage.create(canvas, pixi)
  return new Engine(canvas, pixi, stage)
}

export class Engine {
  private ink: InkSurface
  private compositor: PixiCompositor
  private reveals: Reveals
  private creatures: Creatures
  private prevT = 0
  private brush = new Brush()
  private camera = new Camera()
  // The stroke is born when the song starts (Play): it appears at the click/
  // pointer position and springs toward the mouse from there — it does not enter
  // from any edge. Nothing paints before birth.
  private born = false
  private pendingBirth = false
  private idleT = 0
  private input: Input
  private raf = 0
  private last = 0
  private running = false
  private audio: AudioEngine | null = null
  private timeline: Timeline | null = null
  private pendingCreatureSpawns: DirectedSpawn[] = []
  private pendingRevealSpawns: DirectedSpawn[] = []
  private brushHolds: DirectedBrushHold[] = []
  // Stable reference so repeated addEventListener calls de-dupe (no listener leak across tab switches).
  private onVis = () => { if (document.hidden) this.stop(); else if (!this.running) this.start() }

  constructor(private canvas: HTMLCanvasElement, private pixi: PixiModule, private stage: PixiStage) {
    this.ink = new InkSurface(stage, pixi)
    this.compositor = new PixiCompositor(stage, pixi)
    this.reveals = new Reveals(stage, pixi)
    this.creatures = new Creatures(stage, pixi)
    // Static single-texture creatures.
    for (const name of CREATURE_NAMES) {
      if (ANIMATED_NAMES.has(name)) continue
      this.pixi.Assets.load(`${CREATURES_BASE}/${name}.png`)
        .then((tex) => this.creatures.register(name, tex))
        .catch(() => { /* clase sin sprite: no aparece */ })
    }
    this.loadFrames("pececillo", PECECILLO_FRAMES, { fps: 12, loop: true, koi: `${CREATURES_BASE}/pececillo.png` })
    this.loadFrames("pajaros", PAJAROS_FRAMES, { fps: 12, loop: true })
    // "mariposa" and "mariposanoloop" share the same play-once opening sequence.
    this.loadFrames("mariposa", MARIPOSA_FRAMES, { fps: 14, loop: false })
    this.loadFrames("mariposanoloop", MARIPOSA_FRAMES, { fps: 14, loop: false })
    this.input = new Input(canvas)
  }

  // Load an ordered frame sequence (and an optional koi single texture) then
  // register it. Each load fails gracefully so missing art just doesn't appear.
  private loadFrames(
    name: string,
    fileNames: string[],
    opts: { fps: number; loop: boolean; koi?: string },
  ): void {
    type Texture = InstanceType<PixiModule["Texture"]>
    const frameUrls = fileNames.map((f) => `${CREATURES_BASE}/${f}.png`)
    const urls = opts.koi ? [...frameUrls, opts.koi] : frameUrls
    Promise.all(
      urls.map((url) =>
        this.pixi.Assets.load(url)
          .then((tex) => tex as Texture)
          .catch(() => null),
      ),
    )
      .then((loaded) => {
        const koi = opts.koi ? loaded[loaded.length - 1] : null
        const frameTextures = (opts.koi ? loaded.slice(0, -1) : loaded).filter(
          (t): t is Texture => t !== null,
        )
        if (frameTextures.length === 0) return
        this.creatures.registerFrames(name, frameTextures, {
          fps: opts.fps,
          loop: opts.loop,
          koi: koi ?? null,
        })
      })
      .catch(() => { /* clase sin sprite: no aparece */ })
  }

  attachAudio(audio: AudioEngine): void {
    this.audio = audio
    this.prevT = 0
    this.resetDirectedEvents()
    this.camera.resetCinematic()
    // Birth the stroke on Play; the next frame places the head at the click/
    // pointer position once the view is known.
    this.born = false
    this.pendingBirth = true
  }
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline
    this.prevT = 0
    this.resetDirectedEvents()
  }

  // Birth the stroke under the Play click: seed the pointer so the next frame's
  // birth lands exactly there and the head holds at that screen point.
  primeStrokeBirth(clientX: number, clientY: number): void {
    this.input.prime(clientX, clientY)
  }

  private clock(): number { return this.audio ? this.audio.currentTime : performance.now() / 1000 }

  private modAt(t: number): BrushMod {
    const base = this.timeline ? this.timeline.query(t) : { presion: 0.5, climax: 0, velocidad: 1 }
    const b = this.audio ? this.audio.getBands() : { voz: 0, instrumental: 0, cascabeles: 0, ritmo2: 0 }
    // principal = voz + ritmo2 (mapeo original)
    const principal = Math.min(1, b.voz + b.ritmo2)
    return {
      pressure: Math.min(1, base.presion * 0.6 + principal * 0.6),
      climax: Math.min(1, base.climax + b.ritmo2 * 0.4),
    }
  }

  private glowAt(): number {
    const b = this.audio ? this.audio.getBands() : { cascabeles: 0 } as { cascabeles: number }
    return Math.min(1, b.cascabeles * 1.5) // luces = cascabeles
  }

  private resetDirectedEvents(): void {
    this.pendingCreatureSpawns = []
    this.pendingRevealSpawns = []
    this.brushHolds = []
  }

  private collectDirectedEvents(prevT: number, t: number): void {
    if (!this.timeline) return
    for (const event of this.timeline.fired(prevT, t)) {
      const batch = expandDirectedEvents(event)
      this.pendingCreatureSpawns.push(...batch.creatures)
      this.pendingRevealSpawns.push(...batch.reveals)
      this.brushHolds.push(...batch.brushHolds)
    }
  }

  private activeBrushHold(t: number): DirectedBrushHold | null {
    this.brushHolds = this.brushHolds.filter((hold) => hold.endAt >= t)
    return this.brushHolds.find((hold) => t >= hold.startAt && t <= hold.endAt) ?? null
  }

  private flushDirectedSpawns(prevT: number, t: number): void {
    this.pendingCreatureSpawns = this.pendingCreatureSpawns.filter((spawn) => {
      if (spawn.fireAt <= prevT) return false
      if (spawn.fireAt > t) return true
      const at = { x: this.brush.pos.x, y: this.brush.pos.y }
      this.creatures.spawn(spawn.name, at, spawn.fireAt, {
        targetLongSide: spawn.targetLongSide,
        life: spawn.life,
        alpha: spawn.alpha,
        offset: spawn.offset,
        layer: spawn.layer,
        reveal: spawn.reveal,
      })
      return false
    })

    this.pendingRevealSpawns = this.pendingRevealSpawns.filter((spawn) => {
      if (spawn.fireAt <= prevT) return false
      if (spawn.fireAt > t) return true
      const anchor = pointAtDistanceFromEnd(this.brush.getRibbonSamples(), 90)
      const at = anchor
        ? { x: anchor.x, y: anchor.y }
        : { x: this.brush.pos.x + spawn.offset.x, y: this.brush.pos.y + spawn.offset.y }
      this.reveals.spawn(spawn.name, at, spawn.fireAt, {
        strokeAnchor: anchor,
        strokeOffset: { along: spawn.offset.x, normal: -0.18 },
      })
      return false
    })
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    document.addEventListener("visibilitychange", this.onVis)
    const loop = (now: number) => {
      const dt = Math.min((now - this.last) / 1000, 1 / 20)
      this.last = now
      this.stage.resize()
      const aspect = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1)
      const t = this.clock()
      const mod = this.modAt(t)
      const st = this.timeline ? this.timeline.query(t) : { velocidad: 1, presion: 0.5, climax: 0 }
      mod.ink = this.timeline ? this.timeline.inkAt(t) : 1
      const camBands = this.audio ? this.audio.getBands() : { voz: 0, instrumental: 0, cascabeles: 0, ritmo2: 0 }
      const camEnergy = Math.min(1, camBands.voz + camBands.instrumental) // camara = voz+instrumental
      const camClimax = Math.min(1, (st.climax ?? 0) * 0.85 + camEnergy * 0.25)
      this.camera.updateCinematic({
        aspect,
        dt,
        time: t,
        timelineSpeed: st.velocidad ?? 1,
        audioEnergy: camEnergy,
        pointerScreen: this.input.screen,
        viewportW: this.canvas.clientWidth,
        viewportH: this.canvas.clientHeight,
        climax: camClimax,
      })
      // Endless conveyor on both axes: when the camera drifts past the buffer's
      // comfortable band, recycle the whole world in one invisible step so it
      // never hits a paper edge (the original Flash felt infinite). Done before
      // the view so this frame already paints in the recycled frame.
      const wrap = this.camera.maybeWrap()
      if (wrap.sx !== 0 || wrap.sy !== 0) {
        this.ink.shift(wrap.sx, wrap.sy)
        this.brush.shift(wrap.sx, wrap.sy)
        this.reveals.shift(wrap.sx, wrap.sy)
        this.creatures.shift(wrap.sx, wrap.sy)
      }
      const cw = this.canvas.clientWidth
      const ch = this.canvas.clientHeight
      const view = this.camera.view(aspect)
      // The head is kept inside the frame (right-of-centre, like the original) so
      // the trail flows left behind it and creatures born at the head stay visible
      // and travel with the camera before fading. When the mouse is present it
      // guides the head; idle, it gently wanders around that framed anchor — but
      // always relative to the moving view, never to absolute paper coords (which
      // would let the head, and the creatures, drift out of frame).
      let target: { x: number; y: number }
      if (this.input.screen) {
        target = screenToPaper(this.input.screen.x, this.input.screen.y, cw, ch, view)
      } else {
        this.idleT += dt
        target = {
          x: view.x + view.w * (0.6 + Math.sin(this.idleT * 0.7) * 0.12),
          y: view.y + view.h * (0.5 + Math.sin(this.idleT * 0.5) * 0.22),
        }
      }
      if (this.pendingBirth) {
        // Born exactly where the click happened (the pointer position) — it does
        // not enter from any edge. From there it follows the mouse.
        const birthPaper = target ?? { x: view.x + view.w / 2, y: view.y + view.h / 2 }
        this.brush.bornAt(birthPaper)
        this.born = true
        this.pendingBirth = false
        this.prevT = t
      }
      if (this.born) {
        this.collectDirectedEvents(this.prevT, t)
        const hold = this.activeBrushHold(t)
        const brushTarget = hold ? { x: this.brush.pos.x, y: this.brush.pos.y } : target
        if (hold) {
          mod.pressure = hold.pressure
          const heldMod = mod as BrushMod & { hold?: boolean }
          heldMod.hold = true
        }
        this.brush.update(dt, brushTarget, mod)
        this.ink.stampRibbon(this.brush.getRibbonSamples())
        this.flushDirectedSpawns(this.prevT, t)
        this.prevT = t
      }
      this.reveals.draw(t)
      this.creatures.draw(t)
      this.compositor.draw(this.camera.view(aspect), this.glowAt())
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void { this.running = false; cancelAnimationFrame(this.raf) }

  destroy(): void {
    this.stop()
    document.removeEventListener("visibilitychange", this.onVis)
    this.input.destroy()
    this.ink.destroy()
    this.compositor.destroy()
    this.reveals.destroy()
    this.creatures.destroy()
    this.stage.destroy()
  }
}
