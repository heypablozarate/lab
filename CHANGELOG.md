# Changelog

## Unreleased

### Added

- 2026-07-04 / Claude: Renamed the Galaxia de Intereses experiment to Synapsis (brand form "Synapsis by PabloZarate™"): route folder and public slug are now /synapsis, page metadata/JSON-LD/server context, HUD title, and the Lab manifest entry updated. No redirect from the old slug (it was live only hours).

- 2026-07-04 / Claude: Added Galaxia de Intereses (`/galaxia-de-intereses`), a navigable 3D constellation of saved topics, links, and ideas built with React Three Fiber on RAMS tokens in light mode. F1 ships the 500-node dummy benchmark dataset with a deterministic hash-based layout (relevance → center distance and node size, clusters → shared angular sectors, edge weight → post-hash proximity), single-InstancedMesh nodes, single-LineSegments edges, a ≤25-instance pooled DOM label budget, hover/selection with the brand accent reserved for the active node and direct neighbors, camera focus with a side panel (desktop) / bottom sheet (mobile), cluster filters, search, a dev/`?fps=1` FPS meter, and registration in the Lab manifest.

### Changed

- 2026-07-04 / Claude: Restyled the Synapsis HUD into an Apple-HIG-style sidebar: a full-height floating liquid-glass column on the left (RAMS `--glass-bg`/`--glass-line` plus `--glass-fallback-*` tokens via `backdrop-filter` over the WebGL canvas, rounded corners, outer margin, internal scroll), collapsing to a top-pinned glass bar at ≤720px. CSS-only change; the 3D scene and its render budget are untouched.

- 2026-06-30 / Codex: Added server-rendered explanatory copy to Soy tu aire and Shader Experiment 01 so crawlers and LLMs can read each experiment's subject, themes, and technology stack without executing canvas/WebGL code; made Shader Experiment 01's H1 visible, and rewrote the Lab home description plus Lab `llms.txt` opening as a single natural sentence without keyword stuffing.

- 2026-06-30 / Codex: Sharpened the Lab landing and Shader Experiment 01 metadata for non-brand search terms, adding design engineering, agent-ready interfaces, and creative coding language without changing visible content or shader behavior.
