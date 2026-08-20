"use client"

import { useState } from "react"

import styles from "../shader-experiment.module.css"
import { ControlPanel } from "./control-panel"
import { WordmarkShader } from "./wordmark-shader"
import type { ShaderInterfaceCopy } from "@/lib/lab-content"

export function WordmarkStage({
  brandName,
  interfaceCopy,
}: {
  brandName: string
  interfaceCopy: ShaderInterfaceCopy
}) {
  const [effect, setEffect] = useState(0)
  const [intensity, setIntensity] = useState(1)

  return (
    <div className={styles.stage}>
      <div className={styles.shaderFrame}>
        <WordmarkShader
          brandName={brandName}
          effect={effect}
          intensity={intensity}
          className={styles.shaderCanvas}
        />
      </div>

      <p className={styles.instruction}>{interfaceCopy.instruction}</p>

      <ControlPanel
        effect={effect}
        intensity={intensity}
        interfaceCopy={interfaceCopy}
        onEffectChange={setEffect}
        onIntensityChange={setIntensity}
      />
    </div>
  )
}
