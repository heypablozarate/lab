"use client"

import styles from "../shader-experiment.module.css"

import type { ShaderInterfaceCopy } from "@/lib/lab-content"

export const EFFECT_IDS = Array.from({ length: 16 }, (_, id) => id)

export function ControlPanel({
  effect,
  intensity,
  interfaceCopy,
  onEffectChange,
  onIntensityChange,
}: {
  effect: number
  intensity: number
  interfaceCopy: ShaderInterfaceCopy
  onEffectChange: (id: number) => void
  onIntensityChange: (value: number) => void
}) {
  return (
    <div className={styles.controlPanel}>
      <div className={styles.controlGroup}>
        <p className={styles.controlLabel}>{interfaceCopy.effectHeading}</p>
        <div className={styles.effectGrid}>
          {EFFECT_IDS.map((id) => {
            const active = id === effect
            return (
              <button
                key={id}
                type="button"
                onClick={() => onEffectChange(id)}
                aria-pressed={active}
                className={styles.effectButton}
              >
                {interfaceCopy.effectLabels[id]}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <p className={styles.controlLabel}>{interfaceCopy.intensityHeading}</p>
        <div className={styles.rangeRow}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={intensity}
            onChange={(e) => onIntensityChange(Number(e.target.value))}
            aria-label={interfaceCopy.intensityAriaLabel}
            className={styles.range}
          />
          <span className={styles.rangeValue}>{Math.round(intensity * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
