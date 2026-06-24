// engine.ts
import { PAPER_W, PAPER_H } from "./constants"
import { Brush } from "./brush/brush"
import { Camera } from "./camera/camera"
import { Input } from "./input/input"
import { screenToPaper } from "./input/screen-to-paper"
import { Compositor } from "./render/compositor"
import { createTarget, loadTexture } from "./render/gl"
import { InkAccumulator } from "./render/ink-accumulator"
import { Renderer } from "./render/renderer"
import { Reveals } from "./reveals/reveals"
import { Creatures } from "./creatures/creatures"
import type { BrushMod } from "./types"
import type { AudioEngine } from "./audio/audio-engine"
import type { Timeline } from "./timeline/timeline"

export class Engine {
  private renderer: Renderer
  private ink: InkAccumulator
  private compositor: Compositor
  private reveals: Reveals
  private creatures: Creatures
  private prevT = 0
  private paperTex: WebGLTexture
  private brush = new Brush()
  private camera = new Camera()
  private input: Input
  private raf = 0
  private last = 0
  private running = false
  private audio: AudioEngine | null = null
  private timeline: Timeline | null = null
  // Stable reference so repeated addEventListener calls de-dupe (no listener leak across tab switches).
  private onVis = () => { if (document.hidden) this.stop(); else if (!this.running) this.start() }

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.ink = new InkAccumulator(this.renderer.gl, PAPER_W, PAPER_H)
    this.compositor = new Compositor(this.renderer.gl)
    this.reveals = new Reveals(this.renderer.gl)
    this.creatures = new Creatures(this.renderer.gl)
    for (const name of [
      "chica", "pajaros", "pezmancha", "pececillo", "surco", "cera", "cremallera",
      "entrando", "cosquilla", "Ogrande", "burbuja", "Ondasagua", "salpico",
      "recuerdo_b", "lagrima", "labios", "mariposa", "dandelion", "Entradaagujero",
      "Salidaagujero", "alambre", "uno", "mariposanoloop",
    ]) {
      loadTexture(this.renderer.gl, `/lab/soy-tu-aire/creatures/${name}.png`)
        .then((tex) => this.creatures.register(name, tex))
        .catch(() => { /* clase sin sprite: no aparece */ })
    }
    {
      const fb = createTarget(this.renderer.gl, 1, 1) // textura 1×1; se ve como color plano del shader
      this.paperTex = fb.tex
    }
    loadTexture(this.renderer.gl, "/lab/soy-tu-aire/textures/paper.jpg")
      .then((t) => { this.paperTex = t })
      .catch(() => { /* queda el fallback 1×1 */ })
    this.input = new Input(canvas)
  }

  attachAudio(audio: AudioEngine): void { this.audio = audio }
  attachTimeline(timeline: Timeline): void { this.timeline = timeline }

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

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    document.addEventListener("visibilitychange", this.onVis)
    const loop = (now: number) => {
      const dt = Math.min((now - this.last) / 1000, 1 / 20)
      this.last = now
      this.renderer.resize()
      const aspect = this.canvas.width / Math.max(this.canvas.height, 1)
      const view = this.camera.view(aspect)
      const target = this.input.screen
        ? screenToPaper(this.input.screen.x, this.input.screen.y, this.canvas.clientWidth, this.canvas.clientHeight, view)
        : null
      const t = this.clock()
      const mod = this.modAt(t)
      const st = this.timeline ? this.timeline.query(t) : { climax: 0 }
      this.camera.setZoom(1.6 + (st.climax ?? 0) * 0.5) // acerca en climax
      const dabs = this.brush.update(dt, target, mod)
      this.ink.stamp(dabs)
      if (this.timeline) {
        for (const e of this.timeline.fired(this.prevT, t)) {
          for (const id of e.reveals) this.reveals.spawn(id, { x: this.brush.pos.x, y: this.brush.pos.y }, t)
          for (const c of e.creatures) this.creatures.spawn(c, { x: this.brush.pos.x, y: this.brush.pos.y }, t)
        }
      }
      this.prevT = t
      const camBands = this.audio ? this.audio.getBands() : { voz: 0, instrumental: 0, cascabeles: 0, ritmo2: 0 }
      const camSpeed = 1 + (camBands.voz + camBands.instrumental) * 0.5 // camara = voz+instrumental
      this.camera.follow(this.brush.pos, dt * camSpeed)
      this.compositor.draw(this.ink.texture, this.paperTex, this.camera.view(aspect), PAPER_W, PAPER_H, this.glowAt())
      this.reveals.draw(this.camera.view(aspect), t)
      this.creatures.draw(this.camera.view(aspect), t)
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
    this.renderer.destroy()
  }
}
