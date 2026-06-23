"use client"

import { useEffect, useRef } from "react"

import styles from "../soy-tu-aire.module.css"

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Fase 1.3 monta el renderer acá. Por ahora solo dejamos el canvas listo.
  }, [])

  return (
    <div className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Lienzo de tinta" />
    </div>
  )
}
