"use client"

import { useId } from "react"

import styles from "../shader-experiment.module.css"

import type { ShaderInterfaceCopy } from "@/lib/lab-content"

export const EFFECT_IDS = Array.from({ length: 16 }, (_, id) => id)

export function ControlPanel({
  effect,
  intensity,
  text,
  interfaceCopy,
  onEffectChange,
  onIntensityChange,
  onTextChange,
}: {
  effect: number
  intensity: number
  text: string
  interfaceCopy: ShaderInterfaceCopy
  onEffectChange: (id: number) => void
  onIntensityChange: (value: number) => void
  onTextChange: (value: string) => void
}) {
  const textInputId = useId()
  const textHelpId = `${textInputId}-help`

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

      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor={textInputId}>
          {interfaceCopy.textInputLabel}
        </label>
        <input
          id={textInputId}
          type="text"
          value={text}
          onChange={(event) => onTextChange(event.currentTarget.value)}
          aria-describedby={textHelpId}
          className={styles.textInput}
          autoComplete="off"
          spellCheck={false}
        />
        <p id={textHelpId} className={styles.controlHelp}>
          {interfaceCopy.textInputHelp}
        </p>
      </div>
    </div>
  )
}
