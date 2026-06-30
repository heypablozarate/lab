import { PAPER_H, PAPER_W } from "../constants"
import type { ViewRect } from "../types"
import type { PixiModule, PixiStage } from "./pixi-stage"

export class PixiCompositor {
  private glow: InstanceType<PixiModule["Graphics"]>
  private vignette: InstanceType<PixiModule["Graphics"]>

  constructor(private stage: PixiStage, pixi: PixiModule) {
    this.glow = new pixi.Graphics()
    this.glow.blendMode = "screen"
    this.vignette = new pixi.Graphics()
    this.vignette.blendMode = "multiply"
    this.stage.effectsLayer.addChild(this.glow)
    this.stage.app.stage.addChild(this.vignette)
  }

  draw(view: ViewRect, glowAmount: number, time = 0): void {
    const lighting = computeLightingState(glowAmount, time)
    this.drawGlow(lighting)
    this.stage.applyView(view)
    this.drawVignette(lighting)
    this.stage.app.render()
  }

  destroy(): void {
    this.stage.effectsLayer.removeChild(this.glow)
    this.stage.app.stage.removeChild(this.vignette)
    this.glow.destroy()
    this.vignette.destroy()
  }

  private drawGlow(lighting: LightingState): void {
    this.glow.clear()
    this.glow.circle(PAPER_W * 0.55, PAPER_H * 0.48, PAPER_W * 0.42).fill({ color: 0xfff2c8, alpha: lighting.primaryGlow })
    this.glow.circle(PAPER_W * 0.34, PAPER_H * 0.62, PAPER_W * 0.22).fill({ color: 0xf7dfbc, alpha: lighting.secondaryGlow })
    // Two soft out-of-focus bokeh that blink on independent random cadences, so
    // the lights feel scattered and intermittent rather than metronomic.
    this.glow.circle(lighting.sparkX, lighting.sparkY, PAPER_W * lighting.sparkRadius).fill({
      color: 0xffffff,
      alpha: lighting.sparkAlpha,
    })
    this.glow.circle(lighting.spark2X, lighting.spark2Y, PAPER_W * lighting.spark2Radius).fill({
      color: 0xfffaf0,
      alpha: lighting.spark2Alpha,
    })
  }

  private drawVignette(lighting: LightingState): void {
    const width = this.stage.app.screen.width
    const height = this.stage.app.screen.height
    const edge = Math.max(width, height) * 0.18
    const alpha = lighting.vignetteAlpha
    const steps = 16
    const step = edge / steps
    this.vignette.clear()

    for (let i = 0; i < steps; i += 1) {
      const band = step + 0.5
      const inset = i * step
      const fade = Math.pow(1 - i / steps, 1.8)
      const bandAlpha = alpha * fade
      // Each edge carries its own (slowly drifting, breathing) weight so the frame
      // reads as an organic asymmetric vignette — top/bottom heavier than the
      // sides, like the reference — not a uniform rectangular mat.
      const topAlpha = bandAlpha * lighting.topVignette
      const bottomAlpha = bandAlpha * lighting.bottomVignette
      const leftAlpha = bandAlpha * lighting.leftVignette
      const rightAlpha = bandAlpha * lighting.rightVignette

      this.vignette.rect(0, inset, width, band).fill({ color: 0x000000, alpha: topAlpha })
      this.vignette.rect(0, height - inset - band, width, band).fill({ color: 0x000000, alpha: bottomAlpha })
      this.vignette.rect(inset, 0, band, height).fill({ color: 0x000000, alpha: leftAlpha })
      this.vignette.rect(width - inset - band, 0, band, height).fill({ color: 0x000000, alpha: rightAlpha })
    }
  }
}

export type LightingState = {
  primaryGlow: number
  secondaryGlow: number
  sparkAlpha: number
  sparkRadius: number
  sparkX: number
  sparkY: number
  spark2Alpha: number
  spark2Radius: number
  spark2X: number
  spark2Y: number
  vignetteAlpha: number
  leftVignette: number
  rightVignette: number
  topVignette: number
  bottomVignette: number
  offset: number
}

export function computeLightingState(glowAmount: number, time: number): LightingState {
  const glow = Math.min(1, Math.max(0, glowAmount))
  const bucket = Math.floor(time / 0.18)        // fast bokeh blink
  const bucket2 = Math.floor(time / 0.41)       // slower, independent bokeh blink
  const spark = random01(bucket * 29.17 + 3.4)
  const flicker = spark > 0.68 ? (spark - 0.68) / 0.32 : 0
  const spark2 = random01(bucket2 * 53.7 + 9.1)
  const flicker2 = spark2 > 0.74 ? (spark2 - 0.74) / 0.26 : 0
  // Smooth, audio-independent breaths keep the bloom and the vignette alive even
  // in the song's quiet passages (different phases so they don't pump together).
  const breath = 0.5 + Math.sin(time * 0.6) * 0.5
  const breathV = 0.5 + Math.sin(time * 0.41 + 1.3) * 0.5
  const offset = randomSigned(bucket * 11.41 + 8.3)
  const drift = Math.sin(time * 0.23)
  const pulse = glow * 0.78 + flicker * 0.56 + breath * 0.18

  return {
    primaryGlow: 0.07 + breath * 0.05 + glow * 0.16 + flicker * 0.085,
    secondaryGlow: 0.028 + breath * 0.022 + glow * 0.07 + flicker * 0.075,
    sparkAlpha: Math.min(0.34, flicker * (0.16 + glow * 0.22)),
    sparkRadius: 0.045 + random01(bucket * 7.23 + 1.8) * 0.05,
    sparkX: PAPER_W * (0.22 + random01(bucket * 13.7 + 2.1) * 0.58),
    sparkY: PAPER_H * (0.5 + random01(bucket * 17.9 + 4.2) * 0.34),
    spark2Alpha: Math.min(0.26, flicker2 * (0.12 + glow * 0.18)),
    spark2Radius: 0.06 + random01(bucket2 * 4.31 + 6.7) * 0.07,
    spark2X: PAPER_W * (0.3 + random01(bucket2 * 9.13 + 5.5) * 0.42),
    spark2Y: PAPER_H * (0.38 + random01(bucket2 * 6.77 + 3.9) * 0.4),
    vignetteAlpha: 0.04 + breathV * 0.02 + Math.max(0, 1 - glow) * 0.028 + flicker * 0.014,
    leftVignette: 0.74 + pulse * 0.3 + Math.max(0, -offset) * 0.1,
    rightVignette: 0.7 + pulse * 0.22 + Math.max(0, offset) * 0.09,
    topVignette: 0.92 + Math.max(0, drift) * 0.5 + pulse * 0.12,
    bottomVignette: 0.96 + Math.max(0, -drift) * 0.55 + pulse * 0.12,
    offset,
  }
}

function random01(seed: number): number {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
}

function randomSigned(seed: number): number {
  return random01(seed) * 2 - 1
}
