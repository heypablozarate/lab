"use client"

import styles from "../shader-experiment.module.css"
import type { ThemeMode } from "./shader-experiment-shell"

export const EFFECTS = [
  { id: 0, name: "Liquid" },
  { id: 1, name: "Ripple" },
  { id: 2, name: "Chromatic" },
  { id: 3, name: "Glitch" },
  { id: 4, name: "Swirl" },
  { id: 5, name: "ASCII" },
  { id: 6, name: "Particles" },
  { id: 7, name: "Halftone" },
  { id: 8, name: "Pixelate" },
  { id: 9, name: "Wave" },
  { id: 10, name: "Kaleidoscope" },
  { id: 11, name: "Bulge" },
  { id: 12, name: "Edge" },
  { id: 13, name: "CRT" },
  { id: 14, name: "Dissolve" },
  { id: 15, name: "Voronoi" },
] as const

export function ControlPanel({
  effect,
  intensity,
  theme,
  onEffectChange,
  onIntensityChange,
  onThemeChange,
}: {
  effect: number
  intensity: number
  theme: ThemeMode
  onEffectChange: (id: number) => void
  onIntensityChange: (value: number) => void
  onThemeChange: (theme: ThemeMode) => void
}) {
  return (
    <div className={styles.controlPanel}>
      <div className={styles.controlGroup}>
        <p className={styles.controlLabel}>Mode</p>
        <div className={styles.modeGrid}>
          {(["light", "dark"] as const).map((mode) => {
            const active = mode === theme
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onThemeChange(mode)}
                aria-pressed={active}
                className={styles.effectButton}
              >
                {mode === "light" ? "Light" : "Dark"}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <p className={styles.controlLabel}>Effect</p>
        <div className={styles.effectGrid}>
          {EFFECTS.map((e) => {
            const active = e.id === effect
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onEffectChange(e.id)}
                aria-pressed={active}
                className={styles.effectButton}
              >
                {e.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <p className={styles.controlLabel}>Intensity</p>
        <div className={styles.rangeRow}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={intensity}
            onChange={(e) => onIntensityChange(Number(e.target.value))}
            aria-label="Effect intensity"
            className={styles.range}
          />
          <span className={styles.rangeValue}>{Math.round(intensity * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
