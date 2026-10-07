export type ExperienceHandle = {
  destroy(): void
}

export type ExperienceOptions = {
  enterOnMount?: boolean
  audioContext?: AudioContext
  propagateInitialStoryLoadError?: boolean
}

export function mountExperience(
  root: HTMLElement,
  options?: ExperienceOptions,
): Promise<ExperienceHandle>
