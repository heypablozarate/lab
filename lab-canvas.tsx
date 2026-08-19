"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import styles from "./lab.module.css";
import { Minimap } from "./minimap";
import { IntroCard, ProjectCard } from "./panel";
import { projects } from "./projects";
import { Wordmark } from "./wordmark";

// Cards float on a fixed design canvas and a JS camera pans along Y (vertical
// scroll — natural on touch and responsive). The canvas is NOT a single fixed
// size: its aspect ratio interpolates fluidly with the viewport width, from a
// landscape 5:3 frame on wide screens to a tall phone-native portrait frame, so
// a phone held upright fills the screen instead of showing a tiny landscape card
// floating between two empty bands. Card content is authored relative to the
// card via CSS container units, so the typography reflows as the card reshapes.
const LANDSCAPE = { w: 1200, h: 720 }; // 5:3 — wide screens
const PORTRAIT = { w: 780, h: 1280 }; // tall portrait — phones held upright
const NARROW = 480; // viewport width at/below which the canvas is full portrait
const WIDE = 1024; // viewport width at/above which the canvas is full landscape
const GAP = 40; // world gap between stacked cards
const COUNT = projects.length + 1; // intro + projects

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const LAB_THEME_STORAGE_KEY = "lab-theme";
const LAB_THEME_CHANGE_EVENT = "lab-theme-change";
type LabTheme = "light" | "dark" | null;

function getSystemDarkSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(COLOR_SCHEME_QUERY).matches;
}

function subscribeSystemDark(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const mq = window.matchMedia(COLOR_SCHEME_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function normalizeTheme(value: string | null): LabTheme {
  return value === "light" || value === "dark" ? value : null;
}

function getStoredThemeSnapshot() {
  if (typeof window === "undefined") return null;
  return normalizeTheme(localStorage.getItem(LAB_THEME_STORAGE_KEY));
}

function subscribeStoredTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === LAB_THEME_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LAB_THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LAB_THEME_CHANGE_EVENT, onStoreChange);
  };
}

// Card geometry for a given viewport width. `t` runs 0 (portrait) → 1
// (landscape); the aspect ratio and a reference height are interpolated so the
// canvas morphs smoothly rather than snapping at a breakpoint.
function cardSize(vw: number) {
  const t = clamp01((vw - NARROW) / (WIDE - NARROW));
  const arP = PORTRAIT.w / PORTRAIT.h;
  const arL = LANDSCAPE.w / LANDSCAPE.h;
  const ar = arP + (arL - arP) * t;
  const h = PORTRAIT.h + (LANDSCAPE.h - PORTRAIT.h) * t;
  return { w: Math.round(h * ar), h: Math.round(h) };
}

