# Changelog

## Unreleased

### Added

- 2026-07-14 / Claude: Added the Amélie (2004) experiment route at `/amelie`: server metadata, JSON-LD, and hidden server context read from the parent admin data (`getLabExperiment("amelie")`), with the interactive experience served as a full-viewport iframe of the static recreation bundle under the parent's `public/lab/amelie/`.

### Changed

- 2026-08-20 / Codex: Prepared Lab renderers to consume parent-managed public
  copy. Synapsis reads its visible labels and templates from `galaxy.json`,
  Shader Experiment reads its visible instruction and controls from `lab.json`,
  and the Lab `llms.txt` route reads its document labels and language from the
  same parent content. Spanish Lab works now mark their rendered main content
  with the CMS-managed language.

- 2026-08-19 / Codex: Connected Lab landing, experiments, visible wordmarks,
  accessible labels, social metadata, and JSON-LD to the parent CMS identity
  and content sources. Lab pages now reference the canonical `WebSite` and
  `Person` entities through shared builders, and Soy tu aire renders its linked
  attribution tokens from editable parent content.

- 2026-07-28 / Codex: Removed the redundant visible Synapsis search label; the control now uses the `Search` placeholder and retains an accessible name.
- 2026-07-28 / Codex: Let a vertical swipe on mobile Synapsis retract Safari's browser chrome while the constellation stays pinned; horizontal drags still navigate the field.
- 2026-07-28 / Codex: Extended the Synapsis mobile field to the largest Safari viewport (`100lvh`), so the constellation remains continuous behind the bottom browser chrome instead of ending above it.

- 2026-07-28 / Codex: Made the Synapsis mobile stage follow Safari's dynamic viewport, so the constellation extends through the available screen as browser chrome expands or collapses. Selecting a node now opens a safe-area-aware full-screen reading surface that replaces the compact HUD, with focus moved to its close control. The visible search label is now the Spanish `Buscador` at every breakpoint.

- 2026-07-17 / Codex: Consolidated the Amélie 2004 working source under `amelie/source/` beside the experiment route, with project-relative build/upscale tooling; the parent's production static bundle remains unchanged.

- 2026-07-08 / Codex: Moved the Lab landing manifest, experiment metadata, and Soy tu aire credits/copy to the parent web content source so the private admin can edit them while the public Lab repo keeps only the route implementation and thin parent-content adapter.

- 2026-07-07 / Codex: Tuned the Synapsis resting node tone after visual QA so unfocused nodes sit back as quieter paper/ink points while hover/selected nodes keep the high-contrast monochrome focus state and dark-mode connector lines remain legible.

- 2026-07-07 / Codex: Refined the Synapsis graph look and feel toward the dsaints-style monochrome constellation: scene focus states now resolve to high-contrast paper/ink instead of the brand accent, dark-mode edge colors are mixed much brighter so connections remain visible, nodes render as smoother round points, labels switch to compact uppercase mono styling, and a subtle field grid/vignette overlays the canvas without changing interaction or data.

- 2026-07-07 / Claude: Soy tu aire experience pass. (1) Creatures now respect a 64px on-screen visibility floor at spawn (`ensureVisibleLongSide`): directed paper-space sizes shrink with the camera zoom, so the smallest marks (dandelion seeds, dry-scratch fish, hole beads) could all but disappear on wide shots; they are lifted to the floor while everything already readable keeps its choreographed size (portal takeover and stroke-embedded art keep their own sizing). (2) Images "drawn by the stroke" (chica, labios, Ogrande, and the cuelo/lagrima/surco/cosquilla word PNGs) now integrate with the trace instead of being struck through: the pen lifts while the image wipes in from the stroke tip, and when the hold ends the brush touches down again just inside the image's exit edge with a fresh centerline (`Brush.resumeFrom`), so no ribbon segment ever crosses the artwork. Figures with ink-smudge connection zones painted into their PNGs (chica, labios, Ogrande) are placed by those marks (`BRUSH_DRAW_ANCHORS` + `anchoredBrushDrawPlacement`): the trace feeds INTO the entry smudge and the resumed line grows back out of the exit smudge; words overlap the tip by `WORD_ENTRY_OVERLAP` and resume from just inside their trailing letter (`wordResumePoint`). A short post-resume guard (`RESUME_GUARD_*` in the engine) keeps the resumed line moving forward out of the artwork even when the pointer/idle target sits behind it, which was what previously dragged the line back across the words. Chica grew 190→340, labios 360→480 and now pins in place while being drawn, Ogrande 330→360; all three anchored pieces are fixed with zeroed offsets/drift. Verified in-browser at the 0:20 (chica), 0:42 (cosquillas), and 0:50 (cuelo) beats.

