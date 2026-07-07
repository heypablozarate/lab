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
  | "strokeBorn"
  | "brushDraw"
  | "strokeEmbedded"
  | "portalTakeover"

export type VecOffset = { x: number; y: number }

export type StrokeFitDirective = {
  length: number
  widthScale: number
  minWidth?: number
  revealSeconds?: number
}

export type BrushHoldDirective = {
  startOffset: number
  duration: number
  pressure: number
  paint?: boolean
  freeze?: boolean
}

export type SpawnDirective = {
  spawnName?: string
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
  rotationJitter?: number
  frameOffset?: number
  strokeFit?: StrokeFitDirective
  fixed?: boolean
  revealDuration?: number
}

export type EventDirective = {
  key: string
  match: string
  timeRange?: readonly [number, number]
  notes: string
  brushHold?: BrushHoldDirective
  creatures?: Record<string, SpawnDirective[]>
  reveals?: Record<string, SpawnDirective[]>
  skipCreature?: boolean
}

export const EVENT_DIRECTIVES: EventDirective[] = [
  {
    key: "chica",
    match: "chica",
    notes: "The first figure is drawn by the stroke itself: the pen lifts and waits while the girl wipes in at the tip, then touches down again at her far edge (engine brushResume) so the line grows out of the figure instead of crossing it.",
    brushHold: { startOffset: 1.34, duration: 0.58, pressure: 0, paint: false },
    creatures: {
      chica: [
        {
          at: 1.42,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "brushDraw",
          targetLongSide: 340,
          life: 3.6,
          offset: { x: 0, y: 0 },
          drift: { x: 0, y: 0 },
          fixed: true,
          revealDuration: 0.44,
        },
      ],
    },
  },
  {
    key: "entrando",
    match: "entrando",
    notes: "Reference at 38.6-39.8s is a full-frame hole takeover delayed from the raw choreography time; it starts with a slightly larger entrando impact before the Entradaagujero portal art takes over.",
    brushHold: { startOffset: 1.7, duration: 1.55, pressure: 0, paint: false },
    creatures: {
      entrando: [
        {
          spawnName: "entrando",
          at: 1.52,
          count: 1,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "radialBurst",
          targetLongSide: 360,
          life: 0.72,
          offset: { x: 18, y: -8 },
          drift: { x: -42, y: 0 },
        },
        {
          spawnName: "EntradaagujeroPortal",
          at: 1.82,
          count: 1,
          layer: "screenForeground",
          attachment: "screen",
          reveal: "portalTakeover",
          targetLongSide: 920,
          life: 2.8,
          // Opens as a small figure in the hole, then dives in: it keeps zooming
          // past the viewport (mostly centred so the camera reads as going
          // through the hole) until only the transparent centre fills the screen.
          offset: { x: 0, y: 6 },
          drift: { x: -70, y: 12 },
        },
      ],
    },
  },
  {
    key: "salpico",
    match: "salpico",
    notes: "Reference prepares a U-shaped stroke, then the ink blot becomes the brush mark: the ribbon stops, the blot lands from the current tip, and the ribbon resumes after it.",
    brushHold: { startOffset: 2.2, duration: 0.36, pressure: 0, paint: false },
    creatures: {
      salpico: [
        {
          at: 2.2,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "hardCut",
          targetLongSide: 720,
          life: 3.2,
          offset: { x: 0, y: 0 },
          drift: { x: 0, y: 0 },
          fixed: true,
        },
      ],
    },
  },
  {
    key: "labios",
    match: "labios",
    notes: "Reference completes the loop, then lifts the pen while the lips draw out from the left corner; the lips hold still while being drawn and the line resumes from their right corner (engine brushResume).",
    brushHold: { startOffset: 1.58, duration: 0.95, pressure: 0, paint: false },
    creatures: {
      labios: [
        {
          at: 1.72,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "brushDraw",
          // 300 = old 480 rescaled to the lips' VISIBLE art (~65% of the PNG
          // canvas is transparent margin) so the on-screen size is unchanged
          // now that targetLongSide scales the visible bounds, not the canvas.
          targetLongSide: 300,
          life: 5.2,
          offset: { x: 0, y: 0 },
          drift: { x: 0, y: 0 },
          fixed: true,
          revealDuration: 0.7,
        },
      ],
    },
  },
  {
    key: "pajaros-intro",
    match: "pajaros",
    timeRange: [0, 40],
    notes: "Bird silhouettes detach late from the ink mass as several repeated impressions of the static pajaros.png sprite, plus a few animated birds from the pajaros__ frame sequence.",
    creatures: {
      pajaros: [
        {
          spawnName: "pajaros",
          at: 2.0,
          // 2 (was 4): the flock PNG already draws ~35 birds, so 4 impressions
          // stacked the same field on top of itself. Bigger and fewer reads as
          // one flock instead of a blur.
          count: 2,
          stagger: 0.055,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          // 650 (was 310): the flock PNG is ~96%w/34%h visible — at 310 the
          // individual birds were unreadable. Scaled to the visible art now.
          targetLongSide: 650,
          life: 3,
          offset: { x: -116, y: 8 },
          scatter: { x: 145, y: 54 },
          drift: { x: -74, y: -12 },
          scaleJitter: 0.22,
          rotationJitter: 0.24,
        },
        {
          spawnName: "pajarosVolando",
          at: 2.08,
          count: 3,
          stagger: 0.12,
          layer: "foreground",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          targetLongSide: 130,
          life: 3.4,
          offset: { x: -70, y: -32 },
          scatter: { x: 180, y: 82 },
          drift: { x: -180, y: -64 },
          scaleJitter: 0.28,
          rotationJitter: 0.18,
          frameOffset: 0.2,
        },
      ],
    },
  },
  {
    key: "pezmancha-intro",
    match: "pezmancha",
    timeRange: [0, 40],
    notes: "The fish mark first reads as a black ink blot emitted from the brush tip under the loop.",
    creatures: {
      pezmancha: [
        {
          at: 1.52,
          count: 1,
          layer: "insideInk",
          attachment: "brushHead",
          reveal: "strokeBorn",
          // 440 (was 185): the koi-school PNG is a wide, mostly-full-width
          // field — scaled up so the individual fish read.
          targetLongSide: 440,
          life: 2.1,
          offset: { x: -6, y: 24 },
          drift: { x: -45, y: 6 },
          rotationJitter: 0.18,
        },
      ],
    },
  },
  {
    key: "pececillo-intro",
    match: "pececillo",
    timeRange: [0, 40],
    notes: "Intro koi read in three beats: one large koi, a school, then two animated sprites over the brush trace.",
    creatures: {
      pececillo: [
        {
          at: 1.42,
          count: 1,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          targetLongSide: 210,
          life: 3.1,
          offset: { x: -38, y: 34 },
          drift: { x: -54, y: 4 },
          rotationJitter: 0.16,
        },
        {
          at: 1.62,
          count: 5,
          stagger: 0.055,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          targetLongSide: 112,
          life: 2.9,
          offset: { x: -4, y: 28 },
          scatter: { x: 110, y: 30 },
          drift: { x: -82, y: 7 },
          scaleJitter: 0.28,
          rotationJitter: 0.36,
          frameOffset: 0.3,
        },
        {
          at: 1.74,
          count: 2,
          stagger: 0.07,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          targetLongSide: 98,
          life: 3,
          offset: { x: 16, y: -26 },
          scatter: { x: 86, y: 18 },
          drift: { x: -70, y: -4 },
          scaleJitter: 0.26,
          rotationJitter: 0.4,
          frameOffset: 0.45,
        },
      ],
    },
  },
  {
    key: "pececillo-preclimax",
    match: "pececillo",
    timeRange: [120, 168],
    notes: "The mid-song fish cues are dry scratches on a hairline stroke, not recognizable large fish.",
    creatures: {
      pececillo: [
        {
          at: 0.08,
          count: 3,
          stagger: 0.055,
          layer: "insideInk",
          attachment: "recentStroke",
          reveal: "strokeBorn",
          targetLongSide: 56,
          life: 1.55,
          scatter: { x: 100, y: 32 },
          drift: { x: -46, y: -4 },
          scaleJitter: 0.42,
          rotationJitter: 0.48,
          frameOffset: 0.3,
        },
      ],
    },
  },
  {
    key: "pececillo-climax",
    match: "pececillo",
    timeRange: [168, 218],
    notes: "Climax fish are short contact marks orbiting the heavy stroke, not floating animated objects.",
    creatures: {
      pececillo: [
        {
          at: 0.04,
          count: 5,
          stagger: 0.065,
          layer: "overInk",
          attachment: "recentStroke",
          reveal: "strokeBorn",
          targetLongSide: 66,
          life: 2.8,
          scatter: { x: 150, y: 58 },
          drift: { x: -72, y: 10 },
          scaleJitter: 0.46,
          rotationJitter: 0.55,
          frameOffset: 0.36,
        },
      ],
    },
  },
  {
    key: "cosquilla",
    match: "cosquilla",
    notes: "Cosquilla is written once by the word reveal layer; the dense repeated raw sprite cues are suppressed.",
    skipCreature: true,
  },
  {
    key: "surco",
    match: "surco",
    notes: "Surco is handled by the word reveal layer on the trace; duplicate raw creature hits are suppressed.",
    skipCreature: true,
  },
  {
    key: "cera",
    match: "cera",
    notes: "Cera is a brush stamp, not a separate sprite: the ribbon stops, and the wax/ink blot's own connection anchor (engine BRUSH_DRAW_ANCHORS) lands its upper mass on the brush tip — no offset needed, the anchor already positions it — then painting resumes from its exit smudge.",
    brushHold: { startOffset: 0, duration: 0.28, pressure: 0, paint: false },
    creatures: {
      cera: [
        {
          at: 0.05,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "hardCut",
          // 520 (was 560): the blob-without-drips reads at roughly this scale
          // once targetLongSide sizes the visible art (blob + drips, ~98% of
          // the canvas) rather than the padded canvas.
          targetLongSide: 520,
          life: 3.6,
          drift: { x: 0, y: 0 },
          fixed: true,
        },
      ],
    },
  },
  {
    key: "cremallera",
    match: "cremallera",
    notes: "The zipper is embedded inside the low-pressure stroke and clipped to the recent ribbon path.",
    creatures: {
      cremallera: [
        {
          at: 0.18,
          count: 1,
          layer: "insideInk",
          attachment: "strokeEnd",
          reveal: "strokeEmbedded",
          targetLongSide: 390,
          life: 2.35,
          drift: { x: 0, y: 0 },
          strokeFit: { length: 400, widthScale: 2.4, minWidth: 34, revealSeconds: 0.55 },
        },
      ],
    },
  },
  {
    key: "Ogrande",
    match: "Ogrande",
    notes: "The large O is drawn while the brush pauses, then the line resumes from the same head position.",
    brushHold: { startOffset: 0.2, duration: 0.72, pressure: 0, paint: false },
    creatures: {
      Ogrande: [
        {
          at: 0.24,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "brushDraw",
          // 280 = old 360 rescaled to Ogrande's VISIBLE art (~78% of the PNG
          // canvas) so the on-screen ring size is unchanged under visible-art scaling.
          targetLongSide: 280,
          life: 3.5,
          offset: { x: 0, y: 0 },
          drift: { x: 0, y: 0 },
          fixed: true,
          revealDuration: 0.61,
        },
      ],
    },
  },
  {
    key: "burbuja",
    match: "burbuja",
    notes: "Bubbles are compact marks that flicker around the water stroke after it is drawn.",
    creatures: {
      burbuja: [
        {
          at: 0.02,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "strokeBorn",
          // 340 (was 96): the bubble field PNG is a wide scatter of ~50
          // bubbles — scaled up so individual bubbles read, with a longer
          // life to match (was flickering out almost immediately).
          targetLongSide: 340,
          life: 1.6,
          scatter: { x: 36, y: 26 },
          drift: { x: -18, y: -8 },
          scaleJitter: 0.5,
          rotationJitter: 0.2,
        },
      ],
    },
  },
  {
    key: "Ondasagua",
    match: "Ondasagua",
    notes: "The water wave follows the tip of the stroke and opens along the line.",
    creatures: {
      Ondasagua: [
        {
          at: 0.16,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "strokeBorn",
          // 360 (was 178): the water-splash PNG fills nearly the whole
          // canvas, so this is close to a like-for-like visible-art rescale.
          targetLongSide: 360,
          life: 1.35,
          offset: { x: -18, y: -8 },
          drift: { x: -24, y: -4 },
        },
      ],
    },
  },
  {
    key: "recuerdo_b",
    match: "recuerdo_b",
    notes: "Memory blocks appear as many small staggered squares around the break in the trace.",
    creatures: {
      recuerdo_b: [
        {
          at: 0,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "strokeBorn",
          // 400 (was 60): the memory-block PNG is a cluster of 5 ramilletes
          // that reads as a single blob at 60 — scaled up so the leaf
          // clusters read, with a longer life to match.
          targetLongSide: 400,
          life: 2.2,
          scatter: { x: 96, y: 70 },
          drift: { x: -70, y: -18 },
          scaleJitter: 0.45,
          rotationJitter: 0.4,
        },
      ],
    },
  },
  {
    key: "lagrima",
    match: "lagrima",
    notes: "Lagrima is written once by the word reveal layer; the raw creature sprite is suppressed.",
    skipCreature: true,
  },
  {
    key: "cuelo",
    match: "cuelo",
    notes: "The 'cuelo' word PNG is cued at the lyric line start (48.5s) but the word itself is sung ~0.9s later, so the reveal is offset to land on the sung word, not before it.",
    reveals: {
      cuelo: [
        {
          spawnName: "cuelo",
          at: 0.9,
          count: 1,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "brushDraw",
          targetLongSide: 360,
          life: 3,
        },
      ],
    },
  },
  {
    key: "Entradaagujero",
    match: "Entradaagujero",
    notes: "The 142-145s hole reprises the takeover small and intermittent: little dark hole-beads that pop on the line and blink, without repeating the bowler-man takeover PNG.",
    creatures: {
      Entradaagujero: [
        {
          spawnName: "Salidaagujero",
          at: 0,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "inkPop",
          // 420 (was 190): the splatter PNG is a dispersed spray — scaled up
          // so its scattered dots read as a splash instead of a smudge.
          targetLongSide: 420,
          life: 0.66,
          offset: { x: -6, y: 0 },
          scatter: { x: 70, y: 22 },
          scaleJitter: 0.26,
          rotationJitter: 0.22,
        },
      ],
    },
  },
  {
    key: "Salidaagujero",
    match: "Salidaagujero",
    notes: "Hole exit alternates with the entrance bead-holes — same small intermittent blink, a touch smaller.",
    creatures: {
      Salidaagujero: [
        {
          at: 0,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "inkPop",
          // 420 (was 168): same dispersed-splatter rescale as the entrance bead.
          targetLongSide: 420,
          life: 0.6,
          offset: { x: -10, y: 0 },
          scatter: { x: 64, y: 20 },
          scaleJitter: 0.28,
          rotationJitter: 0.22,
        },
      ],
    },
  },
  {
    key: "Salidaagujero-climax",
    match: "Salidaagujero",
    timeRange: [168, 170],
    notes: "At the climax attack the exit-hole art is only a tiny cyan/black spark before the heavy brush arrives.",
    creatures: {
      Salidaagujero: [
        {
          at: 0.02,
          count: 1,
          layer: "insideInk",
          attachment: "brushHead",
          reveal: "strokeBorn",
          targetLongSide: 86,
          life: 0.95,
          scatter: { x: 16, y: 8 },
          scaleJitter: 0.28,
          rotationJitter: 0.22,
        },
      ],
    },
  },
  {
    key: "alambre",
    match: "alambre",
    notes: "Barbed wire becomes the brush stroke itself: embedded, slightly thicker than the ribbon, and clipped to the trace path.",
    creatures: {
      alambre: [
        {
          at: 0.05,
          count: 1,
          layer: "insideInk",
          attachment: "strokeEnd",
          reveal: "strokeEmbedded",
          targetLongSide: 420,
          life: 2.8,
          drift: { x: 0, y: 0 },
          strokeFit: { length: 520, widthScale: 4.6, minWidth: 68, revealSeconds: 0.72 },
        },
      ],
    },
  },
  {
    key: "uno",
    match: "uno",
    notes: "\"Uno\" is stamped as a brush-drawn word, like chica/labios/Ogrande: the pen pauses while it writes in at the tip, then resumes from its right edge (engine brushResume) instead of scattering as an illegible mark.",
    brushHold: { startOffset: 0, duration: 0.6, pressure: 0, paint: false },
    creatures: {
      uno: [
        {
          at: 0.05,
          count: 1,
          layer: "overInk",
          attachment: "brushHead",
          reveal: "brushDraw",
          targetLongSide: 300,
          life: 2.5,
          fixed: true,
          // Tighter than the hold's 0.6s duration (like chica/labios/Ogrande)
          // so the write-in finishes with a small buffer before the pen
          // resumes, instead of the auto-derived ~0.56s cutting it close.
          revealDuration: 0.5,
        },
      ],
    },
  },
  {
    key: "mariposa-cluster",
    match: "mariposa",
    notes: "Butterflies use the static mariposanoloop impression plus a separate bounce-loop frame strip, matching the static/animated split used by the bird cue.",
    creatures: {
      mariposa: [
        {
          spawnName: "mariposanoloop",
          at: 1.42,
          count: 1,
          layer: "overInk",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          // 300 (was 135): the static impression PNG is ~66% visible art —
          // scaled up so the butterfly reads.
          targetLongSide: 300,
          life: 1.9,
          offset: { x: -34, y: -6 },
          drift: { x: -45, y: 12 },
          rotationJitter: 0.12,
        },
        {
          spawnName: "mariposanoloopVolando",
          at: 1.5,
          count: 1,
          layer: "foreground",
          attachment: "strokeEnd",
          reveal: "strokeBorn",
          targetLongSide: 125,
          life: 1.9,
          offset: { x: -18, y: -22 },
          drift: { x: -86, y: -8 },
          rotationJitter: 0.12,
          frameOffset: 0.12,
        },
      ],
    },
  },
  {
    key: "mariposanoloop-cluster",
    match: "mariposanoloop",
    notes: "Butterflies use the static mariposanoloop PNG plus the restored frame strip under a separate bounce-loop animated spawn name.",
    creatures: {
      mariposanoloop: [
        {
          at: 0.35,
          count: 1,
          layer: "overInk",
          attachment: "recentStroke",
          reveal: "strokeBorn",
          // 300 (was 150): same static-impression rescale as the mariposa cluster.
          targetLongSide: 300,
          life: 2.2,
          offset: { x: -54, y: 8 },
          drift: { x: -64, y: 12 },
          rotationJitter: 0.14,
        },
        {
          spawnName: "mariposanoloopVolando",
          at: 0.45,
          count: 1,
          layer: "foreground",
          attachment: "recentStroke",
          reveal: "strokeBorn",
          targetLongSide: 132,
          life: 2.2,
          offset: { x: -26, y: -18 },
          drift: { x: -96, y: -10 },
          rotationJitter: 0.14,
          frameOffset: 0.08,
        },
      ],
    },
  },
  {
    key: "dandelion-small",
    match: "dandelion",
    timeRange: [0, 168],
    notes: "Pre-climax dandelion marks are small vertical seeds stuck to a hairline stroke.",
    creatures: {
      dandelion: [
        {
          at: 0.04,
          // 2 (was 3): fewer, bigger seeds read as individual dandelion seeds
          // instead of a cluster of specks.
          count: 2,
          stagger: 0.045,
          layer: "insideInk",
          attachment: "recentStroke",
          reveal: "strokeBorn",
          // 260 (was 48): the seed PNG is ~85% visible art — scaled up so a
          // single seed is actually legible.
          targetLongSide: 260,
          life: 1.5,
          scatter: { x: 96, y: 28 },
          drift: { x: -26, y: -6 },
          scaleJitter: 0.5,
          rotationJitter: 0.7,
        },
      ],
    },
  },
  {
    key: "dandelion-climax",
    match: "dandelion",
    timeRange: [168, 218],
    notes: "Dandelion climax reads as small dark contact marks scattered around the thick horizontal ink.",
    creatures: {
      dandelion: [
        {
          at: 0.04,
          count: 5,
          stagger: 0.06,
          layer: "overInk",
          attachment: "recentStroke",
          reveal: "strokeBorn",
          // 320 (was 76): same visible-art rescale as the pre-climax seeds.
          targetLongSide: 320,
          life: 2.3,
          scatter: { x: 150, y: 54 },
          drift: { x: -68, y: 0 },
          scaleJitter: 0.48,
          rotationJitter: 0.72,
        },
      ],
    },
  },
]

export function getEventDirective(name: string, t = Number.NaN): EventDirective | undefined {
  const contextual = EVENT_DIRECTIVES.find((directive) =>
    directive.match === name
    && directive.timeRange !== undefined
    && !Number.isNaN(t)
    && t >= directive.timeRange[0]
    && t <= directive.timeRange[1],
  )
  if (contextual) return contextual

  const generic = EVENT_DIRECTIVES.find((directive) =>
    directive.match === name && directive.timeRange === undefined,
  )
  if (generic) return generic

  return EVENT_DIRECTIVES.find((directive) => directive.key === name)
}
