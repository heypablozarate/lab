import { PAPER_H, PAPER_W } from "../constants"
import { buildRibbonGeometry } from "../brush/ribbon"
import type { RibbonSample } from "../types"
import type { PixiModule, PixiStage } from "./pixi-stage"

const INK_COLOR = 0x141117
const WET_INK_COLOR = 0x050407
const DRY_PAPER_COLOR = 0xd8d6d0
const STAMP_SAMPLE_COUNT = 22
const SPLATTER_MIN_SPEED = 18
const SPLATTER_MIN_CURVE = 0.18

type LayeredRibbon = {
  samples: readonly RibbonSample[]
  tint: number
  alpha: number
  taperSamples?: number
}

export function dryBristleLaneCount(sample: Pick<RibbonSample, "dryness" | "bristleSplit">): number {
  const dryness = sample.dryness ?? 0
  const split = sample.bristleSplit ?? 0
  const lanes = 1 + dryness * 2.2 + split * 2.4
  if (lanes < 2) return 1
  return Math.max(1, Math.min(5, Math.round(lanes)))
}

export class InkSurface {
  readonly sprite: InstanceType<PixiModule["Sprite"]>

  // Persistent ink buffer: stamps accumulate durably within the buffer (tapered,
  // multi-layer ribbon + wet head) — we never re-diffuse the full texture, which
  // would make the wet frontier advance every frame until the paper fills solid
  // black. The buffer is a finite window of an endless conveyor: `shift()`
  // recycles it on both axes as the camera scrolls (ink pushed off a buffer edge
  // is discarded, like the original Flash). `scratch` is the swap target for that
  // shift. Organic per-stroke live bleed is a fidelity task for the reference pass.
  private active: InstanceType<PixiModule["RenderTexture"]>
  private scratch: InstanceType<PixiModule["RenderTexture"]>
  private stampContainer: InstanceType<PixiModule["Container"]>
  private emptyContainer: InstanceType<PixiModule["Container"]>

  constructor(private stage: PixiStage, private pixi: PixiModule) {
    this.active = pixi.RenderTexture.create({ width: PAPER_W, height: PAPER_H, resolution: 1, dynamic: true })
    this.scratch = pixi.RenderTexture.create({ width: PAPER_W, height: PAPER_H, resolution: 1, dynamic: true })
    this.stampContainer = new pixi.Container()
    this.emptyContainer = new pixi.Container()
    this.sprite = new pixi.Sprite(this.active)
    this.sprite.width = PAPER_W
    this.sprite.height = PAPER_H
    this.sprite.blendMode = "normal"
    this.stage.inkLayer.addChild(this.sprite)
    this.clear()
  }

  clear(): void {
    this.stage.app.renderer.render({
      container: this.emptyContainer,
      target: this.active,
      clear: true,
      clearColor: [0, 0, 0, 0],
    })
  }

  // Conveyor recycle: redraw the buffer offset by the world-shift vector
  // (sx, sy) into the scratch texture (newly exposed strips clear to transparent
  // paper) and swap. Rendering through a separate target avoids reading and
  // writing one texture in the same pass.
  shift(sx: number, sy: number): void {
    if (sx === 0 && sy === 0) return
    const carry = new this.pixi.Sprite(this.active)
    carry.x = sx
    carry.y = sy
    const container = new this.pixi.Container()
    container.addChild(carry)
    this.stage.app.renderer.render({
      container,
      target: this.scratch,
      clear: true,
      clearColor: [0, 0, 0, 0],
    })
    const next = this.scratch
    this.scratch = this.active
    this.active = next
    this.sprite.texture = this.active
    container.destroy({ children: true })
  }

