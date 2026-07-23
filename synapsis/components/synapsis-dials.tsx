"use client";

/* Dev-only Interface Craft panel for Synapsis. GalaxyStage gates this behind
   `?dialkit=1` outside production. Every dial feeds the real WebGL scene:
   liquid glass, per-theme node states, and the universe background/effects. */

import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { useEffect, useRef, useState } from "react";

import type { LiquidGlassConfig } from "./liquid-glass";
import type {
  NodeStateAppearance,
  SynapsisAppearanceByTheme,
  SynapsisThemeAppearance,
} from "./synapsis-appearance";

type DialsProps = {
  glassSeed: LiquidGlassConfig;
  appearanceSeed: SynapsisAppearanceByTheme;
  onGlassChange: (config: LiquidGlassConfig) => void;
  onAppearanceChange: (config: SynapsisAppearanceByTheme) => void;
};

function nodeControls(seed: NodeStateAppearance) {
  return {
    nodo: {
      color: seed.backgroundColor,
      opacidad: [seed.backgroundOpacity, 0, 1, 0.01] as [number, number, number, number],
    },
    núcleo: {
      color: seed.coreColor,
      opacidad: [seed.coreOpacity, 0, 1, 0.01] as [number, number, number, number],
    },
    efectos: {
      "sombra / glow": {
        color: seed.glowColor,
        opacidad: [seed.glowOpacity, 0, 1, 0.01] as [number, number, number, number],
      },
    },
  };
}

function themeControls(seed: SynapsisThemeAppearance) {
  return {
    "background general": {
      color: seed.universe.backgroundColor,
      efectos: {
        noise: [seed.universe.noise, 0, 1, 0.01] as [number, number, number, number],
        vignette: [seed.universe.vignette, 0, 1, 0.01] as [number, number, number, number],
      },
    },
    "nodo y núcleo": {
      default: nodeControls(seed.nodes.default),
      "filtro (atenuados)": nodeControls(seed.nodes.filtered),
      foco: nodeControls(seed.nodes.focused),
    },
  };
}

type ResolvedNodeControls = {
  nodo: { color: string; opacidad: number };
  núcleo: { color: string; opacidad: number };
  efectos: {
    "sombra / glow": { color: string; opacidad: number };
  };
};

function resolveNodeState(values: ResolvedNodeControls): NodeStateAppearance {
  return {
    backgroundColor: values.nodo.color,
    backgroundOpacity: values.nodo.opacidad,
    coreColor: values.núcleo.color,
    coreOpacity: values.núcleo.opacidad,
    glowColor: values.efectos["sombra / glow"].color,
    glowOpacity: values.efectos["sombra / glow"].opacidad,
  };
}

type ResolvedThemeControls = {
  "background general": {
    color: string;
    efectos: {
      noise: number;
      vignette: number;
    };
  };
  "nodo y núcleo": {
    default: ResolvedNodeControls;
    "filtro (atenuados)": ResolvedNodeControls;
    foco: ResolvedNodeControls;
  };
};

function resolveTheme(values: ResolvedThemeControls): SynapsisThemeAppearance {
  return {
    nodes: {
      default: resolveNodeState(values["nodo y núcleo"].default),
      filtered: resolveNodeState(values["nodo y núcleo"]["filtro (atenuados)"]),
      focused: resolveNodeState(values["nodo y núcleo"].foco),
    },
    universe: {
      backgroundColor: values["background general"].color,
      noise: values["background general"].efectos.noise,
      vignette: values["background general"].efectos.vignette,
    },
  };
}

export default function SynapsisDials({
  glassSeed,
  appearanceSeed,
  onGlassChange,
  onAppearanceChange,
}: DialsProps) {
  const [glass] = useState<LiquidGlassConfig>(glassSeed);
  const [appearance] = useState<SynapsisAppearanceByTheme>(appearanceSeed);
  const latest = useRef<{ glass: LiquidGlassConfig; appearance: SynapsisAppearanceByTheme }>({
    glass,
    appearance,
  });

  const values = useDialKit(
    "Synapsis · Interface Craft",
    {
      light: themeControls(appearance.light),
      dark: themeControls(appearance.dark),
      "liquid glass": {
        refraction: {
          depth: [glass.depth, 0, 60, 1],
          radius: [glass.radius, 0, 60, 1],
          rimWidth: [glass.rimWidth, 0.02, 1, 0.01],
          chromaticAberration: [glass.chromaticAberration, 0, 1, 0.01],
        },
        backdrop: {
          blur: [glass.blur, 0, 20, 0.25],
          contrast: [glass.contrast, 0.5, 2, 0.01],
          brightness: [glass.brightness, 0.5, 2, 0.01],
          saturate: [glass.saturate, 0.5, 3, 0.01],
        },
        surface: {
          tint: [glass.tint, 0, 1, 0.01],
          edgeHighlight: [glass.edgeHighlight, 0, 1, 0.01],
        },
      },
      copy: { type: "action", label: "Copiar JSON" },
    },
    {
      id: "synapsis-interface-craft",
      onAction: (action) => {
        if (action !== "copy") return;
        const json = JSON.stringify(latest.current, null, 2);
        void navigator.clipboard?.writeText(json).catch(() => {});
        console.info("[Synapsis Interface Craft] tuned config:\n" + json);
      },
    },
  );

  const nextGlass: LiquidGlassConfig = {
    depth: values["liquid glass"].refraction.depth,
    radius: values["liquid glass"].refraction.radius,
    rimWidth: values["liquid glass"].refraction.rimWidth,
    chromaticAberration: values["liquid glass"].refraction.chromaticAberration,
    blur: values["liquid glass"].backdrop.blur,
    contrast: values["liquid glass"].backdrop.contrast,
    brightness: values["liquid glass"].backdrop.brightness,
    saturate: values["liquid glass"].backdrop.saturate,
    tint: values["liquid glass"].surface.tint,
    edgeHighlight: values["liquid glass"].surface.edgeHighlight,
  };
  const nextAppearance: SynapsisAppearanceByTheme = {
    light: resolveTheme(values.light),
    dark: resolveTheme(values.dark),
  };
  const appearanceSignature = JSON.stringify(nextAppearance);
  latest.current = { glass: nextGlass, appearance: nextAppearance };

  useEffect(() => {
    onGlassChange(nextGlass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onGlassChange,
    nextGlass.depth,
    nextGlass.radius,
    nextGlass.rimWidth,
    nextGlass.chromaticAberration,
    nextGlass.blur,
    nextGlass.contrast,
    nextGlass.brightness,
    nextGlass.saturate,
    nextGlass.tint,
    nextGlass.edgeHighlight,
  ]);

  useEffect(() => {
    onAppearanceChange(nextAppearance);
    // The resolved DialKit object is recreated during render; its serialized
    // primitive values are the stable change signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAppearanceChange, appearanceSignature]);

  return <DialRoot position="top-right" defaultOpen theme="system" />;
}
