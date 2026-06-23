"use client"

import { useEffect, useRef } from "react"

import styles from "../soy-tu-aire.module.css"

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: import("../engine/render/renderer").Renderer | null = null
    let raf = 0
    let cancelled = false
    import("../engine/render/renderer").then(({ Renderer }) => {
      if (cancelled) return
      try {
        renderer = new Renderer(canvas)
      } catch {
        return // Fase 4 agrega fallback de WebGL2
      }
      const loop = () => {
        renderer!.resize()
        renderer!.clearPaper()
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      renderer?.destroy()
    }
  }, [])

  return (
    <div className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Lienzo de tinta" />
    </div>
  )
}
