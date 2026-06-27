"use client"

import { useEffect, useRef, useState } from "react"

import { AudioEngine } from "../engine/audio/audio-engine"
import styles from "../soy-tu-aire.module.css"

const AUDIO_URL = "/lab/soy-tu-aire/mix.mp3"
const SPOTIFY_URL = "https://open.spotify.com/search/Labuat%20Soy%20tu%20aire"

type Phase = "intro" | "loading" | "playing"

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioRef = useRef<AudioEngine | null>(null)
  const engineRef = useRef<import("../engine/engine").Engine | null>(null)
  const [phase, setPhase] = useState<Phase>("intro")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    Promise.all([import("../engine/engine"), import("pixi.js")])
      .then(([{ createEngine }, pixi]) => {
        if (cancelled || !canvas) return
        createEngine(canvas, pixi)
          .then((e) => {
            if (cancelled) {
              e.destroy()
              return
            }
            e.start()
            engineRef.current = e
          })
          .catch(() => {
            if (!cancelled) setUnsupported(true)
          })
      })
      .catch(() => {
        if (!cancelled) setUnsupported(true)
      })
    return () => { cancelled = true; engineRef.current?.destroy(); engineRef.current = null }
  }, [])

  async function handlePlay(clientX: number, clientY: number) {
    setError(null)
    setPhase("loading")
    const audio = new AudioEngine(AUDIO_URL)
    audioRef.current = audio
    try {
      await audio.load((p) => setProgress(p))
      const [{ Timeline }, { loadChoreography }] = await Promise.all([
        import("../engine/timeline/timeline"),
        import("../engine/timeline/choreography"),
      ])
      const choreo = await loadChoreography()
      engineRef.current?.attachAudio(audio)
      engineRef.current?.attachTimeline(new Timeline(choreo.events, choreo.duration))
      // Born exactly where the user clicked Play.
      engineRef.current?.primeStrokeBirth(clientX, clientY)
      await audio.play()
      setPhase("playing")
    } catch {
      audio.destroy()
      audioRef.current = null
      setPhase("intro")
      setError("No se pudo cargar el audio. Probá de nuevo.")
    }
  }

  useEffect(() => () => audioRef.current?.destroy(), [])

  return (
    <div className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Lienzo de tinta" />

      {/* Lens character over the scene: a soft vignette and a fine SVG film grain.
          Both are pointer-events:none so they never intercept the brush. */}
      <div className={styles.vignette} aria-hidden="true" />
      <svg className={styles.grain} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <filter id="stua-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#stua-grain)" />
      </svg>

      {unsupported && (
        <div className={styles.overlay}>
          <p className={styles.credit}>Tu navegador no soporta WebGL2. Probá Chrome/Safari/Firefox actualizados.</p>
        </div>
      )}

      {phase !== "playing" && (
        <div className={styles.overlay}>
          <p className={styles.credit}>
            Homenaje a <strong>“Soy tu aire” de Labuat</strong> (Herraiz Soto &amp; Co.).
            <br />
            Apoyá a la artista:{" "}
            <a href={SPOTIFY_URL} target="_blank" rel="noopener noreferrer">
              Escuchar en Spotify
            </a>
          </p>
          {phase === "intro" ? (
            <>
              {error && <p className={styles.credit}>{error}</p>}
              <button className={styles.playButton} onClick={(e) => handlePlay(e.clientX, e.clientY)}>
                ▶ Pintar la canción
              </button>
            </>
          ) : (
            <p className={styles.loader}>Cargando… {Math.round(progress * 100)}%</p>
          )}
        </div>
      )}
    </div>
  )
}
