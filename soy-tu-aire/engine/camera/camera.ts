import { PAPER_H, PAPER_W } from "../constants"
import { computeViewRect } from "./compute-view-rect"
import type { Vec2, ViewRect } from "../types"

export type ConveyorCameraInput = {
  aspect: number
  dt: number
  time: number
  timelineSpeed: number
  audioEnergy: number
  pointerScreen: Vec2 | null
  viewportW: number
  viewportH: number
  climax: number
  paperW?: number
  paperH?: number
}

type ConveyorMotionInput = {
  timelineSpeed: number
  audioEnergy: number
  climax: number
  pointerX01: number
}

type ConveyorVerticalInput = {
  pointerY01: number
  audioEnergy: number
  time: number
}

const START_X01 = 0.3
const START_Y01 = 0.5
// Horizontal conveyor speed (px/s). Two factors, like the original Flash:
//  - Music: "el volumen combinado de [voz, instrumental] controla la velocidad
//    de la cámara", scaled by the <velocidad> keyframes (1, 1.3, 0.7, 0 = stop).
//    SPEED_DRIFT is a floor so a quiet velocidad=1 passage still creeps; the audio
//    term carries the rhythm of the song moment.
//  - Climax: the song peaks at t≈168.7–218 (choreography climax = 1 and
//    <velocidad> = 1.3 there), which is the late "near the end" rush — SPEED_CLIMAX
//    makes the belt clearly accelerate through it, then it eases (velocidad 0.7)
//    and stops (0) into the outro. Tied to the song, not an arbitrary timer.
//  - Mouse X: a multiplier around the real (music) speed — cursor to the right
//    edge accelerates, to the left edge slows (but never stops), centre = real
//    world speed. POINTER_BIAS_RANGE < 1 guarantees the left edge never halts.
const SPEED_DRIFT = 84
const SPEED_AUDIO = 360
const SPEED_CLIMAX = 360
const POINTER_BIAS_RANGE = 0.55
const MAX_SPEED = 1000
const POINTER_REFERENCE_X = 0.5
const POINTER_REFERENCE_Y = 0.5
// Vertical conveyor: the camera also travels up/down forever. A gentle always-on
// drift keeps a sense of advance even at rest; the mouse Y steers the vertical
// travel (down → descend, up → ascend); audio adds liveliness.
// Vertical stays gentle, like the original: the head sits near the vertical
// middle and only drifts/eases softly (it does NOT pan hard up/down). Much
// smaller than the horizontal conveyor so the composition reads as flowing
// sideways, not scrolling vertically.
const VERT_DRIFT_SPEED = 7
const VERT_POINTER_SPEED = 42
const VERT_AUDIO_SPEED = 16

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function viewportPointer01(pointer: Vec2 | null, viewportW: number, viewportH: number): Vec2 {
  if (!pointer || viewportW <= 0 || viewportH <= 0) {
    return { x: POINTER_REFERENCE_X, y: POINTER_REFERENCE_Y }
  }
  return {
    x: clamp(pointer.x / viewportW, 0, 1),
    y: clamp(pointer.y / viewportH, 0, 1),
  }
}

export function computeConveyorCameraSpeed(input: ConveyorMotionInput): number {
  const velocidad = Math.max(0, input.timelineSpeed) // <velocidad> keyframe; 0 = stop
  const audio = clamp(input.audioEnergy, 0, 1) // combined voz+instrumental volume
  const climax = clamp(input.climax, 0, 1) // song peak (late rush)
  const music = velocidad * (SPEED_DRIFT + SPEED_AUDIO * audio + SPEED_CLIMAX * climax) // real world speed
  const bias = clamp((input.pointerX01 - 0.5) * 2, -1, 1) // right → +1, left → -1
  const pointerFactor = 1 + bias * POINTER_BIAS_RANGE // centre = 1 (real speed)
  return clamp(music * pointerFactor, 0, MAX_SPEED)
}

// Signed vertical conveyor speed (px/s). Positive descends the paper, negative
// ascends. Always non-zero in motion thanks to the drift term, so the world
// never feels still.
export function computeConveyorCameraVerticalSpeed(input: ConveyorVerticalInput): number {
  const drift = Math.sin(input.time * 0.16) * VERT_DRIFT_SPEED
  const steer = (clamp(input.pointerY01, 0, 1) - 0.5) * 2 * VERT_POINTER_SPEED
  const audio = Math.sin(input.time * 0.6) * clamp(input.audioEnergy, 0, 1) * VERT_AUDIO_SPEED
  return drift + steer + audio
}

