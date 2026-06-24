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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    import("../engine/engine").then(({ Engine }) => {
      if (cancelled || !canvas) return
      try { const e = new Engine(canvas); e.start(); engineRef.current = e } catch { /* fallback fase 4 */ }
    })
    return () => { cancelled = true; engineRef.current?.destroy(); engineRef.current = null }
  }, [])

  async function handlePlay() {
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
      engineRef.current?.attachTimeline(new Timeline(choreo.events))
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

      {phase !== "playing" && (
        <div className={styles.overlay}>
          <p className={styles.credit}>
            Homenaje a <strong>"Soy tu aire" de Labuat</strong> (Herraiz Soto &amp; Co.).
            <br />
            Apoyá a la artista:{" "}
            <a href={SPOTIFY_URL} target="_blank" rel="noopener noreferrer">
              Escuchar en Spotify
            </a>
          </p>
          {phase === "intro" ? (
            <>
              {error && <p className={styles.credit}>{error}</p>}
              <button className={styles.playButton} onClick={handlePlay}>
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
