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

// Newest first — the order here is the left-to-right order on the canvas
// (the Intro panel is always first, prepended by the canvas).
export const projects: LabProject[] = [
  {
    slug: "shader-experiment-01",
    title: "Shader Experiment",
    year: 2026,
    kind: "Shader / WebGL",
  },
  {
    slug: "rams-theme-preview",
    title: "RAMS Theme Preview",
    year: 2026,
    kind: "Design system",
    href: "https://pablozarate.com/rams/theme-preview",
  },
  {
    slug: "hit-try",
    title: "Hit_Try",
    year: 2026,
    kind: "Puzzle game",
    href: "https://hit-try.vercel.app/",
  },
];
