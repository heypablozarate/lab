"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { ArrowLeftIcon, ChevronUpIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import type { BrandWordmarkToken } from "@/content/types";
import { RamsButton, RamsWordmark } from "@/components/rams/primitives";
import type { NormalizedSynapsisInterfaceCopy } from "@/lib/synapsis/galaxy-data";
import { BackButton, ClearFilters, CloseButton, ClusterFilters, Connections, ExpandButton, NodeSummary, SearchField, SourceLink, ViewportControls } from "./exploration-ui";
import { trackLabProjectAction } from "@/lib/lab-analytics";

import { DARK_LIQUID_GLASS, LIGHT_LIQUID_GLASS, type LiquidGlassConfig } from "./liquid-glass";
import {
  createDefaultSynapsisAppearance,
  type SynapsisAppearanceByTheme,
} from "./synapsis-appearance";

import type {
  GalaxyData,
  GalaxyLayout,
  SynapsisInterfaceCopy,
} from "../layout-engine";
import type { LabelPool, SceneTokens } from "./galaxy-scene";
import styles from "../synapsis.module.css";

const SynapsisCopyContext = createContext<SynapsisInterfaceCopy | null>(null);

function GalaxyLoading() {
  const interfaceCopy = useContext(SynapsisCopyContext);
  return interfaceCopy ? <p className={styles.loading}>{interfaceCopy.loadingLabel}</p> : null;
}

const GalaxyScene = dynamic(() => import("./galaxy-scene"), {
  ssr: false,
  loading: () => <GalaxyLoading />,
});

// Dev-only Interface Craft panel. Loaded only when `?dialkit=1` is present
// outside production, so the dialkit bundle never reaches the public surface.
const SynapsisDials = dynamic(() => import("./synapsis-dials"), { ssr: false });

const LABEL_POOL_SIZE = 25;