- 2026-07-07 / Claude: `targetLongSide` now scales each creature's VISIBLE art instead of its padded PNG canvas. At register time (`Creatures.register`/`registerFrames`) the alpha bounding box of the first frame is measured by rasterizing the texture into a small offscreen canvas and scanning alpha (`measureVisibleTextureBounds`, built on the pure/testable `scanVisibleAlphaBounds`), with a silent full-canvas fallback if anything is undrawable; frame sequences reuse the first frame's bounds. `spawn()`'s `baseScale` is now `targetLongSide / visibleLongSide` (portal takeover and stroke-embedded art are unaffected, per their own sizing paths), and the brushDraw/drawLeftToRight wipe mask, the circular reveal mask, and the 64px visibility floor now all operate on the visible box rather than the canvas. Chica/labios/Ogrande's directed sizes were rescaled to preserve their on-screen size under the new scaling (labios 480→300, Ogrande 360→280; chica's art already fills its canvas so 340 is unchanged). Several "field" PNGs whose individual elements had become unreadable were enlarged now that their real (much smaller) visible fraction is known: pajaros 310→650 (and count 4→2, since the flock PNG already draws ~35 birds), pezmancha 185→440, burbuja 96→340 (life 0.9→1.6), dandelion pre-climax 48→260 (count 3→2) and climax 76→320, recuerdo_b 60→400 (life 1.25→2.2), Salidaagujero 168/190→420 (climax spark at 86 untouched), Ondasagua 178→360, and the static mariposanoloop impression 135/150→300 in both its directives. `BRUSH_DRAW_ANCHORS` (and the placement/resume mechanism built for chica/labios/Ogrande) is extended to `hardCut` creatures: salpico and cera now carry entry/exit connection-zone anchors read off the PNGs, so the trace lands on their tip and resumes from their exit smudge instead of restarting from the blot's canvas centre (no wipe — hardCut still pops in at once). Cera's directive lost its manual `{x:0,y:132}` offset (the anchor now positions it) and its target dropped 560→520 to match its visible blob+drip box; salpico's target (720) was left as-is since its art already fills ~98% of its canvas. `uno` is no longer a scattered insideInk mark: it is now a brushDraw'd stamped word (`layer: overInk`, `attachment: brushHead`, `fixed: true`, no scatter/drift/jitter, targetLongSide 130→300) with a `brushHold` so the pen pauses while it writes in and resumes from its visible right edge; the unanchored brushDraw resume path (`brushResumePoint`) was fixed to measure that edge off the visible bounds instead of the full padded canvas, which had been landing resumes well past the actual artwork.

### Added

- 2026-07-04 / Claude: Renamed the Galaxia de Intereses experiment to Synapsis (brand form "Synapsis by PabloZarate™"): route folder and public slug are now /synapsis, page metadata/JSON-LD/server context, HUD title, and the Lab manifest entry updated. No redirect from the old slug (it was live only hours).

- 2026-07-04 / Claude: Added Galaxia de Intereses (`/galaxia-de-intereses`), a navigable 3D constellation of saved topics, links, and ideas built with React Three Fiber on RAMS tokens in light mode. F1 ships the 500-node dummy benchmark dataset with a deterministic hash-based layout (relevance → center distance and node size, clusters → shared angular sectors, edge weight → post-hash proximity), single-InstancedMesh nodes, single-LineSegments edges, a ≤25-instance pooled DOM label budget, hover/selection with the brand accent reserved for the active node and direct neighbors, camera focus with a side panel (desktop) / bottom sheet (mobile), cluster filters, search, a dev/`?fps=1` FPS meter, and registration in the Lab manifest.

### Changed

- 2026-07-04 / Claude: Unified Synapsis around one coherent glass system and made it themeable. The sidebar and the detail panel/bottom sheet now share the canonical RAMS liquid-glass engine (`GlassHeaderLayer`: live `backdrop-filter` + additive shimmer shader over the constellation, admin `--glass-*` tokens, iOS/no-WebGL fallback to pure `backdrop-filter`), so the aside no longer reads as detached. UI type sizes were raised to a ~13px legibility floor, and a light/dark toggle at the foot of the sidebar shares the Lab home theme contract (`lab-theme` key + `lab-theme-change` event, system-following default) with the Lab home dark palette scoped to the stage; the 3D scene re-resolves its RAMS tokens per theme and eases node/edge colors to the new mode.

- 2026-07-04 / Codex: Pointed Synapsis at the parent `webpz` content source of truth, `src/content/data/synapsis/galaxy.json`, seeded from the F1 benchmark data with an `inbox` cluster for unclassified future imports. The local dummy dataset remains only as a reproducible benchmark/reference.

- 2026-07-04 / Claude: Restyled the Synapsis HUD into an Apple-HIG-style sidebar: a full-height floating liquid-glass column on the left (RAMS `--glass-bg`/`--glass-line` plus `--glass-fallback-*` tokens via `backdrop-filter` over the WebGL canvas, rounded corners, outer margin, internal scroll), collapsing to a top-pinned glass bar at ≤720px. CSS-only change; the 3D scene and its render budget are untouched.

- 2026-06-30 / Codex: Added server-rendered explanatory copy to Soy tu aire and Shader Experiment 01 so crawlers and LLMs can read each experiment's subject, themes, and technology stack without executing canvas/WebGL code; made Shader Experiment 01's H1 visible, and rewrote the Lab home description plus Lab `llms.txt` opening as a single natural sentence without keyword stuffing.

- 2026-06-30 / Codex: Sharpened the Lab landing and Shader Experiment 01 metadata for non-brand search terms, adding design engineering, agent-ready interfaces, and creative coding language without changing visible content or shader behavior.
