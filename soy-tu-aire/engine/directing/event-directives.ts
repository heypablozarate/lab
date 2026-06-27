export type DirectedLayer =
  | "underInk"
  | "insideInk"
  | "overInk"
  | "foreground"
  | "screenForeground"

export type AttachmentMode = "world" | "screen" | "brushHead" | "strokeEnd" | "recentStroke"

export type RevealMode = "fade" | "hardCut" | "drawLeftToRight" | "radialBurst" | "strokeMask"

export type VecOffset = { x: number; y: number }

export type BrushHoldDirective = {
  startOffset: number
  duration: number
  pressure: number
}

export type SpawnDirective = {
  at: number
  count: number
  layer: DirectedLayer
  attachment: AttachmentMode
  reveal: RevealMode
  targetLongSide: number
  life: number
  offset?: VecOffset
  scatter?: VecOffset
  scaleJitter?: number
  alpha?: number
  rotationJitter?: number
}

export type EventDirective = {
  key: string
  match: string
  timeRange?: readonly [number, number]
  notes: string
  brushHold?: BrushHoldDirective
  creatures?: Record<string, SpawnDirective[]>
  reveals?: Record<string, SpawnDirective[]>
}

export const EVENT_DIRECTIVES: EventDirective[] = [
  {
    key: "entrando",
    match: "entrando",
    notes: "Reference at 38.8-39.5s is a full-frame silhouette/foto event delayed from the raw choreography time.",
    brushHold: { startOffset: 1.85, duration: 0.82, pressure: 0.05 },
    creatures: {
      entrando: [
        {
          at: 2.12,
          count: 1,
          layer: "screenForeground",
          attachment: "screen",
          reveal: "hardCut",
          targetLongSide: 760,
          life: 0.95,
          alpha: 1,
        },
      ],
    },
  },
  {
    key: "salpico",
    match: "salpico",
    notes: "Reference prepares a U-shaped stroke, then the ink splash arrives roughly two seconds late and dominates the frame.",
    creatures: {
      salpico: [
        {
          at: 1.95,
          count: 1,
          layer: "overInk",
          attachment: "world",
          reveal: "radialBurst",
          targetLongSide: 860,
          life: 3.2,
          offset: { x: -80, y: -24 },
          alpha: 1,
        },
      ],
    },
  },
  {
    key: "labios",
    match: "labios",
    notes: "Reference slows/holds the brush, completes a loop, then reveals red lips progressively at the stroke exit.",
    brushHold: { startOffset: -0.05, duration: 1.25, pressure: 0.08 },
    creatures: {
      labios: [
        {
          at: 1.85,
          count: 1,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "drawLeftToRight",
          targetLongSide: 430,
          life: 4.5,
          offset: { x: 72, y: 18 },
          alpha: 1,
        },
      ],
    },
  },
  {
    key: "pececillo-intro",
    match: "pececillo",
    timeRange: [0, 40],
    notes: "Intro fish read as a few visible figures around a thin stroke, with one larger koi.",
    creatures: {
      pececillo: [
        {
          at: 0,
          count: 4,
          layer: "underInk",
          attachment: "world",
          reveal: "fade",
          targetLongSide: 185,
          life: 4.2,
          scatter: { x: 190, y: 110 },
          scaleJitter: 0.5,
          rotationJitter: 0.45,
        },
      ],
    },
  },
  {
    key: "pececillo-climax",
    match: "pececillo",
    timeRange: [168, 218],
    notes: "Climax fish are small repeated clusters carried by the camera around heavy horizontal ink.",
    creatures: {
      pececillo: [
        {
          at: 0,
          count: 5,
          layer: "underInk",
          attachment: "world",
          reveal: "fade",
          targetLongSide: 145,
          life: 5.5,
          scatter: { x: 220, y: 86 },
          scaleJitter: 0.42,
          rotationJitter: 0.35,
        },
      ],
    },
  },
  {
    key: "cosquilla",
    match: "cosquilla",
    notes: "Repeated white/black tickle marks ride in the dark stroke instead of floating on paper.",
    creatures: {
      cosquilla: [
        {
          at: 0,
          count: 3,
          layer: "insideInk",
          attachment: "recentStroke",
          reveal: "strokeMask",
          targetLongSide: 210,
          life: 2.4,
          scatter: { x: 120, y: 36 },
          scaleJitter: 0.36,
        },
      ],
    },
  },
  {
    key: "Entradaagujero",
    match: "Entradaagujero",
    notes: "Hole entrance is a small low-pressure mark around 142-145s.",
    creatures: {
      Entradaagujero: [
        {
          at: 0,
          count: 1,
          layer: "underInk",
          attachment: "world",
          reveal: "fade",
          targetLongSide: 180,
          life: 2.8,
          alpha: 0.88,
        },
      ],
    },
  },
  {
    key: "Salidaagujero",
    match: "Salidaagujero",
    notes: "Hole exit is a small low-pressure mark alternating with the entrance marks.",
    creatures: {
      Salidaagujero: [
        {
          at: 0,
          count: 1,
          layer: "underInk",
          attachment: "world",
          reveal: "fade",
          targetLongSide: 160,
          life: 2.8,
          alpha: 0.82,
        },
      ],
    },
  },
  {
    key: "dandelion-climax",
    match: "dandelion",
    timeRange: [168, 218],
    notes: "Dandelion climax reads as many small marks scattered around the thick horizontal ink.",
    creatures: {
      dandelion: [
        {
          at: 0,
          count: 10,
          layer: "underInk",
          attachment: "world",
          reveal: "fade",
          targetLongSide: 150,
          life: 5.2,
          scatter: { x: 260, y: 90 },
          scaleJitter: 0.48,
          rotationJitter: 0.55,
        },
      ],
    },
  },
]

export function getEventDirective(name: string, t = Number.NaN): EventDirective | undefined {
  return EVENT_DIRECTIVES.find((directive) => {
    if (directive.key === name) return true
    if (directive.match !== name) return false
    if (!directive.timeRange || Number.isNaN(t)) return true
    return t >= directive.timeRange[0] && t <= directive.timeRange[1]
  })
}