export function LabCanvas({
  brandName,
  canonicalHomeUrl,
  creditLabel,
}: {
  brandName: string;
  canonicalHomeUrl: string;
  creditLabel: string;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Theme: null follows the system; "light"/"dark" is an explicit user choice
  // (persisted). The page reads it via the data-theme attribute.
  const theme = useSyncExternalStore(
    subscribeStoredTheme,
    getStoredThemeSnapshot,
    () => null,
  );
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDarkSnapshot,
    () => false,
  );

  const effectiveTheme = theme ?? (systemDark ? "dark" : "light");
  const markInteracted = useCallback(() => {
    pageRef.current?.setAttribute("data-interacted", "true");
  }, []);
  const toggleTheme = () => {
    markInteracted();
    const next = effectiveTheme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(LAB_THEME_STORAGE_KEY, next);
      window.dispatchEvent(new Event(LAB_THEME_CHANGE_EVENT));
    } catch {
      // storage unavailable
    }
  };

  const labels = ["Intro", ...projects.map((p) => p.title)];
  // Mutable engine state lives in a ref so the rAF loop reads/writes without
  // re-rendering. Geometry (card size + camera bounds) also lives here so the
  // loop and pointer/wheel handlers stay independent of React renders.
  const eng = useRef({
    cardW: LANDSCAPE.w,
    cardH: LANDSCAPE.h,
    step: LANDSCAPE.h + GAP,
    camMin: LANDSCAPE.h / 2,
    camMax: (COUNT - 1) * (LANDSCAPE.h + GAP) + LANDSCAPE.h / 2,
    cam: LANDSCAPE.h / 2,
    target: LANDSCAPE.h / 2,
    vel: 0, // world px per frame (inertia, along Y)
    scale: 1,
    scaleBase: 1,
    vw: 1,
    vh: 1,
    reduce: false,
    down: false,
    dragging: false,
    justDragged: false,
    pointerId: -1,
    startPos: 0,
    startTarget: 0,
    moved: 0,
    lastPos: 0,
    lastT: 0,
    pvel: 0, // pointer velocity (screen px/ms)
  });

  const measure = useCallback(() => {
    const e = eng.current;
    e.vw = window.innerWidth;
    e.vh = window.innerHeight;

    // Index currently centred, computed against the OLD geometry so we can keep
    // the same card framed across an aspect change.
    const idx = e.step ? Math.round((e.target - e.camMin) / e.step) : 0;

    const { w, h } = cardSize(e.vw);
    const changed = w !== e.cardW || h !== e.cardH;
    e.cardW = w;
    e.cardH = h;
    e.step = h + GAP;
    e.camMin = h / 2;
    e.camMax = (COUNT - 1) * e.step + e.camMin;

    // Fit the card (plus a small margin) to the viewport.
    const fit = Math.min(e.vw / (w * 1.12), e.vh / (h * 1.2));
    e.scaleBase = Math.max(0.18, Math.min(fit, 1));

    pageRef.current?.style.setProperty("--card-w", `${w}px`);
    pageRef.current?.style.setProperty("--card-h", `${h}px`);

    // Publish the resting fit scale to CSS so in-card secondary text can floor
    // its on-screen size (the stage is transform-scaled by this, so cqw text
    // would otherwise render at ~7px on phones). Set imperatively — it affects
    // type size, not layout, so it doesn't need to drive a React render.
    stageRef.current?.style.setProperty("--fit", String(e.scaleBase));

    if (changed) {
      // Re-centre the framed card on the new bounds. Only a width change
      // reshapes the canvas; a vertical-only resize (e.g. a mobile URL bar
      // showing/hiding) leaves the camera untouched, just the zoom.
      const clampedIdx = Math.max(0, Math.min(COUNT - 1, idx));
      e.target = e.camMin + clampedIdx * e.step;
      e.cam = e.target;
      e.vel = 0;
    } else {
      e.target = Math.max(e.camMin, Math.min(e.camMax, e.target));
    }

    const tx = e.vw / 2 - (e.cardW / 2) * e.scaleBase;
    const ty = e.vh / 2 - e.cam * e.scaleBase;
    stageRef.current?.style.setProperty(
      "transform",
      `translate(${tx}px, ${ty}px) scale(${e.scaleBase})`,
    );
    pageRef.current?.setAttribute("data-camera-ready", "true");
  }, []);

  const clampTarget = useCallback((v: number) => {
    const e = eng.current;
    return Math.max(e.camMin, Math.min(e.camMax, v));
  }, []);

  // Move the camera to a card (keyboard / minimap / focus).
  const goTo = useCallback((i: number) => {
    markInteracted();
    const idx = Math.max(0, Math.min(COUNT - 1, i));
    const e = eng.current;
    e.target = e.camMin + idx * e.step;
    e.vel = 0;
  }, [markInteracted]);

  // ── camera loop ──
  useEffect(() => {
    const e = eng.current;
    let raf = 0;
    let started = false;

    const tick = () => {
      const stage = stageRef.current;

      // inertia (only when not actively dragging)
      if (!e.down) {
        e.target = clampTarget(e.target + e.vel);
        e.vel *= 0.92;
        if (Math.abs(e.vel) < 0.02) e.vel = 0;
      }
      if (e.target <= e.camMin || e.target >= e.camMax) e.vel = 0;

      // ease the camera toward its target
      if (e.reduce) {
        e.cam = e.target;
      } else {
        e.cam += (e.target - e.cam) * 0.18;
        if (Math.abs(e.target - e.cam) < 0.05) e.cam = e.target;
      }

      // velocity-driven zoom out, springing back to the fit scale
      const speed = Math.abs(e.target - e.cam) + Math.abs(e.vel);
      const scaleTarget = e.reduce
        ? e.scaleBase
        : Math.max(e.scaleBase * 0.78, e.scaleBase - speed * 0.0006);
      e.scale += (scaleTarget - e.scale) * 0.08;

      if (stage) {
        // horizontal stays centred; vertical follows the camera
        const tx = e.vw / 2 - (e.cardW / 2) * e.scale;
        const ty = e.vh / 2 - e.cam * e.scale;
        stage.style.transform = `translate(${tx}px, ${ty}px) scale(${e.scale})`;
      }

      const idx = e.step
        ? Math.max(
            0,
            Math.min(COUNT - 1, Math.round((e.cam - e.camMin) / e.step)),
          )
        : 0;
      setActive((prev) => (prev === idx ? prev : idx));

      raf = requestAnimationFrame(tick);
    };

    const onResize = () => measure();
    const startCamera = () => {
      if (started) return;
      started = true;
      measure();
      e.reduce = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      e.scale = e.scaleBase;
      raf = requestAnimationFrame(tick);
      window.addEventListener("resize", onResize);
    };

    const waitsForInput = window.matchMedia("(max-width: 480px)").matches;
    if (waitsForInput) {
      window.addEventListener("pointerdown", startCamera, {
        capture: true,
        once: true,
        passive: true,
      });
      window.addEventListener("wheel", startCamera, {
        capture: true,
        once: true,
        passive: true,
      });
      window.addEventListener("keydown", startCamera, {
        capture: true,
        once: true,
      });
    } else {
      startCamera();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", startCamera, true);
      window.removeEventListener("wheel", startCamera, true);
      window.removeEventListener("keydown", startCamera, true);
    };
  }, [measure, clampTarget]);

  // ── wheel → vertical pan (both axes accepted; deltaY is the natural one) ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const e = eng.current;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      markInteracted();
      const delta =
        Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
      e.target = clampTarget(e.target + delta / e.scale);
      e.vel = 0; // wheel overrides any residual inertia
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [clampTarget, markInteracted]);

  // ── drag to pan vertically (deferred capture so plain clicks open links) ──
  const DRAG_THRESHOLD = 6;

  const updateGuide = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse") return;

    const rect = ev.currentTarget.getBoundingClientRect();
    ev.currentTarget.style.setProperty("--guide-x", `${ev.clientX - rect.left}px`);
    ev.currentTarget.style.setProperty("--guide-y", `${ev.clientY - rect.top}px`);
  };

  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    markInteracted();
    updateGuide(ev);
    const e = eng.current;
    e.down = true;
    e.dragging = false;
    e.justDragged = false;
    e.pointerId = ev.pointerId;
    e.startPos = ev.clientY;
    e.startTarget = e.target;
    e.moved = 0;
    e.lastPos = ev.clientY;
    e.lastT = performance.now();
    e.pvel = 0;
  };

  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    updateGuide(ev);

    const e = eng.current;
    if (!e.down) return;
    const dy = ev.clientY - e.startPos;
    e.moved = Math.max(e.moved, Math.abs(dy));

    if (!e.dragging) {
      if (e.moved <= DRAG_THRESHOLD) return;
      e.dragging = true;
      const vp = viewportRef.current;
      vp?.setAttribute("data-dragging", "true");
      try {
        vp?.setPointerCapture(e.pointerId);
      } catch {
        // capture unavailable
      }
    }

    e.target = clampTarget(e.startTarget - dy / e.scale);
    const now = performance.now();
    const dt = now - e.lastT;
    if (dt > 0) {
      const inst = -(ev.clientY - e.lastPos) / dt; // screen px/ms
      e.pvel = e.pvel * 0.6 + inst * 0.4;
      e.lastPos = ev.clientY;
      e.lastT = now;
    }
  };

  const endDrag = (ev: PointerEvent<HTMLDivElement>) => {
    const e = eng.current;
    if (!e.down) return;
    const wasDragging = e.dragging;
    e.down = false;
    e.dragging = false;
    if (!wasDragging) return; // a plain click — let the card link handle it

    e.justDragged = true;
    const vp = viewportRef.current;
    vp?.removeAttribute("data-dragging");
    try {
      vp?.releasePointerCapture(ev.pointerId);
    } catch {
      // already released
    }
    // throw: pointer velocity (screen px/ms) → camera inertia (world px/frame)
    e.vel = (e.pvel * 16) / e.scale;
  };

  // suppress the click that follows a real drag so cards don't navigate mid-pan
  const onClickCapture = (ev: MouseEvent<HTMLDivElement>) => {
    if (eng.current.justDragged) {
      ev.preventDefault();
      ev.stopPropagation();
      eng.current.justDragged = false;
    }
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    let target = active;
    if (ev.key === "ArrowDown" || ev.key === "ArrowRight") target = active + 1;
    else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") target = active - 1;
    else if (ev.key === "Home") target = 0;
    else if (ev.key === "End") target = COUNT - 1;
    else return;
    ev.preventDefault();
    goTo(target);
  };

  return (
    <main
      ref={pageRef}
      className={styles.page}
      aria-labelledby="lab-title"
      data-theme={theme ?? undefined}
    >
      <Minimap total={COUNT} active={active} labels={labels} onJump={goTo} />
      <p id="lab-canvas-instructions" className={styles.srOnly}>
        Browse Lab panels with the arrow keys, Home and End, mouse wheel, touch
        drag, or the Lab panels navigation buttons.
      </p>
      <p className={styles.srOnly} aria-live="polite">
        Current Lab panel: {labels[active] ?? "Intro"}.
      </p>

      <div
        ref={viewportRef}
        className={styles.viewport}
        role="region"
        aria-label="Lab projects — drag or scroll to browse"
        aria-describedby="lab-canvas-instructions"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        <div ref={stageRef} className={styles.stage}>
          <IntroCard brandName={brandName} top={0} onFocusCard={() => goTo(0)} />
          {projects.map((project, i) => (
            <ProjectCard
              key={project.slug}
              project={project}
              number={i + 1}
              top={`calc(${Array.from(
                { length: i + 1 },
                () => "var(--card-h)",
              ).join(" + ")} + ${(i + 1) * GAP}px)`}
              onFocusCard={() => goTo(i + 1)}
            />
          ))}
        </div>

        <div className={styles.overlay} aria-hidden="true">
          <div className={styles.guideH} />
          <div className={styles.guideV} />
          <div className={styles.crosshair} />
        </div>
        <div className={`${styles.fade} ${styles.fadeTop}`} aria-hidden="true" />
        <div
          className={`${styles.fade} ${styles.fadeBottom}`}
          aria-hidden="true"
        />
      </div>

      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label={`Switch to ${
          effectiveTheme === "dark" ? "light" : "dark"
        } mode`}
      >
        {effectiveTheme === "dark" ? (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
              fill="currentColor"
            />
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
      </button>

      <a
        className={styles.credit}
        href={canonicalHomeUrl}
        aria-label={`${creditLabel} — ${new URL(canonicalHomeUrl).hostname}`}
      >
        <Wordmark brandName={brandName} />
      </a>
    </main>
  );
}
