"use client"

import { useState } from "react"

import styles from "../shader-experiment.module.css"
import { ControlPanel } from "./control-panel"
import type { ThemeMode } from "./shader-experiment-shell"
import { WordmarkShader } from "./wordmark-shader"

export function WordmarkStage({
  theme,
  onThemeChange,
}: {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}) {
  const [effect, setEffect] = useState(0)
  const [intensity, setIntensity] = useState(1)

  return (
    <div className={styles.stage}>
      <div className={styles.shaderFrame}>
        <WordmarkShader
          key={theme}
          effect={effect}
          intensity={intensity}
          className={styles.shaderCanvas}
        />
      </div>

      <p className={styles.instruction}>
        Move your cursor across the wordmark, then tune the effect below.
      </p>

      <ControlPanel
        effect={effect}
        intensity={intensity}
        theme={theme}
        onEffectChange={setEffect}
        onIntensityChange={setIntensity}
        onThemeChange={onThemeChange}
      />
    </div>
  )
}
