import { PAPER_H, PAPER_W } from "../constants"

import type * as Pixi from "pixi.js"

const PAPER_COLOR = 0xe1dfda
const MAX_DPR = 2

export type PixiModule = typeof Pixi

export const PIXI_LAYER_ORDER = [
  "paper",
  "effectsLayer",
  "underInkLayer",
  "inkLayer",
  "insideInkLayer",
  "overInkLayer",
  "foregroundLayer",
] as const

export type PixiWorldLayerName = typeof PIXI_LAYER_ORDER[number]

// Measure from the canvas's layout parent, never from the canvas itself:
// with autoDensity Pixi pins an inline px width/height on the canvas, so its
// own clientWidth freezes at the init size and a self-referential resize loop
// can never grow. The parent (`.stage`, fixed inset:0) always reports the
// real viewport box.
function measureCanvas(canvas: HTMLCanvasElement): { width: number; height: number } {
  const parent = canvas.parentElement
  const width = parent?.clientWidth || window.innerWidth || 1
  const height = parent?.clientHeight || window.innerHeight || 1
  return { width, height }
}

export class PixiStage {
  readonly app: Pixi.Application
  readonly world: Pixi.Container
  readonly paper: Pixi.Container
  readonly effectsLayer: Pixi.Container
  readonly underInkLayer: Pixi.Container
  readonly inkLayer: Pixi.Container
  readonly insideInkLayer: Pixi.Container
  readonly overInkLayer: Pixi.Container
  readonly foregroundLayer: Pixi.Container
  readonly screenForegroundLayer: Pixi.Container
  private lastWidth = 0
  private lastHeight = 0
  private lastResolution = 0

  private constructor(
    app: Pixi.Application,
    world: Pixi.Container,
    paper: Pixi.Container,
    effectsLayer: Pixi.Container,
    underInkLayer: Pixi.Container,
    inkLayer: Pixi.Container,
    insideInkLayer: Pixi.Container,
    overInkLayer: Pixi.Container,
    foregroundLayer: Pixi.Container,
    screenForegroundLayer: Pixi.Container,
  ) {
    this.app = app
    this.world = world
    this.paper = paper
    this.effectsLayer = effectsLayer
    this.underInkLayer = underInkLayer
    this.inkLayer = inkLayer
    this.insideInkLayer = insideInkLayer
    this.overInkLayer = overInkLayer
    this.foregroundLayer = foregroundLayer
    this.screenForegroundLayer = screenForegroundLayer
  }

  static async create(canvas: HTMLCanvasElement, pixi: PixiModule): Promise<PixiStage> {
    const app = new pixi.Application()
    const initSize = measureCanvas(canvas)
    await app.init({
      canvas,
      antialias: true,
      autoDensity: true,
      autoStart: false,
      backgroundAlpha: 1,
      backgroundColor: PAPER_COLOR,
      preference: "webgl",
      resolution: Math.min(window.devicePixelRatio || 1, MAX_DPR),
      width: initSize.width,
      height: initSize.height,
    })

    const world = new pixi.Container()
    const paper = new pixi.Container()
    const effectsLayer = new pixi.Container()
    const underInkLayer = new pixi.Container()
    const inkLayer = new pixi.Container()
    const insideInkLayer = new pixi.Container()
    const overInkLayer = new pixi.Container()
    const foregroundLayer = new pixi.Container()
    const screenForegroundLayer = new pixi.Container()
    const fallbackPaper = new pixi.Graphics()
    fallbackPaper.rect(0, 0, PAPER_W, PAPER_H).fill(PAPER_COLOR)
    paper.addChild(fallbackPaper)
    try {
      const paperTexture = await pixi.Assets.load("/lab/soy-tu-aire/textures/paper.jpg") as Pixi.Texture
      const paperSprite = new pixi.Sprite(paperTexture)
      paperSprite.width = PAPER_W
      paperSprite.height = PAPER_H
      paperSprite.alpha = 0.82
      paperSprite.blendMode = "multiply"
      paper.addChild(paperSprite)
    } catch {
      // Keep the flat paper fallback when the texture is unavailable.
    }
    paper.addChild(createPaperClouds(pixi))
    world.addChild(paper)
    world.addChild(effectsLayer)
    world.addChild(underInkLayer)
    world.addChild(inkLayer)
    world.addChild(insideInkLayer)
    world.addChild(overInkLayer)
    world.addChild(foregroundLayer)
    app.stage.addChild(world)
    app.stage.addChild(screenForegroundLayer)

    return new PixiStage(
      app,
      world,
      paper,
      effectsLayer,
      underInkLayer,
      inkLayer,
      insideInkLayer,
      overInkLayer,
      foregroundLayer,
      screenForegroundLayer,
    )
  }

