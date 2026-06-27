// timeline.ts
import type { ChoreoEvent } from "./choreography"

export type TimelineState = { velocidad: number; presion: number; climax: number }

export class Timeline {
  readonly duration: number

  constructor(private events: ChoreoEvent[], duration?: number) {
    this.duration = duration ?? events[events.length - 1]?.t ?? 0
  }

  query(t: number): TimelineState {
    const ev = this.events
    if (ev.length === 0) return { velocidad: 1, presion: 0.5, climax: 0 }
    if (t <= ev[0].t) return { velocidad: ev[0].velocidad, presion: ev[0].presion, climax: 0 }
    const last = ev[ev.length - 1]
    if (t >= last.t) return { velocidad: last.velocidad, presion: last.presion, climax: 0 }
    // búsqueda lineal del segmento (events ordenados); suficiente para ~185 eventos
    let i = 0
    while (i < ev.length - 1 && ev[i + 1].t <= t) i++
    const a = ev[i], b = ev[i + 1]
    const f = (t - a.t) / Math.max(b.t - a.t, 1e-6)
    // climax: pico que decae 0.4s después de un evento con climax
    let climax = 0
    for (const e of ev) {
      if (e.climax && t >= e.t && t - e.t < 0.4) climax = Math.max(climax, 1 - (t - e.t) / 0.4)
    }
    return {
      velocidad: a.velocidad + (b.velocidad - a.velocidad) * f,
      presion: a.presion + (b.presion - a.presion) * f,
      climax,
    }
  }

  fired(prevT: number, t: number): ChoreoEvent[] {
    return this.events.filter(
      (e) => (e.reveals.length > 0 || e.creatures.length > 0) && e.t > prevT && e.t <= t,
    )
  }

  inkAt(t: number): number {
    if (this.duration <= 0) return 1
    const finalFade = Math.min(1, Math.max(0, (this.duration - t) / 7.5))
    const speedFade = Math.min(1, Math.max(0, this.query(t).velocidad / 0.7))
    return Math.min(finalFade, speedFade)
  }
}
