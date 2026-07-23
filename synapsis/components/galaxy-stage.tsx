"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { DARK_LIQUID_GLASS, LIGHT_LIQUID_GLASS, type LiquidGlassConfig } from "./liquid-glass";
import {
  createDefaultSynapsisAppearance,
  type SynapsisAppearanceByTheme,
} from "./synapsis-appearance";

import type { GalaxyData, GalaxyLayout } from "../layout-engine";
import type { LabelPool, SceneTokens } from "./galaxy-scene";
import styles from "../synapsis.module.css";

const GalaxyScene = dynamic(() => import("./galaxy-scene"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Cargando Synapsis…</p>,
});

// Dev-only Interface Craft panel. Loaded only when `?dialkit=1` is present
// outside production, so the dialkit bundle never reaches the public surface.
const SynapsisDials = dynamic(() => import("./synapsis-dials"), { ssr: false });

const LABEL_POOL_SIZE = 25;
const MAX_SEARCH_RESULTS = 6;

type StageProps = {
  data: GalaxyData;
  layout: GalaxyLayout;
};

// Theme store: identical contract to the Lab home (lab-canvas.tsx) — same
// storage key and change event, so the preference travels across Lab pages.
// null = follow the system; "light"/"dark" = explicit user choice.
const LAB_THEME_STORAGE_KEY = "lab-theme";
const LAB_THEME_CHANGE_EVENT = "lab-theme-change";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
type LabTheme = "light" | "dark" | null;

function normalizeTheme(value: string | null): LabTheme {
  return value === "light" || value === "dark" ? value : null;
}

const storedThemeSnapshot = () => normalizeTheme(localStorage.getItem(LAB_THEME_STORAGE_KEY));

const subscribeStoredTheme = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAB_THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LAB_THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LAB_THEME_CHANGE_EVENT, onChange);
  };
};

