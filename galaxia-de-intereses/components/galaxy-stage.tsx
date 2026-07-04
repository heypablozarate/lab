"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { GalaxyData, GalaxyLayout } from "../layout-engine";
import type { LabelPool, SceneTokens } from "./galaxy-scene";
import styles from "../galaxia.module.css";

const GalaxyScene = dynamic(() => import("./galaxy-scene"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Cargando la galaxia…</p>,
});

const LABEL_POOL_SIZE = 25;
const ALWAYS_LABELED = 20;
const MAX_SEARCH_RESULTS = 6;

type StageProps = {
  data: GalaxyData;
  layout: GalaxyLayout;
};

function readTokens(): SceneTokens {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    surfaceRaised: token("--surface-raised"),
    ink: token("--ink"),
    muted: token("--muted"),
    line: token("--line"),
    accent: token("--brand-accent"),
  };
}

// Client-only environment reads, exposed through useSyncExternalStore (same
// pattern as the Lab canvas) so hydration renders the server snapshot first.
const subscribeNever = () => () => {};

let cachedTokens: SceneTokens | null = null;
const tokensSnapshot = () => {
  if (!cachedTokens) cachedTokens = readTokens();
  return cachedTokens;
};

const dprSnapshot = () => {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
};

const showFpsSnapshot = () =>
  process.env.NODE_ENV === "development" || window.location.search.includes("fps=1");

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const reducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

export function GalaxyStage({ data, layout }: StageProps) {
  const { nodes, edges, clusters } = data;

  const tokens = useSyncExternalStore(subscribeNever, tokensSnapshot, () => null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const dpr = useSyncExternalStore(subscribeNever, dprSnapshot, () => 1);
  const showFps = useSyncExternalStore(subscribeNever, showFpsSnapshot, () => false);
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

  // Fixed label budget: top nodes by relevance, plus hovered and selected.
  const topByRelevance = useMemo(() => {
    return nodes
      .map((node, i) => ({ i, relevance: node.relevance }))
      .sort((a, b) => b.relevance - a.relevance || a.i - b.i)
      .slice(0, ALWAYS_LABELED)
      .map((entry) => entry.i);
  }, [nodes]);

  const labelIndices = useMemo(() => {
    const list = [...topByRelevance];
    for (const extra of [selected, hovered]) {
      if (extra !== null && !list.includes(extra) && list.length < LABEL_POOL_SIZE) list.push(extra);
    }
    return list;
  }, [topByRelevance, selected, hovered]);

  const labelTexts = useMemo(() => labelIndices.map((i) => nodes[i].title), [labelIndices, nodes]);

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

  return (
    <div className={styles.stage} data-hovering={hovered !== null ? "true" : "false"}>
      <div className={styles.canvasHost}>
        {tokens && (
          <GalaxyScene
            positions={layout.positions}
            radii={layout.radii}
            edgeIndices={layout.edgeIndices}
            tokens={tokens}
            hovered={hovered}
            selected={selected}
            neighbors={neighbors}
            dimMask={dimMask}
            labelIndices={labelIndices}
            labelTexts={labelTexts}
            labelPool={labelPool}
            fpsRef={fpsRef}
            reducedMotion={reducedMotion}
            dpr={dpr}
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

      <header className={styles.hud}>
        <Link className={styles.backLink} href="/">
          Back to the Lab
        </Link>
        <p className={styles.hudTitle}>Galaxia de Intereses</p>
        <p className={styles.hudCount}>
          {nodes.length} nodos · {edges.length} conexiones · {clusters.length} clusters
        </p>

        <div className={styles.search}>
          <label className={styles.srOnly} htmlFor="galaxia-search">
            Buscar nodos
          </label>
          <input
            id="galaxia-search"
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
      </header>

      {showFps && (
        <p className={styles.fps}>
          <span ref={fpsRef}>— fps</span>
        </p>
      )}

      {selectedNode && (
        <aside className={styles.panel} aria-label={`Detalle de ${selectedNode.title}`}>
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
                    <p>{edge.rationale}</p>
                    <span className={styles.panelProvenance}>
                      {edge.provenance === "ai-approved" ? "propuesta por AI, aprobada" : "curada a mano"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}
    </div>
  );
}
