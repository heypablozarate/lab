import { PAPER_H, PAPER_W } from "../constants"
import type { ViewRect } from "../types"
import type { PixiModule, PixiStage } from "./pixi-stage"

export class PixiCompositor {
  private glow: InstanceType<PixiModule["Graphics"]>
  private vignette: InstanceType<PixiModule["Graphics"]>

  constructor(private stage: PixiStage, private pixi: PixiModule) {
    this.glow = new pixi.Graphics()
    this.glow.blendMode = "screen"
    this.vignette = new pixi.Graphics()
    this.vignette.blendMode = "multiply"
    this.stage.effectsLayer.addChild(this.glow)
    this.stage.app.stage.addChild(this.vignette)
  }

  draw(view: ViewRect, glowAmount: number): void {
    this.drawGlow(glowAmount)
    this.stage.applyView(view)
    this.drawVignette(glowAmount)
    this.stage.app.render()
  }

  destroy(): void {
    this.stage.effectsLayer.removeChild(this.glow)
    this.stage.app.stage.removeChild(this.vignette)
    this.glow.destroy()
    this.vignette.destroy()
  }

  private drawGlow(glowAmount: number): void {
    const alpha = 0.08 + Math.min(1, glowAmount) * 0.18
    this.glow.clear()
    this.glow.circle(PAPER_W * 0.55, PAPER_H * 0.48, PAPER_W * 0.42).fill({ color: 0xfff2c8, alpha })
    this.glow.circle(PAPER_W * 0.34, PAPER_H * 0.62, PAPER_W * 0.22).fill({ color: 0xf7dfbc, alpha: alpha * 0.45 })
  }

  private drawVignette(glowAmount: number): void {
    const width = this.stage.app.screen.width
    const height = this.stage.app.screen.height
    const edge = Math.max(width, height) * 0.16
    const alpha = 0.035 + Math.max(0, 1 - glowAmount) * 0.035
    const steps = 16
    const step = edge / steps
    this.vignette.clear()

    for (let i = 0; i < steps; i += 1) {
      const band = step + 0.5
      const inset = i * step
      const fade = Math.pow(1 - i / steps, 1.8)
      const bandAlpha = alpha * fade
      const sideAlpha = bandAlpha * 0.8

      this.vignette.rect(0, inset, width, band).fill({ color: 0x000000, alpha: bandAlpha })
      this.vignette.rect(0, height - inset - band, width, band).fill({ color: 0x000000, alpha: bandAlpha })
      this.vignette.rect(inset, 0, band, height).fill({ color: 0x000000, alpha: sideAlpha })
      this.vignette.rect(width - inset - band, 0, band, height).fill({ color: 0x000000, alpha: sideAlpha })
    }
  }
}