const systemDarkSnapshot = () => window.matchMedia(COLOR_SCHEME_QUERY).matches;
const subscribeSystemDark = (onChange: () => void) => {
  const media = window.matchMedia(COLOR_SCHEME_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

// Per-theme scene tokens, resolved once from a detached probe carrying the
// same CSS-module overrides the stage uses, then cached (stable references
// for useSyncExternalStore snapshots).
const tokenCache: Partial<Record<"light" | "dark", SceneTokens>> = {};

function readThemeTokens(theme: "light" | "dark"): SceneTokens {
  const cached = tokenCache[theme];
  if (cached) return cached;
  const probe = document.createElement("div");
  probe.className = styles.tokenProbe;
  probe.dataset.theme = theme;
  document.body.appendChild(probe);
  const css = getComputedStyle(probe);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const tokens: SceneTokens = {
    surfaceRaised: token("--surface-raised"),
    ink: token("--ink"),
    accent: token("--brand-accent"),
    paper: token("--paper"),
  };
  probe.remove();
  tokenCache[theme] = tokens;
  return tokens;
}

const lightTokensSnapshot = () => readThemeTokens("light");
const darkTokensSnapshot = () => readThemeTokens("dark");

// Client-only environment reads, exposed through useSyncExternalStore (same
// pattern as the Lab canvas) so hydration renders the server snapshot first.
const subscribeNever = () => () => {};

const dprSnapshot = () => {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
};

// Explicit opt-in locally; hard-off in production.
const showFpsSnapshot = () =>
  process.env.NODE_ENV !== "production" && window.location.search.includes("fps=1");

// Explicit opt-in (never auto-on in dev) and hard-off in production.
const showDialsSnapshot = () =>
  process.env.NODE_ENV !== "production" && window.location.search.includes("dialkit=1");

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const reducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

export function GalaxyStage({ data, layout }: StageProps) {
  const { nodes, edges, clusters } = data;
  const stageTitle = data.metadata?.title ?? "Synapsis";

  const storedTheme = useSyncExternalStore(subscribeStoredTheme, storedThemeSnapshot, () => null);
  const systemDark = useSyncExternalStore(subscribeSystemDark, systemDarkSnapshot, () => false);
  const effectiveTheme = storedTheme ?? (systemDark ? "dark" : "light");
  const lightTokens = useSyncExternalStore(subscribeNever, lightTokensSnapshot, () => null);
  const darkTokens = useSyncExternalStore(subscribeNever, darkTokensSnapshot, () => null);
  const tokens = effectiveTheme === "dark" ? darkTokens : lightTokens;
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const dpr = useSyncExternalStore(subscribeNever, dprSnapshot, () => 1);
  const showFps = useSyncExternalStore(subscribeNever, showFpsSnapshot, () => false);
  const showDials = useSyncExternalStore(subscribeNever, showDialsSnapshot, () => false);
  const [glassConfig, setGlassConfig] = useState<LiquidGlassConfig | null>(null);
  const [appearanceConfig, setAppearanceConfig] = useState<SynapsisAppearanceByTheme | null>(null);
  // Per-theme tuned glass; the dev dialkit overrides both while tuning.
  const themeGlass = effectiveTheme === "dark" ? DARK_LIQUID_GLASS : LIGHT_LIQUID_GLASS;
  const glass = glassConfig ?? themeGlass;
  const defaultAppearance = useMemo<SynapsisAppearanceByTheme | null>(() => {
    if (!lightTokens || !darkTokens) return null;
    return {
      light: createDefaultSynapsisAppearance(lightTokens, "light"),
      dark: createDefaultSynapsisAppearance(darkTokens, "dark"),
    };
  }, [lightTokens, darkTokens]);
  const appearance = appearanceConfig?.[effectiveTheme] ?? defaultAppearance?.[effectiveTheme] ?? null;
  // Live DOM refs of the glass panels (sidebar, detail panel), read every frame
  // by the WebGL GlassPass to place the refraction under them.
  const panelEls = useRef<(HTMLElement | null)[]>([null, null]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeClusters, setActiveClusters] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const labelPool = useRef<LabelPool>({ container: null, slots: [], assignments: [] });
  const fpsRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Adjacency: node index → connected edges, for the detail panel and the
  // accent treatment of direct neighbors.
  const adjacency = useMemo(() => {
    const map = new Map<number, { edge: number; other: number }[]>();
    edges.forEach((edge, e) => {
      const a = layout.indexById[edge.source];
      const b = layout.indexById[edge.target];
      if (a === undefined || b === undefined) return;
      if (!map.has(a)) map.set(a, []);
      if (!map.has(b)) map.set(b, []);
      map.get(a)!.push({ edge: e, other: b });
      map.get(b)!.push({ edge: e, other: a });
    });
    return map;
  }, [edges, layout.indexById]);

  const neighbors = useMemo(() => {
    if (selected === null) return new Set<number>();
    return new Set((adjacency.get(selected) ?? []).map((c) => c.other));
  }, [selected, adjacency]);

  const normalizedQuery = query.trim().toLowerCase();

  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    const matches: number[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (
        node.title.toLowerCase().includes(normalizedQuery) ||
        node.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      ) {
        matches.push(i);
      }
    }
    return matches;
  }, [nodes, normalizedQuery]);

  // Filter dim mask: cluster chips and search both reduce the visible set.
  const dimMask = useMemo(() => {
    const mask = new Uint8Array(nodes.length);
    const filterByCluster = activeClusters.size > 0;
    const matchSet = normalizedQuery ? new Set(searchMatches) : null;
    for (let i = 0; i < nodes.length; i += 1) {
      const outsideClusters = filterByCluster && !activeClusters.has(nodes[i].cluster);
      const outsideSearch = matchSet !== null && !matchSet.has(i);
      mask[i] = outsideClusters || outsideSearch ? 1 : 0;
    }
    return mask;
  }, [nodes, activeClusters, normalizedQuery, searchMatches]);

  const nodeTitles = useMemo(() => nodes.map((node) => node.title), [nodes]);

  const selectedNode = selected !== null ? nodes[selected] : null;
  const selectedConnections = useMemo(() => {
    if (selected === null) return [];
    return (adjacency.get(selected) ?? []).map(({ edge, other }) => ({
      edge: edges[edge],
      otherTitle: nodes[other].title,
      otherIndex: other,
    }));
  }, [selected, adjacency, edges, nodes]);

  const clusterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of nodes) counts.set(node.cluster, (counts.get(node.cluster) ?? 0) + 1);
    return counts;
  }, [nodes]);

  const clusterLabel = (id: string) => clusters.find((c) => c.id === id)?.label ?? id;

  function toggleCluster(id: string) {
    setActiveClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function focusSearchResult(index: number) {
    setSelected(index);
  }

  function toggleTheme() {
    const next = effectiveTheme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(LAB_THEME_STORAGE_KEY, next);
      window.dispatchEvent(new Event(LAB_THEME_CHANGE_EVENT));
    } catch {
      // storage unavailable
    }
  }

  return (
    <div
      className={styles.stage}
      data-theme={effectiveTheme}
      data-hovering={hovered !== null ? "true" : "false"}
    >
      <div className={styles.canvasHost}>
        {tokens && appearance && (
          <GalaxyScene
            positions={layout.positions}
            radii={layout.radii}
            edgeIndices={layout.edgeIndices}
            tokens={tokens}
            hovered={hovered}
            selected={selected}
            neighbors={neighbors}
            dimMask={dimMask}
            nodeTitles={nodeTitles}
            labelPool={labelPool}
            fpsRef={fpsRef}
            reducedMotion={reducedMotion}
            dpr={dpr}
            glass={glass}
            appearance={appearance}
            panelEls={panelEls}
            onHover={setHovered}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Pooled typographic labels over the canvas — max 25 spans, reused. */}
      <div
        className={styles.labels}
        aria-hidden="true"
        ref={(el) => {
          labelPool.current.container = el;
        }}
      >
        {Array.from({ length: LABEL_POOL_SIZE }, (_, s) => (
          <span
            key={s}
            className={styles.label}
            ref={(el) => {
              if (el) labelPool.current.slots[s] = el;
            }}
          />
        ))}
      </div>

      <header
        className={styles.hud}
        ref={(el) => {
          panelEls.current[0] = el;
        }}
        style={{ "--lg-radius": `${glass.radius}px` } as React.CSSProperties}
      >
        <div className={styles.hudContent}>
          <Link className={styles.backLink} href="/">
            Back to the Lab
          </Link>
          <p className={styles.hudTitle}>{stageTitle}</p>
          <p className={styles.hudCount}>
            {nodes.length} nodos · {edges.length} conexiones · {clusters.length} clusters
          </p>

          <div className={styles.search}>
            <label className={styles.srOnly} htmlFor="synapsis-search">
              Buscar nodos
            </label>
            <input
              id="synapsis-search"
              className={styles.searchInput}
              type="search"
              placeholder="Buscar"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {normalizedQuery && (
              <ul className={styles.searchResults}>
                {searchMatches.slice(0, MAX_SEARCH_RESULTS).map((index) => (
                  <li key={nodes[index].title + index}>
                    <button type="button" onClick={() => focusSearchResult(index)}>
                      {nodes[index].title}
                    </button>
                  </li>
                ))}
                {searchMatches.length === 0 && <li className={styles.searchEmpty}>Sin resultados</li>}
              </ul>
            )}
          </div>

          <ul className={styles.clusterList}>
            {clusters.map((cluster) => (
              <li key={cluster.id}>
                <button
                  type="button"
                  className={styles.clusterChip}
                  data-active={activeClusters.size === 0 || activeClusters.has(cluster.id) ? "true" : "false"}
                  onClick={() => toggleCluster(cluster.id)}
                >
                  {cluster.label}
                  <span className={styles.clusterCount}>{clusterCounts.get(cluster.id) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.hudFooter}>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
            >
              {effectiveTheme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="currentColor" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
                  <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
                </svg>
              )}
              <span className={styles.themeToggleLabel}>{effectiveTheme === "dark" ? "Light" : "Dark"} mode</span>
            </button>
          </div>
        </div>
      </header>

      {showFps && (
        <p className={styles.fps}>
          <span ref={fpsRef}>— fps</span>
        </p>
      )}

      {showDials && defaultAppearance && (
        <SynapsisDials
          glassSeed={themeGlass}
          appearanceSeed={defaultAppearance}
          onGlassChange={setGlassConfig}
          onAppearanceChange={setAppearanceConfig}
        />
      )}

      {selectedNode && (
        <aside
          className={styles.panel}
          aria-label={`Detalle de ${selectedNode.title}`}
          ref={(el) => {
            panelEls.current[1] = el;
          }}
          style={{ "--lg-radius": `${glass.radius}px` } as React.CSSProperties}
        >
          <div className={styles.panelContent}>
            <button type="button" className={styles.panelClose} onClick={() => setSelected(null)}>
              Cerrar
            </button>
            <p className={styles.panelMeta}>
              {clusterLabel(selectedNode.cluster)} · {selectedNode.type} · relevancia {selectedNode.relevance}
            </p>
            <h2 className={styles.panelTitle}>{selectedNode.title}</h2>
            {selectedNode.description && <p className={styles.panelDescription}>{selectedNode.description}</p>}
            {selectedNode.tags.length > 0 && (
              <ul className={styles.panelTags}>
                {selectedNode.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}
            <a className={styles.panelLink} href={selectedNode.url} target="_blank" rel="noopener noreferrer">
              Abrir link ↗
            </a>
            {selectedConnections.length > 0 && (
              <section className={styles.panelConnections}>
                <h3>Conexiones</h3>
                <ul>
                  {selectedConnections.map(({ edge, otherTitle, otherIndex }) => (
                    <li key={`${edge.source}-${edge.target}`}>
                      <button type="button" onClick={() => setSelected(otherIndex)}>
                        {otherTitle}
                      </button>
                      {edge.rationale?.trim() ? <p>{edge.rationale}</p> : null}
                      <span className={styles.panelProvenance}>
                        {edge.provenance === "ai-approved" ? "propuesta por AI, aprobada" : "curada a mano"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
