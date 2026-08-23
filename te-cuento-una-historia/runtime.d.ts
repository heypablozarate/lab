export type ExperienceHandle = {
  destroy(): void
}

export function mountExperience(root: HTMLElement): Promise<ExperienceHandle>
