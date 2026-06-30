// Single source of truth for the Lab canvas index.
//
// Add an object here and a full-screen panel, a minimap line, and an index
// number appear automatically — no layout work. The `slug` must match the
// folder under `src/app/lab/<slug>` that holds the project page; it defines
// both the internal route `/lab/<slug>` and the public URL
// `https://lab.pablozarate.com/<slug>`.

export type LabProject = {
  /** Stable folder slug → `/lab/<slug>`. */
  slug: string;
  /** Display title shown huge on the panel. */
  title: string;
  /** Year used in the meta line. */
  year: number;
  /** Short descriptor, e.g. "Shader / WebGL". */
  kind: string;
  /** Search/agent-readable summary of the experiment. */
  description: string;
  /** Topic tags that describe the experiment for crawlers and LLMs. */
  tags: string[];
  /** Real content modification timestamp used by the Lab sitemap. */
  updatedAt?: string;
  /** Optional per-project accent; falls back to the brand accent. */
  accent?: string;
  /**
   * Optional destination URL. When set, the panel links here (opening in a new
   * tab with a ↗ "leaving Lab" indicator) instead of the internal `/lab/<slug>`
   * route. Use for projects that live outside the Lab submodule — e.g. the RAMS
   * theme preview on the main site, or an external game. Use an absolute URL so
   * it resolves from the `lab.pablozarate.com` host.
   */
  href?: string;
};

export const labHomeUpdatedAt = "2026-06-09T08:23:35-03:00";

// Newest first — the order here is the left-to-right order on the canvas
// (the Intro panel is always first, prepended by the canvas).
export const projects: LabProject[] = [
  {
    slug: "soy-tu-aire",
    title: "Soy tu aire",
    year: 2026,
    kind: "Audio-reactive / PixiJS",
    description:
      "A browser-native homage to Labuat's Soy tu aire: Web Audio buffers and analyzes the song while a PixiJS ink engine paints a choreographed, cursor-led visual performance in real time.",
    tags: ["PixiJS", "Web Audio", "audio reactive", "generative", "ink", "homage", "experience design"],
    updatedAt: "2026-06-30T00:00:00-03:00",
    accent: "#c0392b",
  },
  {
    slug: "shader-experiment-01",
    title: "Shader Experiment",
    year: 2026,
    kind: "Shader / WebGL",
    description:
      "Interactive WebGL wordmark study exploring typography, shader motion, interface craft, and technology-led digital experience design.",
    tags: ["WebGL", "shader", "typography", "digital experience", "interface design"],
    updatedAt: "2026-06-09T08:23:35-03:00",
  },
  {
    slug: "rams-theme-preview",
    title: "RAMS Theme Preview",
    year: 2026,
    kind: "Design system",
    description:
      "A non-traditional way to show what a design system can do: experiments, philosophy, and interface studies that turn RAMS into a working point of view.",
    tags: ["design system", "product design", "visual systems", "RAMS", "interface craft"],
    href: "https://pablozarate.com/rams/theme-preview",
  },
  {
    slug: "hit-try",
    title: "Hit_Try",
    year: 2026,
    kind: "Puzzle game",
    description:
      "Simple premise: crack the next number, keep going. Hidden clues are waiting to be decoded. Each level gets harder. A love letter to the weird internet puzzles of the early 2000s.",
    tags: ["one man army", "game prototype", "interaction design", "experimentation", "product craft"],
    href: "https://hit-try.vercel.app/",
  },
];
