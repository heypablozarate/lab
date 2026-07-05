"use client";

/* Dev-only tuning panel for the Synapsis liquid glass. Gated behind `?dialkit=1`
   in galaxy-stage; DialRoot also self-disables in production, so this never
   reaches the public lab. Sliders map 1:1 to LiquidGlassConfig, pipe the tuned
   config straight into the panel refraction for live feedback over the real 3D
   scene, and "Copiar JSON" hands the final numbers back verbatim. */

import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { useEffect, useRef, useState } from "react";

import type { LiquidGlassConfig } from "./liquid-glass";

export default function LiquidGlassDials({
  seed,
  onChange,
}: {
  seed: LiquidGlassConfig;
  onChange: (config: LiquidGlassConfig) => void;
}) {
  // Seed the sliders from the active theme's shipped values (captured once, so a
  // theme toggle mid-session doesn't reset what you're tuning).
  const [d] = useState<LiquidGlassConfig>(seed);
  const latest = useRef<LiquidGlassConfig>(d);

  const values = useDialKit(
    "Synapsis Liquid Glass",
    {
      refraction: {
        depth: [d.depth, 0, 60, 1],
        radius: [d.radius, 0, 60, 1],
        rimWidth: [d.rimWidth, 0.02, 1, 0.01],
        chromaticAberration: [d.chromaticAberration, 0, 1, 0.01],
      },
      backdrop: {
        blur: [d.blur, 0, 20, 0.25],
        contrast: [d.contrast, 0.5, 2, 0.01],
        brightness: [d.brightness, 0.5, 2, 0.01],
        saturate: [d.saturate, 0.5, 3, 0.01],
      },
      surface: {
        tint: [d.tint, 0, 1, 0.01],
        edgeHighlight: [d.edgeHighlight, 0, 1, 0.01],
      },
      copy: { type: "action", label: "Copiar JSON" },
    },
    {
      onAction: (action) => {
        if (action !== "copy") return;
        const json = JSON.stringify(latest.current, null, 2);
        void navigator.clipboard?.writeText(json).catch(() => {});
        console.info("[Synapsis Liquid Glass] tuned config:\n" + json);
      },
    },
  );

  const config: LiquidGlassConfig = {
    depth: values.refraction.depth,
    radius: values.refraction.radius,
    rimWidth: values.refraction.rimWidth,
    chromaticAberration: values.refraction.chromaticAberration,
    blur: values.backdrop.blur,
    contrast: values.backdrop.contrast,
    brightness: values.backdrop.brightness,
    saturate: values.backdrop.saturate,
    tint: values.surface.tint,
    edgeHighlight: values.surface.edgeHighlight,
  };
  latest.current = config;

  useEffect(() => {
    onChange(config);
    // Re-run whenever any tuned value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onChange,
    config.depth,
    config.radius,
    config.rimWidth,
    config.chromaticAberration,
    config.blur,
    config.contrast,
    config.brightness,
    config.saturate,
    config.tint,
    config.edgeHighlight,
  ]);

  return <DialRoot position="top-right" defaultOpen theme="system" />;
}
