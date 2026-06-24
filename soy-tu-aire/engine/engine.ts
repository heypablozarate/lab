// engine.ts
import { PAPER_W, PAPER_H } from "./constants"
import { Brush } from "./brush/brush"
import { Camera } from "./camera/camera"
import { Input } from "./input/input"
import { screenToPaper } from "./input/screen-to-paper"
import { Compositor } from "./render/compositor"
import { InkAccumulator } from "./render/ink-accumulator"
import { Renderer } from "./render/renderer"
import type { BrushMod } from "./types"
import type { AudioEngine } from "./audio/audio-engine"
import type { Timeline } from "./timeline/timeline"

export class Engine {
  private renderer: Renderer
  private ink: InkAccumulator
  private compositor: Compositor
  private brush = new Brush()
  private camera = new Camera()
  private input: Input
  private raf = 0
  private last = 0
  private running = false
  private audio: AudioEngine | null = null
  private timeline: Timeline | null = null

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.ink = new InkAccumulator(this.renderer.gl, PAPER_W, PAPER_H)
    this.compositor = new Compositor(this.renderer.gl)
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

  private glowAt(_t: number): number {
    const b = this.audio ? this.audio.getBands() : { cascabeles: 0 } as { cascabeles: number }
    return Math.min(1, b.cascabeles * 1.5) // luces = cascabeles
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
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
      const dabs = this.brush.update(dt, target, this.modAt(t))
      this.ink.stamp(dabs)
      const camBands = this.audio ? this.audio.getBands() : { voz: 0, instrumental: 0 } as any
      const camSpeed = 1 + (camBands.voz + camBands.instrumental) * 0.5 // camara = voz+instrumental
      this.camera.follow(this.brush.pos, dt * camSpeed)
      this.compositor.draw(this.ink.texture, this.camera.view(aspect), PAPER_W, PAPER_H, this.glowAt(t))
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void { this.running = false; cancelAnimationFrame(this.raf) }

  destroy(): void {
    this.stop()
    this.input.destroy()
    this.ink.destroy()
    this.compositor.destroy()
    this.renderer.destroy()
  }
}
