import { describe, expect, it } from "vitest";

import { createDefaultSynapsisAppearance } from "./synapsis-appearance";
import { DARK_LIQUID_GLASS, LIGHT_LIQUID_GLASS } from "./liquid-glass";

const tokens = {
  surfaceRaised: "#f4f1ec",
  ink: "#1a1816",
  accent: "#f4340a",
  paper: "#fffdf8",
};

describe("Synapsis appearance defaults", () => {
  it("uses Pablo's tuned light appearance as the DialKit seed", () => {
    const light = createDefaultSynapsisAppearance(tokens, "light");

    expect(light).toEqual({
      nodes: {
        default: {
          backgroundColor: "#262626",
          backgroundOpacity: 0.85,
          coreColor: "#262626",
          coreOpacity: 0.2,
          glowColor: "#262626",
          glowOpacity: 0.6,
        },
        filtered: {
          backgroundColor: "#f7f7f7",
          backgroundOpacity: 0,
          coreColor: "#f7f7f7",
          coreOpacity: 0,
          glowColor: "#f7f7f7",
          glowOpacity: 0,
        },
        focused: {
          backgroundColor: "#ff460c",
          backgroundOpacity: 1,
          coreColor: "#d40000",
          coreOpacity: 0.29,
          glowColor: "#ff460c",
          glowOpacity: 0.34,
        },
      },
      universe: {
        backgroundColor: "#f7f7f7",
        noise: 0.7,
        vignette: 0.27,
      },
    });
  });

  it("uses Pablo's tuned dark appearance as the DialKit seed", () => {
    const dark = createDefaultSynapsisAppearance(tokens, "dark");

    expect(dark).toEqual({
      nodes: {
        default: {
          backgroundColor: "#f7f7f7",
          backgroundOpacity: 0.77,
          coreColor: "#ffffff",
          coreOpacity: 0.1,
          glowColor: "#ece7e0",
          glowOpacity: 0,
        },
        filtered: {
          backgroundColor: "#1A1816",
          backgroundOpacity: 1,
          coreColor: "#1a1816",
          coreOpacity: 0.12,
          glowColor: "#ece7e0",
          glowOpacity: 0.2,
        },
        focused: {
          backgroundColor: "#ff460c",
          backgroundOpacity: 1,
          coreColor: "#d40000",
          coreOpacity: 0.14,
          glowColor: "#ff460c",
          glowOpacity: 0.78,
        },
      },
      universe: {
        backgroundColor: "#333333",
        noise: 1,
        vignette: 0.2,
      },
    });
  });

  it("uses the tuned liquid-glass values in either theme", () => {
    const expected = {
      radius: 20,
      rimWidth: 0.1,
      depth: 16,
      chromaticAberration: 0.39,
      blur: 6,
      contrast: 1.39,
      brightness: 0.91,
      saturate: 1.45,
      tint: 0.53,
      edgeHighlight: 0.43,
    };

    expect(LIGHT_LIQUID_GLASS).toEqual(expected);
    expect(DARK_LIQUID_GLASS).toEqual(expected);
  });
});
