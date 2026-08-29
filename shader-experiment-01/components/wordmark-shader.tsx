"use client"

import { useEffect, useRef, useState } from "react"

import {
  nextRendererKind,
  type RendererKind,
} from "../renderer/contracts"
import {
  startWordmarkRuntime,
  type WordmarkRuntime,
  type WordmarkRuntimeState,
} from "../renderer/wordmark-runtime"

type RendererStatus = "initializing" | "ready" | "failed"

export function WordmarkShader({
  text,
  effect = 0,
  intensity = 1,
  className,
  rendererUnavailableMessage,
  statusClassName,
}: {
  text: string
  effect?: number
  intensity?: number
  className?: string
  rendererUnavailableMessage?: string
  statusClassName?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<WordmarkRuntime | undefined>(undefined)
  const latestStateRef = useRef<WordmarkRuntimeState>({
    text,
    effect,
    intensity,
  })
  const [rendererKind, setRendererKind] =
    useState<RendererKind>("webgpu")
  const [rendererStatus, setRendererStatus] =
    useState<RendererStatus>("initializing")
  const [renderersExhausted, setRenderersExhausted] = useState(false)

  useEffect(() => {
    const nextState = { text, effect, intensity }
    latestStateRef.current = nextState
    runtimeRef.current?.update(nextState)
  }, [effect, intensity, text])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let active = true

    const handleFailure = (failedKind: RendererKind) => {
      if (!active) return
      const nextKind = nextRendererKind(failedKind)
      if (nextKind) {
        setRendererStatus("initializing")
        setRendererKind(nextKind)
      } else {
        setRendererStatus("failed")
        setRenderersExhausted(true)
      }
    }

    try {
      const runtime = startWordmarkRuntime({
        canvas,
        kind: rendererKind,
        initialState: latestStateRef.current,
        onRendererFailure: handleFailure,
        onRendererReady() {
          if (!active) return
          setRendererStatus("ready")
          setRenderersExhausted(false)
        },
      })
      runtimeRef.current = runtime
    } catch {
      handleFailure(rendererKind)
    }

    return () => {
      active = false
      runtimeRef.current?.dispose()
      runtimeRef.current = undefined
    }
  }, [rendererKind])

  const showStaticFallbackStatus =
    rendererKind === "canvas2d" && rendererStatus === "ready"
  const showUnavailableStatus =
    Boolean(rendererUnavailableMessage) &&
    (showStaticFallbackStatus || renderersExhausted)
  const accessibleLabel = text || undefined

  return (
    <>
      <canvas
        key={rendererKind}
        ref={canvasRef}
        className={className}
        role={accessibleLabel ? "img" : undefined}
        aria-label={accessibleLabel}
        aria-hidden={accessibleLabel ? undefined : true}
        data-renderer={rendererKind}
        data-renderer-status={rendererStatus}
      />
      {showUnavailableStatus ? (
        <p className={statusClassName} role="status">
          {rendererUnavailableMessage}
        </p>
      ) : null}
    </>
  )
}