  stampRibbon(samples: readonly RibbonSample[]): void {
    if (samples.length < 2) return
    const recent = samples.slice(-STAMP_SAMPLE_COUNT)
    const wetness = averageAlpha(recent)
    const movement = movementStats(recent)
    const layers: LayeredRibbon[] = [
      {
        samples: scaleSamples(recent, 1.32, 0.72),
        tint: INK_COLOR,
        alpha: 0.14 + wetness * 0.14,
        taperSamples: 3,
      },
      {
        samples: scaleSamples(recent, 0.94, 1),
        tint: INK_COLOR,
        alpha: Math.min(0.9, 0.32 + wetness * 0.44),
        taperSamples: 2,
      },
      {
        samples: scaleSamples(offsetSamples(recent, -0.11), 0.48, 1.08),
        tint: WET_INK_COLOR,
        alpha: Math.min(0.42, 0.12 + wetness * 0.26),
        taperSamples: 1,
      },
      // Dry-brush striations: fine internal hairlines where the bristles split,
      // clustered toward one side of the stroke (not symmetric edge rails) and
      // gated purely on speed, so they vanish when the stroke settles. In the
      // original they only show as the brush runs dry in fast sweeps.
      {
        samples: scaleSamples(offsetSamples(recent, 0.06), 0.05, 1),
        tint: DRY_PAPER_COLOR,
        alpha: Math.min(0.16, movement.speed / 1400),
        taperSamples: 2,
      },
      {
        samples: scaleSamples(offsetSamples(recent, 0.16), 0.04, 1),
        tint: DRY_PAPER_COLOR,
        alpha: Math.min(0.12, movement.speed / 1900),
        taperSamples: 2,
      },
    ]

    const head = recent.at(-1)
    const dryLaneCount = head ? dryBristleLaneCount(head) : 1
    for (let i = 0; i < dryLaneCount; i += 1) {
      const laneOffset = -0.28 + (i / Math.max(1, dryLaneCount - 1)) * 0.56
      const laneWidth = 0.025 + (head?.dryness ?? 0) * 0.025
      layers.push({
        samples: scaleSamples(offsetSamples(recent, laneOffset), laneWidth, 0.9),
        tint: DRY_PAPER_COLOR,
        alpha: Math.min(0.18, 0.03 + (head?.dryness ?? 0) * 0.18),
        taperSamples: 2,
      })
    }

    this.stampContainer.removeChildren()
    const destroyables: Array<{ destroy: () => void }> = []

    for (const layer of layers) {
      const mesh = this.createRibbonMesh(layer)
      if (!mesh) continue
      this.stampContainer.addChild(mesh.mesh)
      destroyables.push({
        destroy: () => {
          mesh.mesh.destroy({ texture: false, textureSource: false })
          mesh.geometry.destroy(true)
        },
      })
    }

    const inkHead = this.createInkHead(recent, movement)
    if (inkHead) {
      this.stampContainer.addChild(inkHead)
      destroyables.push({ destroy: () => inkHead.destroy({ children: true }) })
    }

    const splatter = this.createSplatter(recent, movement)
    if (splatter) {
      this.stampContainer.addChild(splatter)
      destroyables.push({ destroy: () => splatter.destroy({ children: true }) })
    }

    if (this.stampContainer.children.length === 0) return
    this.stage.app.renderer.render({
      container: this.stampContainer,
      target: this.active,
      clear: false,
    })
    this.stampContainer.removeChildren()
    for (const item of destroyables) item.destroy()
  }

  destroy(): void {
    this.stage.inkLayer.removeChild(this.sprite)
    this.sprite.destroy()
    this.active.destroy(true)
    this.scratch.destroy(true)
    this.stampContainer.destroy({ children: true })
    this.emptyContainer.destroy({ children: true })
  }

  private createRibbonMesh({ samples, tint, alpha, taperSamples }: LayeredRibbon):
    | { mesh: InstanceType<PixiModule["Mesh"]>; geometry: InstanceType<PixiModule["MeshGeometry"]> }
    | null {
    const ribbon = buildRibbonGeometry(samples, { taperSamples })
    if (ribbon.positions.length === 0) return null

    const geometry = new this.pixi.MeshGeometry({
      positions: ribbon.positions,
      uvs: ribbon.uvs,
      indices: ribbon.indices instanceof Uint32Array ? ribbon.indices : new Uint32Array(ribbon.indices),
    })
    const mesh = new this.pixi.Mesh({ geometry, texture: this.pixi.Texture.WHITE })
    mesh.tint = tint
    mesh.alpha = alpha
    mesh.blendMode = "normal"
    return { mesh, geometry }
  }

