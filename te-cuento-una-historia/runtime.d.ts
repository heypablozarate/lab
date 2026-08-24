export type ExperienceHandle = {
  destroy(): void
}

export type ExperienceOptions = {
  enterOnMount?: boolean
  audioContext?: AudioContext
}

export function mountExperience(
  root: HTMLElement,
  options?: ExperienceOptions,
): Promise<ExperienceHandle>
