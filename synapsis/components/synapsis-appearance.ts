export type SynapsisTheme = "light" | "dark";

export type SynapsisAppearanceTokens = {
  surfaceRaised: string;
  ink: string;
  accent: string;
  paper: string;
};

export type NodeStateAppearance = {
  backgroundColor: string;
  backgroundOpacity: number;
  coreColor: string;
  coreOpacity: number;
  glowColor: string;
  glowOpacity: number;
};

export type SynapsisThemeAppearance = {
  nodes: {
    default: NodeStateAppearance;
    filtered: NodeStateAppearance;
    focused: NodeStateAppearance;
  };
  universe: {
    backgroundColor: string;
    noise: number;
    vignette: number;
  };
};

export type SynapsisAppearanceByTheme = Record<SynapsisTheme, SynapsisThemeAppearance>;

function nodeState(
  backgroundColor: string,
  backgroundOpacity: number,
  coreColor: string,
  coreOpacity: number,
  glowColor: string,
  glowOpacity: number,
): NodeStateAppearance {
  return {
    backgroundColor,
    backgroundOpacity,
    coreColor,
    coreOpacity,
    glowColor,
    glowOpacity,
  };
}

export function createDefaultSynapsisAppearance(
  _tokens: SynapsisAppearanceTokens,
  theme: SynapsisTheme,
): SynapsisThemeAppearance {
  if (theme === "dark") {
    return {
      nodes: {
        default: nodeState("#f7f7f7", 0.77, "#ffffff", 0.1, "#ece7e0", 0),
        filtered: nodeState("#1A1816", 1, "#1a1816", 0.12, "#ece7e0", 0.2),
        focused: nodeState("#ff460c", 1, "#d40000", 0.14, "#ff460c", 0.78),
      },
      universe: {
        backgroundColor: "#333333",
        noise: 1,
        vignette: 0.2,
      },
    };
  }

  return {
    nodes: {
      default: nodeState("#262626", 0.85, "#262626", 0.2, "#262626", 0.6),
      filtered: nodeState("#f7f7f7", 0, "#f7f7f7", 0, "#f7f7f7", 0),
      focused: nodeState("#ff460c", 1, "#d40000", 0.29, "#ff460c", 0.34),
    },
    universe: {
      backgroundColor: "#f7f7f7",
      noise: 0.7,
      vignette: 0.27,
    },
  };
}