  private createInkHead(
    samples: readonly RibbonSample[],
    movement: ReturnType<typeof movementStats>,
  ): InstanceType<PixiModule["Container"]> | null {
    const head = samples.at(-1)
    const previous = samples.at(-2)
    if (!head || !previous) return null

    const angle = Math.atan2(head.y - previous.y, head.x - previous.x)
    const pool = Math.max(0, head.headPool ?? (1 - movement.speed / 34))
    const wet = Math.max(0.24, head.alpha)
    const container = new this.pixi.Container()
    container.position.set(head.x, head.y)
    container.rotation = angle

    // No gray sheen halo: it bakes into the persistent texture as a gray ghost
    // trail along the whole stroke. The original ink is crisp black on paper;
    // only the dark wet pool below accumulates (real pooling).
    const wetPool = new this.pixi.Graphics()
    wetPool.ellipse(-head.width * 0.08, 0, head.width * (0.36 + pool * 0.3), head.width * 0.34)
      .fill({ color: WET_INK_COLOR, alpha: 0.28 + wet * 0.34 + pool * 0.18 })
    wetPool.circle(head.width * 0.38, 0, Math.max(2, head.width * 0.12))
      .fill({ color: 0x1d1b20, alpha: 0.22 + wet * 0.18 })
    container.addChild(wetPool)

    return container
  }

  private createSplatter(
    samples: readonly RibbonSample[],
    movement: ReturnType<typeof movementStats>,
  ): InstanceType<PixiModule["Graphics"]> | null {
    const head = samples.at(-1)
    const previous = samples.at(-2)
    const dryness = head?.dryness ?? 0
    if (
      !head
      || !previous
      || movement.speed < SPLATTER_MIN_SPEED
      || movement.curve < SPLATTER_MIN_CURVE
      || dryness > 0.82
    ) return null

    const count = Math.min(9, Math.max(3, Math.round(movement.curve * 12)))
    const direction = normalize(head.x - previous.x, head.y - previous.y)
    const normal = { x: -direction.y, y: direction.x }
    const seed = hashPoint(head.x, head.y)
    const graphics = new this.pixi.Graphics()

    for (let i = 0; i < count; i += 1) {
      const spread = random01(seed + i * 19) - 0.5
      const ahead = 6 + random01(seed + i * 31) * head.width * 1.4
      const side = spread * head.width * 2.4
      const radius = 1.2 + random01(seed + i * 47) * Math.min(7, head.width * 0.16)
      const x = head.x - direction.x * ahead + normal.x * side
      const y = head.y - direction.y * ahead + normal.y * side
      const alpha = 0.08 + random01(seed + i * 53) * 0.24
      graphics.circle(x, y, radius).fill({ color: INK_COLOR, alpha })
    }

    return graphics
  }
}

function averageAlpha(samples: readonly RibbonSample[]): number {
  if (samples.length === 0) return 0
  return samples.reduce((sum, sample) => sum + sample.alpha, 0) / samples.length
}

function scaleSamples(samples: readonly RibbonSample[], widthScale: number, alphaScale: number): RibbonSample[] {
  return samples.map((sample) => ({
    ...sample,
    width: sample.width * widthScale,
    alpha: Math.min(1, sample.alpha * alphaScale),
  }))
}

function offsetSamples(samples: readonly RibbonSample[], amount: number): RibbonSample[] {
  return samples.map((sample, index) => {
    const prev = samples[Math.max(0, index - 1)]
    const next = samples[Math.min(samples.length - 1, index + 1)]
    const tangent = normalize(next.x - prev.x, next.y - prev.y)
    const normal = { x: -tangent.y, y: tangent.x }
    const wobble = Math.sin(index * 1.73 + sample.x * 0.01 + sample.y * 0.013)
    const offset = sample.width * amount * wobble
    return { ...sample, x: sample.x + normal.x * offset, y: sample.y + normal.y * offset }
  })
}

function movementStats(samples: readonly RibbonSample[]): { speed: number; curve: number } {
  if (samples.length < 3) return { speed: 0, curve: 0 }
  const a = samples[samples.length - 3]
  const b = samples[samples.length - 2]
  const c = samples[samples.length - 1]
  const ab = normalize(b.x - a.x, b.y - a.y)
  const bc = normalize(c.x - b.x, c.y - b.y)
  const curve = Math.max(0, 1 - (ab.x * bc.x + ab.y * bc.y))
  const speed = Math.hypot(c.x - b.x, c.y - b.y)
  return { speed, curve }
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return { x: 1, y: 0 }
  return { x: dx / length, y: dy / length }
}

function hashPoint(x: number, y: number): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)
}

function random01(seed: number): number {
  return hashPoint(seed, seed * 0.37) % 1
}
