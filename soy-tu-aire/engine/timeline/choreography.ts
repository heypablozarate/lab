// choreography.ts
import choreoJson from "../../data/choreography.json"

export type ChoreoEvent = {
  t: number
  velocidad: number
  presion: number
  climax: number
  reveals: string[]
  creatures: string[]
}
export type Choreography = { duration: number; events: ChoreoEvent[]; fotos: Record<string, string> }

export async function loadChoreography(): Promise<Choreography> {
  return choreoJson as Choreography
}
