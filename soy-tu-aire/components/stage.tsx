"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"

import type { SoyTuAireExperimentContent } from "@/lib/lab-content"

import { Wordmark } from "../../wordmark"
import { AudioEngine } from "../engine/audio/audio-engine"
import styles from "../soy-tu-aire.module.css"

const AUDIO_URL = "/lab/soy-tu-aire/mix.mp3"
const BRAND_TEXT = "PabloZarate™"
const APPLE_MUSIC_LABEL = "Virginia Maestro (aka Labuat)"
const ORIGINAL_AGENCY_LABEL = "Herraiz Soto & Co."

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const mm = String(Math.floor(total / 60)).padStart(2, "0")
  const ss = String(total % 60).padStart(2, "0")
  return `${mm}:${ss}`
}

function renderRichText(
  text: string,
  brandUrl: string,
  linkClassName: string,
  wordmarkClassName: string,
): ReactNode[] {
  if (!text.includes(BRAND_TEXT)) return [text]
  const parts = text.split(BRAND_TEXT)
  return parts.flatMap((part, index) => {
    const nodes: ReactNode[] = []
    if (part) nodes.push(part)
    if (index < parts.length - 1) {
      nodes.push(
        <a className={linkClassName} href={brandUrl} target="_blank" rel="noopener noreferrer" key={`brand-${index}`}>
          <Wordmark className={wordmarkClassName} />
        </a>,
      )
    }
    return nodes
  })
}

function renderIntroParagraph(text: string, appleMusicUrl: string): ReactNode[] {
  const renderAppleMusic = (part: string, keyPrefix: string): ReactNode[] => {
    if (!part.includes(APPLE_MUSIC_LABEL)) return [part]
    const [before, after] = part.split(APPLE_MUSIC_LABEL)

    return [
      before,
      <a href={appleMusicUrl} target="_blank" rel="noopener noreferrer" key={`${keyPrefix}-apple-music`}>
        {APPLE_MUSIC_LABEL}
      </a>,
      after,
    ]
  }

  if (!text.includes(ORIGINAL_AGENCY_LABEL)) return renderAppleMusic(text, "intro")

  const [beforeAgency, afterAgency] = text.split(ORIGINAL_AGENCY_LABEL)
  return [
    ...renderAppleMusic(beforeAgency, "before-agency"),
    <strong key="original-agency">{ORIGINAL_AGENCY_LABEL}</strong>,
    ...renderAppleMusic(afterAgency, "after-agency"),
  ]
}

type Phase = "intro" | "loading" | "playing" | "credits"
type CreditsMode = "final" | "paused"

