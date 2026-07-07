# Changelog

## Unreleased

### Changed

- 2026-07-07 / Claude: Soy tu aire experience pass. (1) Creatures now respect a 64px on-screen visibility floor at spawn (`ensureVisibleLongSide`): directed paper-space sizes shrink with the camera zoom, so the smallest marks (dandelion seeds, dry-scratch fish, hole beads) could all but disappear on wide shots; they are lifted to the floor while everything already readable keeps its choreographed size (portal takeover and stroke-embedded art keep their own sizing). (2) Images "drawn by the stroke" (chica, labios, Ogrande, and the cuelo/lagrima/surco/cosquilla word PNGs) now integrate with the trace instead of being struck through: the pen lifts while the image wipes in from the stroke tip, and when the hold ends the brush touches down again just inside the image's exit edge with a fresh centerline (`Brush.resumeFrom`), so no ribbon segment ever crosses the artwork. Figures with ink-smudge connection zones painted into their PNGs (chica, labios, Ogrande) are placed by those marks (`BRUSH_DRAW_ANCHORS` + `anchoredBrushDrawPlacement`): the trace feeds INTO the entry smudge and the resumed line grows back out of the exit smudge; words overlap the tip by `WORD_ENTRY_OVERLAP` and resume from just inside their trailing letter (`wordResumePoint`). A short post-resume guard (`RESUME_GUARD_*` in the engine) keeps the resumed line moving forward out of the artwork even when the pointer/idle target sits behind it, which was what previously dragged the line back across the words. Chica grew 190→340, labios 360→480 and now pins in place while being drawn, Ogrande 330→360; all three anchored pieces are fixed with zeroed offsets/drift. Verified in-browser at the 0:20 (chica), 0:42 (cosquillas), and 0:50 (cuelo) beats.

### Added

- 2026-07-04 / Claude: Renamed the Galaxia de Intereses experiment to Synapsis (brand form "Synapsis by PabloZarate™"): route folder and public slug are now /synapsis, page metadata/JSON-LD/server context, HUD title, and the Lab manifest entry updated. No redirect from the old slug (it was live only hours).

- 2026-07-04 / Claude: Added Galaxia de Intereses (`/galaxia-de-intereses`), a navigable 3D constellation of saved topics, links, and ideas built with React Three Fiber on RAMS tokens in light mode. F1 ships the 500-node dummy benchmark dataset with a deterministic hash-based layout (relevance → center distance and node size, clusters → shared angular sectors, edge weight → post-hash proximity), single-InstancedMesh nodes, single-LineSegments edges, a ≤25-instance pooled DOM label budget, hover/selection with the brand accent reserved for the active node and direct neighbors, camera focus with a side panel (desktop) / bottom sheet (mobile), cluster filters, search, a dev/`?fps=1` FPS meter, and registration in the Lab manifest.

### Changed

- 2026-07-04 / Claude: Unified Synapsis around one coherent glass system and made it themeable. The sidebar and the detail panel/bottom sheet now share the canonical RAMS liquid-glass engine (`GlassHeaderLayer`: live `backdrop-filter` + additive shimmer shader over the constellation, admin `--glass-*` tokens, iOS/no-WebGL fallback to pure `backdrop-filter`), so the aside no longer reads as detached. UI type sizes were raised to a ~13px legibility floor, and a light/dark toggle at the foot of the sidebar shares the Lab home theme contract (`lab-theme` key + `lab-theme-change` event, system-following default) with the Lab home dark palette scoped to the stage; the 3D scene re-resolves its RAMS tokens per theme and eases node/edge colors to the new mode.

- 2026-07-04 / Codex: Pointed Synapsis at the parent `webpz` content source of truth, `src/content/data/synapsis/galaxy.json`, seeded from the F1 benchmark data with an `inbox` cluster for unclassified future imports. The local dummy dataset remains only as a reproducible benchmark/reference.

- 2026-07-04 / Claude: Restyled the Synapsis HUD into an Apple-HIG-style sidebar: a full-height floating liquid-glass column on the left (RAMS `--glass-bg`/`--glass-line` plus `--glass-fallback-*` tokens via `backdrop-filter` over the WebGL canvas, rounded corners, outer margin, internal scroll), collapsing to a top-pinned glass bar at ≤720px. CSS-only change; the 3D scene and its render budget are untouched.

- 2026-06-30 / Codex: Added server-rendered explanatory copy to Soy tu aire and Shader Experiment 01 so crawlers and LLMs can read each experiment's subject, themes, and technology stack without executing canvas/WebGL code; made Shader Experiment 01's H1 visible, and rewrote the Lab home description plus Lab `llms.txt` opening as a single natural sentence without keyword stuffing.

- 2026-06-30 / Codex: Sharpened the Lab landing and Shader Experiment 01 metadata for non-brand search terms, adding design engineering, agent-ready interfaces, and creative coding language without changing visible content or shader behavior.
