import {
  getEventDirective,
  type AttachmentMode,
  type BrushHoldDirective,
  type DirectedLayer,
  type RevealMode,
  type SpawnDirective,
} from "./event-directives"
import type { ChoreoEvent } from "../timeline/choreography"
import type { Vec2 } from "../types"

export type DirectedSpawn = {
  name: string
  fireAt: number
  layer: DirectedLayer
  attachment: AttachmentMode
  reveal: RevealMode
  targetLongSide?: number
  life: number
  offset: Vec2
  alpha: number
}

export type DirectedBrushHold = {
  startAt: number
  endAt: number
  pressure: number
}

export type DirectedEventBatch = {
  creatures: DirectedSpawn[]
  reveals: DirectedSpawn[]
  brushHolds: DirectedBrushHold[]
}

const DEFAULT_LIFE = 4
const DEFAULT_OFFSET: Vec2 = { x: 0, y: 0 }

export function expandDirectedEvents(event: ChoreoEvent): DirectedEventBatch {
  const creatures: DirectedSpawn[] = []
  const reveals: DirectedSpawn[] = []
  const brushHolds: DirectedBrushHold[] = []

  event.creatures.forEach((name, rawIndex) => {
    const directive = getEventDirective(name, event.t)

    creatures.push(
      ...expandSpawn(name, event.t, rawIndex, directive?.creatures?.[name]),
    )

    if (directive?.brushHold) {
      brushHolds.push(expandBrushHold(event.t, directive.brushHold))
    }
  })

  event.reveals.forEach((name, rawIndex) => {
    const directive = getEventDirective(name, event.t)

    reveals.push(
      ...expandSpawn(name, event.t, rawIndex, directive?.reveals?.[name]),
    )
  })

  return { creatures, reveals, brushHolds }
}

function expandSpawn(
  name: string,
  baseTime: number,
  rawIndex: number,
  directives?: SpawnDirective[],
): DirectedSpawn[] {
  if (!directives?.length) {
    return [defaultSpawn(name, baseTime)]
  }

  return directives.flatMap((directive, directiveIndex) =>
    Array.from({ length: directive.count }, (_, instanceIndex) => ({
      name,
      fireAt: roundTime(baseTime + directive.at),
      layer: directive.layer,
      attachment: directive.attachment,
      reveal: directive.reveal,
      targetLongSide: resolveTargetLongSide(
        directive,
        name,
        baseTime,
        rawIndex,
        directiveIndex,
        instanceIndex,
      ),
      life: directive.life ?? DEFAULT_LIFE,
      offset: resolveOffset(
        directive,
        name,
        baseTime,
        rawIndex,
        directiveIndex,
        instanceIndex,
      ),
      alpha: directive.alpha ?? 1,
    })),
  )
}

function defaultSpawn(name: string, baseTime: number): DirectedSpawn {
  return {
    name,
    fireAt: roundTime(baseTime),
    layer: "overInk",
    attachment: "world",
    reveal: "fade",
    targetLongSide: undefined,
    life: DEFAULT_LIFE,
    offset: { ...DEFAULT_OFFSET },
    alpha: 1,
  }
}

function expandBrushHold(baseTime: number, directive: BrushHoldDirective): DirectedBrushHold {
  const startAt = roundTime(baseTime + directive.startOffset)

  return {
    startAt,
    endAt: roundTime(startAt + directive.duration),
    pressure: directive.pressure,
  }
}

function resolveOffset(
  directive: SpawnDirective,
  name: string,
  baseTime: number,
  rawIndex: number,
  directiveIndex: number,
  instanceIndex: number,
): Vec2 {
  const offset = directive.offset ?? DEFAULT_OFFSET

  if (!directive.scatter) {
    return { ...offset }
  }

  const seed = seedFor(name, baseTime, rawIndex, directiveIndex, instanceIndex)

  return {
    x: roundPosition(offset.x + randomSigned(`${seed}:x`) * directive.scatter.x),
    y: roundPosition(offset.y + randomSigned(`${seed}:y`) * directive.scatter.y),
  }
}

function resolveTargetLongSide(
  directive: SpawnDirective,
  name: string,
  baseTime: number,
  rawIndex: number,
  directiveIndex: number,
  instanceIndex: number,
): number {
  const baseSize = Math.max(1, Math.round(directive.targetLongSide))

  if (!directive.scaleJitter) {
    return baseSize
  }

  if (rawIndex === 0 && directiveIndex === 0 && instanceIndex === 0) {
    return baseSize
  }

  const signed = randomSigned(
    `${seedFor(name, baseTime, rawIndex, directiveIndex, instanceIndex)}:scale`,
  )
  const jittered = Math.max(
    1,
    Math.round(directive.targetLongSide * (1 + signed * directive.scaleJitter)),
  )

  if (jittered !== baseSize) {
    return jittered
  }

  return Math.max(1, jittered + (signed >= 0 ? 1 : -1))
}

function seedFor(
  name: string,
  baseTime: number,
  rawIndex: number,
  directiveIndex: number,
  instanceIndex: number,
): string {
  return `${name}:${roundTime(baseTime)}:${rawIndex}:${directiveIndex}:${instanceIndex}`
}

function hash(input: string): number {
  let value = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }

  return value >>> 0
}

function randomSigned(seed: string): number {
  return (hash(seed) / 0xffffffff) * 2 - 1
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000
}

function roundPosition(value: number): number {
  return Math.round(value * 100) / 100
}
