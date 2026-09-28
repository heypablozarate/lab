import { describe, expect, it } from "vitest";
import { createDefaultSynapsisAppearance } from "./synapsis-appearance";
import { DARK_LIQUID_GLASS, LIGHT_LIQUID_GLASS } from "./liquid-glass";

const palettes = {
  light: { surfaceRaised: "#f4f1ec", ink: "#1a1816", accent: "#f4340a", paper: "#fffdf8" },
  dark: { surfaceRaised: "#292724", ink: "#ece7df", accent: "#ff652a", paper: "#171512" },
};

describe("Synapsis appearance defaults", () => {
  it.each(["light", "dark"] as const)("derives every %s color from its RAMS palette", (theme) => {
    const tokens = palettes[theme];
    const appearance = createDefaultSynapsisAppearance(tokens, theme);
    expect(appearance.universe.backgroundColor).toBe(tokens.paper);
    expect(appearance.universe.noise).toBe(0);
    expect(appearance.universe.vignette).toBe(0);
    expect(appearance.nodes.default.backgroundColor).toBe(tokens.ink);
    expect(appearance.nodes.filtered.backgroundColor).toBe(tokens.ink);
    expect(appearance.nodes.focused.backgroundColor).toBe(tokens.accent);
    expect(appearance.nodes.focused.glowColor).toBe(tokens.accent);
    expect(appearance.nodes.default.coreColor).toBe(tokens.surfaceRaised);
    const allowed = Object.values(tokens);
    for (const state of Object.values(appearance.nodes)) {
      expect(allowed).toContain(state.backgroundColor);
      expect(allowed).toContain(state.coreColor);
      expect(allowed).toContain(state.glowColor);
      for (const opacity of [state.backgroundOpacity, state.coreOpacity, state.glowOpacity]) {
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps filtered nodes subordinate and propagates changed editorial tokens", () => {
    const tokens = { surfaceRaised: "#334455", ink: "#aabbcc", accent: "#445566", paper: "#112233" };
    const { nodes, universe } = createDefaultSynapsisAppearance(tokens, "dark");
    expect(nodes.filtered.backgroundOpacity).toBeLessThan(nodes.default.backgroundOpacity);
    expect(nodes.filtered.glowOpacity).toBeLessThan(nodes.focused.glowOpacity);
    expect(nodes.default.backgroundColor).toBe(tokens.ink);
    expect(nodes.focused.backgroundColor).toBe(tokens.accent);
    expect(universe.backgroundColor).toBe(tokens.paper);
  });

  it("keeps the optional glass dial defaults finite and theme-compatible", () => {
    expect(Object.keys(LIGHT_LIQUID_GLASS)).toEqual(Object.keys(DARK_LIQUID_GLASS));
    for (const config of [LIGHT_LIQUID_GLASS, DARK_LIQUID_GLASS]) {
      for (const value of Object.values(config)) expect(Number.isFinite(value)).toBe(true);
      expect(config.radius).toBeGreaterThan(0);
      expect(config.blur).toBeGreaterThanOrEqual(0);
      expect(config.tint).toBeGreaterThanOrEqual(0);
      expect(config.tint).toBeLessThanOrEqual(1);
    }
  });
});
