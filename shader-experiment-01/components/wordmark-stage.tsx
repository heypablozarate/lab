"use client"

import { useReducer } from "react"

import styles from "../shader-experiment.module.css"
import { ControlPanel } from "./control-panel"
import { WordmarkShader } from "./wordmark-shader"
import {
  createWordmarkStageState,
  reduceWordmarkStageState,
} from "./wordmark-stage-state"
import type { ShaderInterfaceCopy } from "@/lib/lab-content"

export function WordmarkStage({
  brandName,
  interfaceCopy,
}: {
  brandName: string
  interfaceCopy: ShaderInterfaceCopy
}) {
  const [state, dispatch] = useReducer(
    reduceWordmarkStageState,
    brandName,
    createWordmarkStageState,
  )

  return (
    <div className={styles.stage}>
      <div className={styles.shaderFrame}>
        <WordmarkShader
          text={state.text}
          effect={state.effect}
          intensity={state.intensity}
          className={styles.shaderCanvas}
          rendererUnavailableMessage={
            interfaceCopy.rendererUnavailableMessage
          }
          statusClassName={styles.rendererStatus}
        />
      </div>

      <p className={styles.instruction}>{interfaceCopy.instruction}</p>

      <ControlPanel
        effect={state.effect}
        intensity={state.intensity}
        text={state.text}
        interfaceCopy={interfaceCopy}
        onEffectChange={(effect) => dispatch({ type: "effect", effect })}
        onIntensityChange={(intensity) =>
          dispatch({ type: "intensity", intensity })
        }
        onTextChange={(text) => dispatch({ type: "text", text })}
      />
    </div>
  )
}