type StageProps = {
  data: GalaxyData & { metadata: GalaxyData["metadata"] & { interfaceCopy: NormalizedSynapsisInterfaceCopy } };
  layout: GalaxyLayout;
  authorName: string;
  authorWordmark: BrandWordmarkToken;
  authorUrl: string;
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

const storedThemeSnapshot = () => {
  try { return normalizeTheme(localStorage.getItem(LAB_THEME_STORAGE_KEY)); } catch { return null; }
};

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
  probe.className = `${styles.tokenProbe} rams-theme-${theme}`;
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

const MOBILE_QUERY = "(max-width: 720px)";
const mobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const subscribeMobile = (onChange: () => void) => {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

export function GalaxyStage({ data, layout, authorName, authorUrl, authorWordmark }: StageProps) {
  const { nodes, edges, clusters } = data;
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const labHref = useSyncExternalStore(subscribeNever, () => window.location.pathname.startsWith("/lab/") ? "/lab" : "/", () => "/lab");
  const { interfaceCopy } = data.metadata;
  const stageTitle = data.metadata.title;

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
  // Shared panel bounds for label occlusion and scene refraction.
  const panelEls = useRef<(HTMLElement | null)[]>([null, null]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeClusters, setActiveClusters] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const labelPool = useRef<LabelPool>({ container: null, slots: [], assignments: [] });
  const fpsRef = useRef<HTMLSpanElement | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [cameraCommand, setCameraCommand] = useState<{ id: number; action: "zoom-in" | "zoom-out" | "reset" }>();
  const [mobileOcclusion, setMobileOcclusion] = useState(0);
  const mobileHeadingRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLButtonElement>(null);
  const suppressHandleClick = useRef(false);
  const [zoom, setZoom] = useState(100);
  const dragStart = useRef<number | null>(null);
  const sheet = navigationOpen ? "navigation" : selected !== null ? (detailExpanded ? "detail" : "preview") : "closed";
  const modal = mobile && (sheet === "navigation" || sheet === "detail");

  function restoreFocus() {
    requestAnimationFrame(() => {
      const target = returnFocus.current;
      if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true });
      else if (mobile) dockRef.current?.focus({ preventScroll: true });
      else document.getElementById("synapsis-search-desktop")?.focus({ preventScroll: true });
    });
  }

  function closeSelection() {
    setSelected(null);
    setHistory([]);
    setDetailExpanded(false);
    restoreFocus();
  }

  function closeNavigation() {
    setNavigationOpen(false);
    restoreFocus();
  }

  useLayoutEffect(() => {
    const content = sidebarContentRef.current;
    const panel = panelEls.current[0];
    if (mobile || !content || !panel) return;
    // Anchor against the collapsed content, so the footer only grows downward.
    const measure = () => {
      const css = getComputedStyle(panel);
      const height = content.getBoundingClientRect().height
        + parseFloat(css.paddingTop) + parseFloat(css.paddingBottom)
        + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
      panel.style.setProperty("--sx-sidebar-collapsed-height", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [mobile]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const measure = () => {
      const height = viewport?.height ?? window.innerHeight;
      stageRef.current?.style.setProperty("--viewport-height", `${height}px`);
      stageRef.current?.style.setProperty("--viewport-top", `${viewport?.offsetTop ?? 0}px`);
      const panelHeight = mobile ? sheetRef.current?.offsetHeight ?? 0 : 0;
      stageRef.current?.style.setProperty("--sheet-height", `${panelHeight}px`);
      const heading = mobileHeadingRef.current;
      const topInset = mobile && heading ? heading.offsetTop + heading.offsetHeight : 0;
      setMobileOcclusion(Math.max(0, Math.min(0.85, (panelHeight - topInset) / height)));
    };
    const observer = new ResizeObserver(measure);
    if (sheetRef.current) observer.observe(sheetRef.current);
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [mobile, sheet]);

  useEffect(() => {
    if (selected === null && !navigationOpen) return;
    const panel = mobile ? sheetRef.current : inspectorRef.current;
    const focus = requestAnimationFrame(() => panel?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(focus);
  }, [selected, navigationOpen, detailExpanded, mobile]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (navigationOpen) { setNavigationOpen(false); }
        else if (mobile && detailExpanded) { setDetailExpanded(false); return; }
        else { setSelected(null); setHistory([]); setDetailExpanded(false); }
        requestAnimationFrame(() => {
          const target = returnFocus.current;
          if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true });
          else if (mobile) dockRef.current?.focus();
          else document.getElementById("synapsis-search-desktop")?.focus();
        });
      }
      if (event.key === "Tab" && modal) {
        const panel = sheetRef.current;
        const controls = panel?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigationOpen, detailExpanded, mobile, modal]);

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

  const clusterFrame = useMemo(() => ({
    key: [...activeClusters].sort().join("|"),
    indices: nodes.flatMap((node, index) => activeClusters.has(node.cluster) ? [index] : []),
  }), [activeClusters, nodes]);

  const nodeTitles = useMemo(() => nodes.map((node) => node.title), [nodes]);
  const territoryEls = useRef<(HTMLSpanElement | null)[]>([]);
  const territories = useMemo(() => clusters.flatMap(cluster => {
    const members = nodes.map((node, index) => node.cluster === cluster.id ? index : -1).filter(index => index >= 0);
    if (!members.length) return [];
    const x = members.reduce((sum, index) => sum + layout.positions[index * 3], 0) / members.length;
    const y = Math.max(...members.map(index => layout.positions[index * 3 + 1])) + 2;
    return [{ label: cluster.label, position: [x, y, 0] as [number, number, number] }];
  }), [clusters, nodes, layout.positions]);

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
    setSelected(null);
    setHistory([]);
    setDetailExpanded(false);
    setActiveClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectNode(index: number | null, interaction: "graph" | "search" | "connection" = "graph") {
    if (index === null) { closeSelection(); return; }
    if (selected === null) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (interaction === "connection" && selected !== null && selected !== index) setHistory((previous) => [...previous, selected]);
    else if (interaction !== "connection") { setHistory([]); setDetailExpanded(false); }
    trackLabProjectAction("synapsis", "node_open", { interaction });
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    setNavigationOpen(false);
    setSelected(index);
  }

  function openNavigation() {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNavigationOpen(true);
  }

  function previousNode() {
    const previous = history.at(-1);
    if (previous === undefined) return;
    setSelected(previous);
    setHistory((entries) => entries.slice(0, -1));
  }

  function command(action: "zoom-in" | "zoom-out" | "reset") {
    setCameraCommand((previous) => ({ id: (previous?.id ?? 0) + 1, action }));
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

  const nextThemeLabel =
    effectiveTheme === "dark"
      ? interfaceCopy.lightModeLabel
      : interfaceCopy.darkModeLabel;

  const visibleClusters = clusters
    .filter((cluster) => (clusterCounts.get(cluster.id) ?? 0) > 0)
    .sort((a, b) => (clusterCounts.get(b.id) ?? 0) - (clusterCounts.get(a.id) ?? 0));
  const count = formatTemplate(interfaceCopy.countTemplate, { nodes: nodes.length, edges: edges.length, clusters: visibleClusters.length });
  const filters = <ClusterFilters clusters={visibleClusters} counts={clusterCounts} active={activeClusters} onToggle={toggleCluster} />;
  const clear = <ClearFilters copy={interfaceCopy} active={activeClusters.size > 0} onClear={() => setActiveClusters(new Set())} />;
  const search = (id: string) => <SearchField id={id} copy={interfaceCopy} query={query} onQuery={setQuery} results={searchMatches} nodes={nodes} onSelect={(index) => selectNode(index, "search")} />;
  const detail = (preview: boolean) => selectedNode && <>
    <NodeSummary node={selectedNode} cluster={clusterLabel(selectedNode.cluster)} copy={interfaceCopy} preview={preview} />
    <SourceLink node={selectedNode} copy={interfaceCopy} />
    {!preview && <Connections connections={selectedConnections} copy={interfaceCopy} onSelect={(index) => selectNode(index, "connection")} />}
  </>;

  return <SynapsisCopyContext.Provider value={interfaceCopy}>
    <div ref={stageRef} className={`${styles.stage} rams-theme-${effectiveTheme}`} data-theme={effectiveTheme} data-hovering={hovered !== null} data-sheet={mobile ? sheet : "closed"}>
      <div className={styles.canvasHost} inert={modal}>
        {tokens && appearance && <GalaxyScene positions={layout.positions} radii={layout.radii} edgeIndices={layout.edgeIndices}
          tokens={tokens} hovered={hovered} selected={selected} neighbors={neighbors} dimMask={dimMask} nodeTitles={nodeTitles}
          territories={territories} territoryEls={territoryEls} labelPool={labelPool} fpsRef={fpsRef} reducedMotion={reducedMotion} dpr={dpr} glass={glass} appearance={appearance}
          clusterFrame={clusterFrame} panelEls={panelEls} postprocessing onZoomChange={setZoom} cameraCommand={cameraCommand} mobileOcclusion={mobileOcclusion}
          onHover={setHovered} onSelect={(index) => selectNode(index)} />}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {territories.map((territory, index) => <span className={styles.territory} key={territory.label} ref={el => { territoryEls.current[index] = el; }}>{territory.label}</span>)}
      </div>
      <div className={styles.labels} aria-hidden="true" ref={(el) => { labelPool.current.container = el; }}>
        {Array.from({ length: LABEL_POOL_SIZE }, (_, index) => <span key={index} className={styles.label} ref={(el) => { if (el) labelPool.current.slots[index] = el; }} />)}
      </div>
      <div inert={modal}>
        <header className={styles.topbar}>
          <Link className={styles.backLink} href={labHref}><ArrowLeftIcon aria-hidden="true" />{interfaceCopy.backLabel}</Link>
          <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={formatTemplate(interfaceCopy.switchThemeAriaTemplate, { mode: nextThemeLabel.toLowerCase() })}>
            <span className={styles.desktopOnly}>{formatTemplate(interfaceCopy.themeLabelTemplate, { mode: nextThemeLabel })}</span>
            <span className={styles.mobileOnly}>{effectiveTheme === "dark" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}</span>
          </button>
        </header>
        <div ref={mobileHeadingRef} className={styles.mobileHeading}><p className={styles.title}>{stageTitle}</p><p className={styles.count}>{count}</p></div>
        {!mobile && <aside className={`${styles.desktopSidebar} ${styles.glassPanel}`} ref={(el) => { panelEls.current[0] = el; }} aria-label={interfaceCopy.navigationLabel} style={{ "--lg-radius": `${glass.radius}px` } as CSSProperties}>
          <div ref={sidebarContentRef} className={styles.sidebarContent}>
            <div><p className={styles.title}>{stageTitle}</p><p className={styles.count}>{count}</p></div>
            {search("synapsis-search-desktop")}
            <div className={styles.divider} />
            {filters}
          </div>
          <motion.div className={styles.sidebarClearReveal} initial={false}
            animate={{ height: activeClusters.size > 0 ? "auto" : 0, opacity: activeClusters.size > 0 ? 1 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className={styles.sidebarClearContent}>{clear}</div>
          </motion.div>
        </aside>}
        {mobile && activeClusters.size > 0 && sheet === "closed" && <div className={styles.activeFilters}><span>{clusters.filter((cluster) => activeClusters.has(cluster.id)).map((cluster) => cluster.label).join(" · ")}</span>{clear}</div>}
        <a className={styles.brand} href={authorUrl} rel="author" aria-label={authorName}><RamsWordmark variant="signature" wordmark={authorWordmark} /></a>
        <footer className={styles.viewportFooter}>
          <p className={styles.gesture}>{mobile ? interfaceCopy.mobileGestureLabel : interfaceCopy.gestureLabel}</p>
          <ViewportControls copy={interfaceCopy} zoom={zoom} onCommand={command} />
        </footer>
        {mobile && sheet === "closed" && <button ref={dockRef} type="button" className={`${styles.mobileDock} ${styles.glassPanel}`} onClick={openNavigation} aria-expanded="false" aria-controls="synapsis-sheet">
          <span className={styles.handleBar} aria-hidden="true" /><span>{interfaceCopy.navigationLabel}</span><ChevronUpIcon aria-hidden="true" />
        </button>}
      </div>
      {!mobile && selectedNode && <aside ref={(el) => { inspectorRef.current = el; panelEls.current[1] = el; }} className={`${styles.inspector} ${styles.glassPanel}`} tabIndex={-1} aria-label={formatTemplate(interfaceCopy.detailAriaTemplate, { title: selectedNode.title })}>
        <div className={styles.sheetHeader}>{history.length > 0 && <BackButton label={interfaceCopy.previousNodeLabel} onClick={previousNode} />}<CloseButton copy={interfaceCopy} onClose={closeSelection} /></div>
        <div className={styles.sheetBody}>{detail(false)}</div>
      </aside>}
      {modal && <div className={styles.scrim} aria-hidden="true" onClick={navigationOpen ? closeNavigation : () => setDetailExpanded(false)} />}
      <AnimatePresence initial={false}>
      {mobile && sheet !== "closed" && <motion.section layout key="synapsis-mobile-sheet" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.2, 0.8, 0.2, 1] }} id="synapsis-sheet" ref={sheetRef} className={`${styles.sheet} ${styles.glassPanel}`} data-kind={sheet} role={modal ? "dialog" : "region"} aria-modal={modal || undefined}
        aria-label={navigationOpen ? interfaceCopy.navigationLabel : formatTemplate(interfaceCopy.detailAriaTemplate, { title: selectedNode?.title ?? "" })} tabIndex={-1}>
        <button type="button" className={styles.handle} aria-label={navigationOpen ? interfaceCopy.viewMapLabel : detailExpanded ? interfaceCopy.backToMapLabel : interfaceCopy.expandDetailLabel}
          onClick={() => { if (suppressHandleClick.current) { suppressHandleClick.current = false; return; } if (navigationOpen) closeNavigation(); else setDetailExpanded((value) => !value); }}
          onPointerDown={(event) => { suppressHandleClick.current = false; dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerUp={(event) => {
            const delta = event.clientY - (dragStart.current ?? event.clientY);
            dragStart.current = null;
            if (Math.abs(delta) < 32) return;
            suppressHandleClick.current = true;
            event.preventDefault();
            if (delta < 0 && !navigationOpen) setDetailExpanded(true);
            else if (delta > 0) { if (navigationOpen) closeNavigation(); else if (detailExpanded) setDetailExpanded(false); else closeSelection(); }
          }} onPointerCancel={() => { dragStart.current = null; suppressHandleClick.current = false; }}><span className={styles.handleBar} /></button>
        <div className={styles.sheetHeader}>
          {navigationOpen ? <h2 className={styles.sheetTitle}>{interfaceCopy.navigationLabel}</h2> : detailExpanded ? <BackButton direction="down" label={interfaceCopy.backToMapLabel} onClick={() => setDetailExpanded(false)} /> : <span />}
          <CloseButton copy={interfaceCopy} onClose={navigationOpen ? closeNavigation : closeSelection} />
        </div>
        <div className={styles.sheetBody}>
          {navigationOpen ? <>{search("synapsis-search-mobile")}<div className={styles.sheetHeader}><span>{interfaceCopy.filtersHeading}</span>{clear}</div>{filters}</> : <>
            {history.length > 0 && <BackButton label={interfaceCopy.previousNodeLabel} onClick={previousNode} />}
            {detail(!detailExpanded)}
            {!detailExpanded && <ExpandButton copy={interfaceCopy} onClick={() => setDetailExpanded(true)} />}
          </>}
        </div>
        {navigationOpen && <div className={styles.sheetFooter}><RamsButton variant="secondary" onClick={closeNavigation}>{interfaceCopy.viewMapLabel}</RamsButton></div>}
      </motion.section>}
      </AnimatePresence>
      {showFps && <p className={styles.fps}><span ref={fpsRef}>— fps</span></p>}
      {showDials && defaultAppearance && <SynapsisDials glassSeed={themeGlass} appearanceSeed={defaultAppearance} onGlassChange={setGlassConfig} onAppearanceChange={setAppearanceConfig} />}
    </div>
  </SynapsisCopyContext.Provider>;
}

function formatTemplate(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}
