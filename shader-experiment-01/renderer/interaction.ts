import type { Point } from "./contracts"

export type InteractionState = {
  mouse: [number, number]
  target: [number, number]
  last: [number, number]
  hover: number
  hoverTarget: number
  energy: number
  seed: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function createInteractionState(
  random: () => number = Math.random,
): InteractionState {
  return {
    mouse: [0.5, 0.5],
    target: [0.5, 0.5],
    last: [0.5, 0.5],
    hover: 0,
    hoverTarget: 0,
    energy: 0,
    seed: random(),
  }
}

export function moveInteraction(
  state: InteractionState,
  point: Point,
  reducedMotion: boolean,
  random: () => number = Math.random,
): void {
  const rawX = Number.isFinite(point[0]) ? point[0] : 0.5
  const rawY = Number.isFinite(point[1]) ? point[1] : 0.5
  const x = clamp01(rawX)
  const y = clamp01(rawY)
  const dx = rawX - 0.5
  const dy = rawY - 0.5
  const speed = Math.hypot(x - state.last[0], y - state.last[1])

  state.target[0] = x
  state.target[1] = y
  state.hoverTarget = Math.max(0, 1 - Math.hypot(dx, dy) * 1.6)

  if (state.hover < 0.05) state.seed = random()

  if (reducedMotion) {
    state.mouse[0] = x
    state.mouse[1] = y
    state.hover = state.hoverTarget
    state.energy = 0
  } else {
    state.energy = Math.min(1, state.energy + speed * 6)
  }

  state.last[0] = x
  state.last[1] = y
}

export function leaveInteraction(
  state: InteractionState,
  reducedMotion: boolean,
): void {
  state.hoverTarget = 0
  if (reducedMotion) {
    state.hover = 0
    state.energy = 0
  }
}

export function stepInteraction(
  state: InteractionState,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    state.mouse[0] = state.target[0]
    state.mouse[1] = state.target[1]
    state.hover = state.hoverTarget
    state.energy = 0
    return
  }

  state.mouse[0] += (state.target[0] - state.mouse[0]) * 0.18
  state.mouse[1] += (state.target[1] - state.mouse[1]) * 0.18
  state.hover += (state.hoverTarget - state.hover) * 0.08
  state.energy *= 0.93
}

export function shaderTime(
  elapsedMilliseconds: number,
  reducedMotion: boolean,
): number {
  return reducedMotion ? 0 : Math.max(0, elapsedMilliseconds) / 1000
}
