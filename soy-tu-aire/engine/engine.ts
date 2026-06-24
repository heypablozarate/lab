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

const DEFAULT_MOD: BrushMod = { pressure: 0.5, climax: 0 }

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

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas)
    this.ink = new InkAccumulator(this.renderer.gl, PAPER_W, PAPER_H)
    this.compositor = new Compositor(this.renderer.gl)
    this.input = new Input(canvas)
  }

  // Fase 3 sobreescribe estos para inyectar audio/timeline.
  protected modAt(_t: number): BrushMod { return DEFAULT_MOD }
  protected glowAt(_t: number): number { return 0 }
  protected clock(): number { return performance.now() / 1000 }

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
      this.camera.follow(this.brush.pos, dt)
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
