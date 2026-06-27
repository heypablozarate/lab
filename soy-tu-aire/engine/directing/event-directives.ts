export type DirectedLayer =
  | "underInk"
  | "insideInk"
  | "overInk"
  | "foreground"
  | "screenForeground"

export type AttachmentMode = "world" | "screen" | "brushHead" | "strokeEnd" | "recentStroke"

export type RevealMode =
  | "fade"
  | "hardCut"
  | "drawLeftToRight"
  | "radialBurst"
  | "strokeMask"
  | "inkPop"

export type VecOffset = { x: number; y: number }

export type BrushHoldDirective = {
  startOffset: number
  duration: number
  pressure: number
}

export type SpawnDirective = {
  at: number
  count: number
  stagger?: number
  layer: DirectedLayer
  attachment: AttachmentMode
  reveal: RevealMode
  targetLongSide: number
  life: number
  offset?: VecOffset
  scatter?: VecOffset
  drift?: VecOffset
  scaleJitter?: number
  alpha?: number
  rotationJitter?: number
  frameOffset?: number
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
          at: 1.8,
          count: 1,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "inkPop",
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
          reveal: "inkPop",
          targetLongSide: 430,
          life: 4.5,
          offset: { x: 72, y: 18 },
          alpha: 1,
        },
      ],
    },
  },
  {
    key: "pajaros-intro",
    match: "pajaros",
    timeRange: [0, 40],
    notes: "Bird silhouettes stay as a staggered flock carried by the camera, not as a single centered sprite.",
    creatures: {
      pajaros: [
        {
          at: 0,
          count: 7,
          stagger: 0.055,
          layer: "foreground",
          attachment: "recentStroke",
          reveal: "hardCut",
          targetLongSide: 118,
          life: 4.4,
          scatter: { x: 230, y: 118 },
          drift: { x: -72, y: -18 },
          scaleJitter: 0.56,
          rotationJitter: 0.75,
          frameOffset: 0.34,
          alpha: 0.92,
        },
      ],
    },
  },
  {
    key: "pececillo-intro",
    match: "pececillo",
    timeRange: [0, 40],
    notes: "Intro fish is drawn from the head after the earlier bird flock clears, rather than fading in as a loose cluster.",
    creatures: {
      pececillo: [
        {
          at: 1.62,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "inkPop",
          targetLongSide: 310,
          life: 3.7,
          offset: { x: -8, y: 44 },
          rotationJitter: 0.18,
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
          stagger: 0.075,
          layer: "foreground",
          attachment: "recentStroke",
          reveal: "hardCut",
          targetLongSide: 105,
          life: 5.5,
          scatter: { x: 210, y: 92 },
          drift: { x: -82, y: 16 },
          scaleJitter: 0.48,
          rotationJitter: 0.55,
          frameOffset: 0.36,
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
          count: 1,
          layer: "insideInk",
          attachment: "recentStroke",
          reveal: "inkPop",
          targetLongSide: 245,
          life: 2.4,
          scatter: { x: 42, y: 14 },
          scaleJitter: 0.18,
          rotationJitter: 0.25,
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
    key: "mariposa-cluster",
    match: "mariposa",
    notes: "Butterflies appear late as several small silhouettes flapping around the brush head.",
    creatures: {
      mariposa: [
        {
          at: 1.52,
          count: 5,
          stagger: 0.08,
          layer: "foreground",
          attachment: "brushHead",
          reveal: "hardCut",
          targetLongSide: 96,
          life: 2.7,
          scatter: { x: 145, y: 82 },
          drift: { x: -64, y: 28 },
          scaleJitter: 0.44,
          rotationJitter: 0.9,
          frameOffset: 0.42,
          alpha: 0.96,
        },
      ],
    },
  },
  {
    key: "mariposanoloop-cluster",
    match: "mariposanoloop",
    notes: "No-loop butterflies also arrive late and small, with staggered opening phases near the head.",
    creatures: {
      mariposanoloop: [
        {
          at: 1.78,
          count: 4,
          stagger: 0.08,
          layer: "foreground",
          attachment: "brushHead",
          reveal: "hardCut",
          targetLongSide: 88,
          life: 2.4,
          scatter: { x: 112, y: 70 },
          drift: { x: -52, y: 18 },
          scaleJitter: 0.4,
          rotationJitter: 0.86,
          frameOffset: 0.38,
          alpha: 0.94,
        },
      ],
    },
  },
  {
    key: "dandelion-small",
    match: "dandelion",
    timeRange: [0, 168],
    notes: "Pre-climax dandelion marks read as tiny seed-like scratches near the stroke, not large flowers.",
    creatures: {
      dandelion: [
        {
          at: 0,
          count: 5,
          stagger: 0.05,
          layer: "insideInk",
          attachment: "recentStroke",
          reveal: "hardCut",
          targetLongSide: 72,
          life: 2.8,
          scatter: { x: 120, y: 44 },
          drift: { x: -38, y: -10 },
          scaleJitter: 0.52,
          rotationJitter: 0.7,
          alpha: 0.74,
        },
      ],
    },
  },
  {
    key: "dandelion-climax",
    match: "dandelion",
    timeRange: [168, 218],
    notes: "Dandelion climax reads as small dark marks scattered around the thick horizontal ink.",
    creatures: {
      dandelion: [
        {
          at: 0,
          count: 7,
          stagger: 0.065,
          layer: "foreground",
          attachment: "recentStroke",
          reveal: "hardCut",
          targetLongSide: 92,
          life: 5.2,
          scatter: { x: 230, y: 92 },
          drift: { x: -78, y: 8 },
          scaleJitter: 0.5,
          rotationJitter: 0.72,
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