  resize(): void {
    const { width, height } = measureCanvas(this.app.canvas)
    const resolution = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    if (width === this.lastWidth && height === this.lastHeight && resolution === this.lastResolution) return
    this.lastWidth = width
    this.lastHeight = height
    this.lastResolution = resolution
    this.app.renderer.resolution = resolution
    this.app.renderer.resize(width, height)
  }

  applyView(view: { x: number; y: number; w: number; h: number }): void {
    this.resize()
    const scaleX = this.app.screen.width / view.w
    const scaleY = this.app.screen.height / view.h
    this.world.scale.set(scaleX, scaleY)
    this.world.position.set(-view.x * scaleX, -view.y * scaleY)
  }

  render(view: { x: number; y: number; w: number; h: number }): void {
    this.applyView(view)
    this.app.render()
  }

  destroy(): void {
    this.app.destroy()
  }
}

function createPaperClouds(pixi: PixiModule): Pixi.Container {
  const layer = new pixi.Container()
  const light = new pixi.Graphics()
  light.blendMode = "screen"
  light.filters = [new pixi.BlurFilter({ strength: 48, quality: 2, kernelSize: 9 })]
  const shadow = new pixi.Graphics()
  shadow.blendMode = "multiply"
  shadow.filters = [new pixi.BlurFilter({ strength: 54, quality: 2, kernelSize: 9 })]
  const grain = new pixi.Graphics()
  grain.blendMode = "multiply"

  drawOval(light, PAPER_W * 0.52, PAPER_H * 0.38, PAPER_W * 0.34, PAPER_H * 0.22, 0xffffff, 0.08)
  drawOval(light, PAPER_W * 0.78, PAPER_H * 0.55, PAPER_W * 0.28, PAPER_H * 0.2, 0xffffff, 0.06)
  drawOval(light, PAPER_W * 0.24, PAPER_H * 0.68, PAPER_W * 0.2, PAPER_H * 0.16, 0xffffff, 0.05)
  drawOval(shadow, PAPER_W * 0.1, PAPER_H * 0.18, PAPER_W * 0.2, PAPER_H * 0.34, 0x9f9d98, 0.04)
  drawOval(shadow, PAPER_W * 0.64, PAPER_H * 0.78, PAPER_W * 0.38, PAPER_H * 0.18, 0xa8a5a0, 0.035)
  drawOval(shadow, PAPER_W * 0.94, PAPER_H * 0.5, PAPER_W * 0.14, PAPER_H * 0.46, 0x8f8d88, 0.04)

  for (let i = 0; i < 90; i += 1) {
    const seed = i * 17.37
    const x = random01(seed) * PAPER_W
    const y = random01(seed + 5.19) * PAPER_H
    const radius = 1.2 + random01(seed + 9.8) * 5
    const alpha = 0.008 + random01(seed + 12.4) * 0.02
    grain.circle(x, y, radius).fill({ color: 0x5d5b56, alpha })
  }

  layer.addChild(light)
  layer.addChild(shadow)
  layer.addChild(grain)
  return layer
}

function drawOval(
  graphics: Pixi.Graphics,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: number,
  alpha: number,
): void {
  graphics.ellipse(x, y, radiusX, radiusY).fill({ color, alpha })
}

function random01(seed: number): number {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
}
