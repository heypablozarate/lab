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
  tokens: SynapsisAppearanceTokens,
  theme: SynapsisTheme,
): SynapsisThemeAppearance {
  void theme; // Retain the public call signature; RAMS tokens already resolve it.
  // Theme selection belongs to RAMS. These state treatments consume the
  // resolved theme tokens instead of maintaining a second color palette.
  return {
    nodes: {
      default: nodeState(tokens.ink, 0.9, tokens.surfaceRaised, 0.08, tokens.ink, 0.16),
      filtered: nodeState(tokens.ink, 0.12, tokens.ink, 0, tokens.ink, 0),
      focused: nodeState(tokens.accent, 1, tokens.surfaceRaised, 0.1, tokens.accent, 0.45),
    },
    universe: {
      backgroundColor: tokens.paper,
      noise: 0,
      vignette: 0,
    },
  };
}
