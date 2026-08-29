export type WordmarkStageState = {
  effect: number
  intensity: number
  text: string
}

export type WordmarkStageAction =
  | { type: "effect"; effect: number }
  | { type: "intensity"; intensity: number }
  | { type: "text"; text: string }

export function createWordmarkStageState(initialText: string): WordmarkStageState {
  return {
    effect: 0,
    intensity: 1,
    text: initialText,
  }
}

export function reduceWordmarkStageState(
  state: WordmarkStageState,
  action: WordmarkStageAction,
): WordmarkStageState {
  switch (action.type) {
    case "effect":
      return { ...state, effect: action.effect }
    case "intensity":
      return { ...state, intensity: action.intensity }
    case "text":
      return { ...state, text: action.text }
  }
}
