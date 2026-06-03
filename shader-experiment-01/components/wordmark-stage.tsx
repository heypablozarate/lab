"use client"

import { useState } from "react"

import styles from "../shader-experiment.module.css"
import { ControlPanel } from "./control-panel"
import { WordmarkShader } from "./wordmark-shader"

export function WordmarkStage() {
  const [effect, setEffect] = useState(0)
  const [intensity, setIntensity] = useState(1)

  return (
    <div className={styles.stage}>
      <div className={styles.shaderFrame}>
        <WordmarkShader
          effect={effect}
          intensity={intensity}
          className={styles.shaderCanvas}
        />
      </div>

      <p className={styles.instruction}>
        Move your cursor across the wordmark.
      </p>

      <ControlPanel
        effect={effect}
        intensity={intensity}
        onEffectChange={setEffect}
        onIntensityChange={setIntensity}
      />
    </div>
  )
}