export function computeConveyorCameraTarget(
  input: ConveyorCameraInput,
  scrollX: number,
  scrollY: number,
): { center: Vec2; zoom: number } {
  const paperW = input.paperW ?? PAPER_W
  const paperH = input.paperH ?? PAPER_H
  const breathing = Math.sin(input.time * 0.8) * 0.025
  const zoom = clamp(1.68 + breathing - clamp(input.climax, 0, 1) * 0.32, 1.24, 1.92)
  const viewAtOrigin = computeViewRect({ x: paperW / 2, y: paperH / 2 }, zoom, input.aspect, paperW, paperH)
  const minX = viewAtOrigin.w / 2
  const maxX = paperW - viewAtOrigin.w / 2
  const minY = viewAtOrigin.h / 2
  const maxY = paperH - viewAtOrigin.h / 2
  // Both axes are scroll accumulators around the buffer's working point; the
  // clamp is only a safety net — the treadmill (maybeWrap) recycles long before
  // an edge could show.
  const x = clamp(paperW * START_X01 + scrollX, minX, maxX)
  const y = clamp(paperH * START_Y01 + scrollY, minY, maxY)

  return { center: { x, y }, zoom }
}

export class Camera {
  center: Vec2 = { x: PAPER_W * START_X01, y: PAPER_H * START_Y01 }
  zoom = 1.68
  targetZoom = 1.68
  private scrollX = 0
  private scrollY = 0
  private initialized = false

  setZoom(z: number): void { this.targetZoom = z }

  resetCinematic(): void {
    this.scrollX = 0
    this.scrollY = 0
    this.initialized = false
    this.center = { x: PAPER_W * START_X01, y: PAPER_H * START_Y01 }
    this.zoom = 1.68
    this.targetZoom = 1.68
  }

  follow(target: Vec2, dt: number): void {
    const k = 1 - Math.exp(-2.5 * dt) // easing exponencial, estable a cualquier dt
    this.center.x += (target.x - this.center.x) * k
    this.center.y += (target.y - this.center.y) * k
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-1.5 * dt))
  }

  updateCinematic(input: ConveyorCameraInput): void {
    const pointer = viewportPointer01(input.pointerScreen, input.viewportW, input.viewportH)
    const speedX = computeConveyorCameraSpeed({
      timelineSpeed: input.timelineSpeed,
      audioEnergy: input.audioEnergy,
      climax: input.climax,
      pointerX01: pointer.x,
    })
    this.scrollX += speedX * Math.max(0, input.dt)
    const speedY = computeConveyorCameraVerticalSpeed({
      pointerY01: pointer.y,
      audioEnergy: input.audioEnergy,
      time: input.time,
    })
    this.scrollY += speedY * Math.max(0, input.dt)

    const target = computeConveyorCameraTarget(input, this.scrollX, this.scrollY)
    if (!this.initialized) {
      this.center = { ...target.center }
      this.zoom = target.zoom
      this.initialized = true
    } else {
      const centerK = 1 - Math.exp(-3.2 * input.dt)
      const zoomK = 1 - Math.exp(-1.65 * input.dt)
      this.center.x += (target.center.x - this.center.x) * centerK
      this.center.y += (target.center.y - this.center.y) * centerK
      this.zoom += (target.zoom - this.zoom) * zoomK
    }
    this.targetZoom = target.zoom
  }

  // Endless conveyor on BOTH axes: the paper buffer is finite, but the world must
  // feel infinite. When the camera drifts past a comfortable band of the buffer
  // (60% on X, ±12% from center on Y), recycle by snapping the working point back
  // toward the middle and report the world-shift vector {sx, sy} the engine must
  // apply to ink/brush/reveals/creatures so the whole world moves as one and the
  // wrap is invisible. Content shifted off the buffer is discarded, like the
  // original Flash.
  maybeWrap(): { sx: number; sy: number } {
    let sx = 0
    let sy = 0
    if (this.center.x > PAPER_W * 0.6) sx = -(this.center.x - PAPER_W * 0.3)
    if (this.center.y > PAPER_H * 0.62 || this.center.y < PAPER_H * 0.38) {
      sy = -(this.center.y - PAPER_H * 0.5)
    }
    this.center.x += sx
    this.scrollX += sx
    this.center.y += sy
    this.scrollY += sy
    return { sx, sy }
  }

  view(aspect: number): ViewRect {
    return computeViewRect(this.center, this.zoom, aspect, PAPER_W, PAPER_H)
  }
}