export function Stage({ content }: { content: SoyTuAireExperimentContent }) {
  const { credits } = content
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioRef = useRef<AudioEngine | null>(null)
  const endedCleanupRef = useRef<(() => void) | null>(null)
  const engineRef = useRef<import("../engine/engine").Engine | null>(null)
  const [phase, setPhase] = useState<Phase>("intro")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [paused, setPaused] = useState(false)
  const [pauseTime, setPauseTime] = useState(0)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [creditsMode, setCreditsMode] = useState<CreditsMode>("final")
  const loadingPercent = Math.max(3, Math.min(100, Math.round(progress * 100)))

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
    setShareStatus(null)
    setProgress(0)
    setPhase("loading")
    endedCleanupRef.current?.()
    audioRef.current?.destroy()
    engineRef.current?.resetForReplay()
    const audio = new AudioEngine(AUDIO_URL)
    audioRef.current = audio
    try {
      const timelinePromise = Promise.all([
        import("../engine/timeline/timeline"),
        import("../engine/timeline/choreography"),
      ]).then(async ([{ Timeline }, { loadChoreography }]) => {
        const choreo = await loadChoreography()
        return new Timeline(choreo.events, choreo.duration)
      })
      audio.load((p) => setProgress(Math.min(0.36, p * 0.36)))
      endedCleanupRef.current = audio.onEnded(() => {
        if (audioRef.current !== audio) return
        engineRef.current?.freezeVisuals()
        setPaused(false)
        setCreditsMode("final")
        setPhase("credits")
      })
      engineRef.current?.attachAudio(audio)
      // Born exactly where the user clicked Play.
      engineRef.current?.primeStrokeBirth(clientX, clientY)
      await audio.unlockForBufferedStart()
      await audio.waitForBufferedStart((p) => setProgress(0.36 + p * 0.64))
      engineRef.current?.attachTimeline(await timelinePromise)
      await audio.play()
      setPhase("playing")
    } catch {
      endedCleanupRef.current?.()
      endedCleanupRef.current = null
      audio.destroy()
      audioRef.current = null
      setPhase("intro")
      setError(content.audioErrorMessage)
    }
  }

  useEffect(() => () => {
    endedCleanupRef.current?.()
    audioRef.current?.destroy()
  }, [])

  async function handleRestart(event: MouseEvent<HTMLButtonElement>) {
    const { clientX, clientY } = event
    setProgress(0)
    setPauseTime(0)
    setPaused(false)
    setError(null)
    setShareStatus(null)
    setCreditsMode("final")
    await handlePlay(clientX, clientY)
  }

  async function handleShare() {
    const url = window.location.href.split("#")[0]
    const payload = {
      title: credits.shareTitle,
      text: credits.shareText,
      url,
    }

    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
      await navigator.clipboard?.writeText(url)
      setShareStatus(credits.shareCopiedLabel)
    } catch {
      setShareStatus(null)
    }
  }

  // A click on the canvas freezes the experience and exposes the lightweight
  // pause controls; credits opened from here must preserve the paused session.
  function handleCanvasClick() {
    if (phase !== "playing" || !engineRef.current) return
    const result = engineRef.current.togglePause()
    setPaused(result.paused)
    setPauseTime(result.time)
  }

  function handleResume() {
    if (phase !== "playing" || !paused || !engineRef.current) return
    const result = engineRef.current.togglePause()
    setPaused(result.paused)
    setPauseTime(result.time)
  }

  function handleResumeFromCredits() {
    if (creditsMode !== "paused" || !engineRef.current) return
    let result = { paused: false, time: pauseTime }
    if (engineRef.current.isPaused()) {
      result = engineRef.current.togglePause()
    }
    setPaused(result.paused)
    setPauseTime(result.time)
    setShareStatus(null)
    setPhase("playing")
  }

  function handleShowCredits() {
    if (phase !== "playing" || !paused) return
    setCreditsMode("paused")
    setShareStatus(null)
    setPhase("credits")
  }

  return (
    <div className={styles.stage}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label={content.canvasLabel}
        onClick={handleCanvasClick}
      />

      {paused && phase === "playing" && (
        <div className={styles.pauseBadge} role="group" aria-label={`${content.pauseLabel} en ${formatClock(pauseTime)}`}>
          <span className={styles.pauseLabel}>{content.pauseLabel}</span>
          <time className={styles.pauseTime} dateTime={`PT${Math.floor(Math.max(0, pauseTime))}S`}>
            {formatClock(pauseTime)}
          </time>
          <button className={styles.pauseButton} type="button" onClick={handleResume}>
            {content.resumeLabel}
          </button>
          <button className={styles.pauseLink} type="button" onClick={handleShowCredits}>
            {content.showCreditsLabel}
          </button>
        </div>
      )}

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
          <p className={styles.credit}>{content.unsupportedMessage}</p>
        </div>
      )}

      {(phase === "intro" || phase === "loading") && (
        <div className={styles.overlay}>
          <section className={styles.introPanel} aria-labelledby="soy-tu-aire-title">
            <Link className={styles.backLink} href="/">
              {content.introBackLabel}
            </Link>
            <h1 id="soy-tu-aire-title" className={styles.title}>
              {content.introTitle}
            </h1>
            {phase === "intro" ? (
              <>
                {error && <p className={styles.credit}>{error}</p>}
                <button className={styles.playButton} onClick={(e) => handlePlay(e.clientX, e.clientY)}>
                  {content.playLabel}
                </button>
              </>
            ) : (
              <div className={styles.loader} role="status" aria-live="polite">
                <span>{content.loadingLabel}</span>
                <span className={styles.loaderPercent}>{loadingPercent}%</span>
                <span className={styles.loaderTrack} aria-hidden="true">
                  <span style={{ transform: `scaleX(${loadingPercent / 100})` }} />
                </span>
              </div>
            )}
            <div className={styles.credit}>
              {content.introParagraphs.map((paragraph) => (
                <p key={paragraph}>{renderIntroParagraph(paragraph, content.appleMusicUrl)}</p>
              ))}
            </div>
          </section>
          <p className={styles.homageLine}>
            <span>{content.homagePrefix}</span>
            <a className={styles.homageLink} href={content.brandUrl} target="_blank" rel="noopener noreferrer">
              <Wordmark className={styles.homageWordmark} />
            </a>
          </p>
        </div>
      )}

      {phase === "credits" && (
        <div className={styles.creditsOverlay} role="dialog" aria-modal="true" aria-labelledby="soy-tu-aire-credits-title">
          <section className={styles.creditsPanel}>
            <header className={styles.creditsHeader}>
              <h2 id="soy-tu-aire-credits-title" className={styles.creditsTitle}>{credits.title}</h2>
              <p className={styles.creditsLede}>{renderRichText(credits.lede, content.brandUrl, styles.inlineWordmarkLink, styles.inlineWordmark)}</p>
            </header>
            <div className={styles.creditsGrid}>
              <div className={styles.creditsSections}>
                {credits.sections.map((section) => (
                  <article className={styles.creditsSection} key={section.title}>
                    <p className={styles.creditsKicker}>{section.kicker}</p>
                    <h3>{section.title}</h3>
                    <div className={styles.creditsBody}>
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{renderRichText(paragraph, content.brandUrl, styles.inlineWordmarkLink, styles.inlineWordmark)}</p>
                      ))}
                    </div>
                    <a className={styles.creditsSource} href={section.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {section.sourceLabel}
                    </a>
                  </article>
                ))}
              </div>
              <aside className={styles.creditsStack} aria-labelledby="soy-tu-aire-stack-title">
                <h3 id="soy-tu-aire-stack-title">{credits.stackTitle}</h3>
                <ul>
                  {credits.stack.map((item) => (
                    <li key={item.name}>
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
            <div className={styles.creditsActions}>
              {creditsMode === "paused" ? (
                <button className={styles.creditsButton} onClick={handleResumeFromCredits}>
                  {credits.resumeLabel}
                </button>
              ) : (
                <button className={styles.creditsButton} onClick={handleRestart}>
                  {credits.restartLabel}
                </button>
              )}
              <button className={styles.creditsButton} onClick={handleShare}>
                {credits.shareLabel}
              </button>
            </div>
            {shareStatus && <p className={styles.shareStatus} role="status">{shareStatus}</p>}
          </section>
        </div>
      )}
    </div>
  )
}
