import { PAPER_W, PAPER_H } from "../constants"
import { computeStrokeDynamics } from "./stroke-dynamics"
import { springStep } from "./spring"
import type { BrushMod, RibbonSample, Vec2 } from "../types"

const STIFFNESS = 90
const DAMPING = 14
// Initial head speed (paper px/s) when the pen resumes after an image reveal.
const RESUME_LAUNCH_SPEED = 260
const MAX_CENTERLINE_SAMPLES = 180
const NIB_BASE = 0.7
const NIB_DRIFT = 0.85
const NIB_RATE = 0.085

type BrushStroke = { size: number; alpha: number }

export function computeBrushStroke(speed: number, mod: BrushMod): BrushStroke {
  const dynamics = computeStrokeDynamics({
    speed,
    previousSpeed: speed,
    curvature: 0,
    pressure: mod.pressure,
    climax: mod.climax,
    ink: mod.ink ?? 1,
    hold: mod.hold === true,
  })
  return { size: dynamics.width, alpha: dynamics.alpha }
}

export class Brush {
  pos: Vec2 = { x: PAPER_W / 2, y: PAPER_H / 2 }
  private vel: Vec2 = { x: 0, y: 0 }
  private prev: Vec2 = { ...this.pos }
  private samples: RibbonSample[] = []
  private previousSpeed = 0
  private wanderT = 0
  private nibT = 0

  get velocity(): Vec2 {
    return { x: this.vel.x, y: this.vel.y }
  }

  getRibbonSamples(): readonly RibbonSample[] {
    return this.samples
  }

  // Conveyor recycle: shift the head and the whole centerline history by the
  // world-shift vector so the ribbon stays continuous across an (invisible) wrap.
  shift(sx: number, sy: number): void {
    this.pos.x += sx
    this.pos.y += sy
    this.prev.x += sx
    this.prev.y += sy
    for (const sample of this.samples) {
      sample.x += sx
      sample.y += sy
    }
  }

  // Birth the stroke at a fresh position (used when the song starts): drop the
  // head there, reset velocity, and clear the centerline so no line connects to
  // any pre-birth wander.
  bornAt(pos: Vec2): void {
    this.pos = { x: pos.x, y: pos.y }
    this.prev = { x: pos.x, y: pos.y }
    this.vel = { x: 0, y: 0 }
    this.samples = []
    this.previousSpeed = 0
  }

  // Lift-and-resume: after an image is "drawn" by the stroke, the pen touches
  // down again at `pos` (the image's far edge) with a fresh centerline, so no
  // ribbon segment ever connects across — or strikes through — the artwork.
  // `dir` launches the head forward so the line flows OUT of the image instead
  // of stalling on its edge.
  resumeFrom(pos: Vec2, dir?: Vec2): void {
    this.bornAt(pos)
    if (dir) {
      this.vel = { x: dir.x * RESUME_LAUNCH_SPEED, y: dir.y * RESUME_LAUNCH_SPEED }
    }
  }

  update(dt: number, target: Vec2 | null, mod: BrushMod): void {
    let t = target
    if (!t) {
      // Wander procedural suave (figura de Lissajous lenta) cuando no hay input.
      this.wanderT += dt
      t = {
        x: PAPER_W / 2 + Math.sin(this.wanderT * 0.5) * PAPER_W * 0.22,
        y: PAPER_H / 2 + Math.sin(this.wanderT * 0.37) * PAPER_H * 0.22,
      }
    }
    this.prev.x = this.pos.x; this.prev.y = this.pos.y
    springStep(this.pos, this.vel, t, STIFFNESS, DAMPING, dt)
    const speed = Math.hypot(this.pos.x - this.prev.x, this.pos.y - this.prev.y) / Math.max(dt, 1e-3)
    const prevSample = this.samples.at(-2)
    const lastSample = this.samples.at(-1)
    const curvature = prevSample && lastSample ? curvatureBetween(prevSample, lastSample, this.pos) : 0
    const held = mod.hold === true
    const dynamics = computeStrokeDynamics({
      speed: held ? Math.min(speed, 48) : speed,
      previousSpeed: this.previousSpeed,
      curvature,
      pressure: mod.pressure,
      climax: mod.climax,
      ink: mod.ink ?? 1,
      hold: held,
    })
    const bristleNoise = Math.abs(Math.sin(this.pos.x * 0.017 + this.pos.y * 0.031 + this.samples.length * 0.73))
    const dryCut = !held && dynamics.dryness > 0.54 && bristleNoise > 0.68
      ? (bristleNoise - 0.68) / 0.32
      : 0
    this.previousSpeed = speed
    this.nibT += dt
    const nibAngle = NIB_BASE + Math.sin(this.nibT * NIB_RATE) * NIB_DRIFT
    this.samples.push({
      x: this.pos.x,
      y: this.pos.y,
      width: dynamics.width * (1 - dryCut * 0.38),
      alpha: dynamics.alpha * (1 - dryCut * 0.62),
      dryness: dynamics.dryness,
      bristleSplit: Math.min(1, dynamics.bristleSplit + dryCut * 0.32),
      headPool: dynamics.headPool,
      edgeJitter: Math.min(1, dynamics.edgeJitter + dryCut * 0.22),
      nib: nibAngle,
    })
    if (this.samples.length > MAX_CENTERLINE_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_CENTERLINE_SAMPLES)
    }
  }
}

function curvatureBetween(a: Vec2, b: Vec2, c: Vec2): number {
  const ab = normalize(b.x - a.x, b.y - a.y)
  const bc = normalize(c.x - b.x, c.y - b.y)
  return Math.max(0, 1 - (ab.x * bc.x + ab.y * bc.y))
}

function normalize(dx: number, dy: number): Vec2 {
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) return { x: 1, y: 0 }
  return { x: dx / length, y: dy / length }
}
