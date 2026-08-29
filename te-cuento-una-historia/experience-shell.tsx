"use client"

/* eslint-disable @next/next/no-img-element -- These intrinsic images are authored spatial layers whose exact decoded dimensions and native loading behavior are part of the panoramic composition; next/image wrappers would alter that scene contract. */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type KeyboardEvent,
} from "react"

import { RamsWordmark } from "./cloudflare/src/rams-wordmark"
import type {
  TeCuentoCreditsContent,
  TeCuentoInterfaceCopy,
} from "./cloudflare/src/content-types"
import { optimizedImageSources } from "./image-formats"

import styles from "./te-cuento-una-historia.module.css"

const ASSET_ROOT = "/lab/te-cuento-una-historia/assets"

function OptimizedImage({
  src,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const sources = optimizedImageSources(src)
  if (sources.avif === src) return <img src={src} alt={alt} {...props} />
  return (
    <picture>
      <source srcSet={sources.avif} type="image/avif" />
      <img src={sources.webp} alt={alt} {...props} />
    </picture>
  )
}

type ExperienceHandle = {
  destroy(): void
}

type MountExperience = (
  root: HTMLElement,
  options?: { enterOnMount?: boolean; audioContext?: AudioContext },
) => Promise<ExperienceHandle>

function centerPanViewport(viewport: HTMLElement) {
  const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  viewport.scrollTo({ left: maximum / 2, behavior: "auto" })
}

function isDirectStoryPath(pathname: string) {
  return /\/relatos\/[^/]+\/?$/u.test(pathname)
}

type SocialLink = { href: string; label: string }

function StoryLogo({
  brandName,
  brandUrl,
  copy,
}: {
  brandName: string
  brandUrl: string
  copy: TeCuentoInterfaceCopy
}) {
  const wordmark = <RamsWordmark className={styles.logoWordmark} variant="signature" />

  return (
    <>
      <p className={styles.logoTitle}>{copy.logoTitle}</p>
      <p className={styles.logoByline}>
        <span>{copy.logoCreditPrefix}</span>{" "}
        <a
          className={styles.logoBrandLink}
          href={brandUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${brandName}, sitio web`}
        >
          {wordmark}
        </a>
      </p>
    </>
  )
}

export function ExperienceShell({
  brandName,
  brandUrl,
  copy,
  credits,
  socialLinks,
}: {
  brandName: string
  brandUrl: string
  copy: TeCuentoInterfaceCopy
  credits: TeCuentoCreditsContent
  socialLinks: SocialLink[]
}) {
  const rootRef = useRef<HTMLElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panProgressRef = useRef(0.5)
  const startExperienceRef = useRef<(enterOnMount: boolean) => void>(() => {})
  const [loadError, setLoadError] = useState(false)
  const [runtimeStarting, setRuntimeStarting] = useState(false)
  const [directStoryEntry] = useState(
    () => typeof window !== "undefined" && isDirectStoryPath(window.location.pathname),
  )
  const [requiresImmediateRuntime] = useState(() => {
    if (typeof window === "undefined") return false
    const params = new URLSearchParams(window.location.search)
    return isDirectStoryPath(window.location.pathname)
      || params.get("autoplay") === "1"
      || params.get("debugHotspots") === "1"
  })

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    centerPanViewport(viewport)

    const updateProgress = () => {
      const maximum = viewport.scrollWidth - viewport.clientWidth
      panProgressRef.current = maximum > 0 ? viewport.scrollLeft / maximum : 0.5
    }
    const preservePosition = () => {
      const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      viewport.scrollTo({
        left: maximum * panProgressRef.current,
        behavior: "auto",
      })
    }

    viewport.addEventListener("scroll", updateProgress, { passive: true })
    const observer = new ResizeObserver(preservePosition)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)

    return () => {
      viewport.removeEventListener("scroll", updateProgress)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let cancelled = false
    let handle: ExperienceHandle | undefined
    let starting = false

    const start = (enterOnMount: boolean) => {
      if (cancelled || starting) return
      starting = true
      setRuntimeStarting(enterOnMount)

      // Claim Web Audio authorization synchronously inside the gesture. The
      // heavy runtime module can then arrive on demand without losing Safari
      // or iOS playback permission.
      let audioContext: AudioContext | undefined
      if (enterOnMount) {
        const AudioContextClass = window.AudioContext
        try {
          audioContext = new AudioContextClass({
            latencyHint: "playback",
            sampleRate: 44_100,
          })
        } catch {
          audioContext = new AudioContextClass({ latencyHint: "playback" })
        }
        void audioContext.resume()
      }

      void import("./runtime.js")
        .then(({ mountExperience }) => {
          if (typeof mountExperience !== "function") {
            throw new TypeError("The experience runtime has no mount function")
          }
          const mount = mountExperience as MountExperience
          return mount(root, { enterOnMount, audioContext })
        })
        .then((mounted) => {
          if (cancelled) mounted.destroy()
          else handle = mounted
        })
        .catch(async () => {
          if (audioContext?.state !== "closed") await audioContext?.close().catch(() => {})
          if (!cancelled) setLoadError(true)
        })
    }

    startExperienceRef.current = start
    if (requiresImmediateRuntime) start(false)

    return () => {
      cancelled = true
      startExperienceRef.current = () => {}
      handle?.destroy()
    }
  }, [requiresImmediateRuntime])

  function handlePanKeys(event: KeyboardEvent<HTMLDivElement>) {
    const viewport = viewportRef.current
    if (!viewport || event.target !== viewport) return

    const step = Math.max(180, viewport.clientWidth * 0.55)
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth"
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      viewport.scrollBy({
        left: event.key === "ArrowLeft" ? -step : step,
        behavior,
      })
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      viewport.scrollTo({
        left: event.key === "Home" ? 0 : viewport.scrollWidth,
        behavior,
      })
    }
  }

  return (
    <section className={styles.experience} ref={rootRef} aria-label={copy.experienceLabel}>
      <p className={styles.panInstructions} id="pan-instructions">
        {copy.panInstructions}
      </p>

      <div
        id="pan-viewport"
        className={styles.panViewport}
        ref={viewportRef}
        role="region"
        tabIndex={0}
        aria-label={copy.panoramaLabel}
        aria-describedby="pan-instructions"
        onKeyDown={handlePanKeys}
        inert
      >
        <div className={styles.panorama}>
          <div id="desktop-environment" className={styles.desktopEnvironment} aria-hidden="true">
            <div id="desk-surface" className={styles.deskSurface} />
            <OptimizedImage className={`${styles.deskProp} ${styles.lamp}`} src={`${ASSET_ROOT}/desktop/lamp.png`} alt="" fetchPriority="high" />
            <OptimizedImage className={`${styles.deskProp} ${styles.portrait}`} src={`${ASSET_ROOT}/desktop/portrait.png`} alt="" />
            <OptimizedImage className={`${styles.deskProp} ${styles.magnifier}`} src={`${ASSET_ROOT}/desktop/magnifier.png`} alt="" />
            <OptimizedImage className={`${styles.deskProp} ${styles.clock}`} src={`${ASSET_ROOT}/desktop/clock.png`} alt="" />
            <OptimizedImage className={`${styles.deskProp} ${styles.box}`} src={`${ASSET_ROOT}/desktop/box.png`} alt="" />
            <OptimizedImage className={`${styles.deskProp} ${styles.cup}`} src={`${ASSET_ROOT}/desktop/cup.png`} alt="" />
            <OptimizedImage className={`${styles.deskProp} ${styles.inkwell}`} src={`${ASSET_ROOT}/desktop/inkwell.png`} alt="" />
            <OptimizedImage className={`${styles.deskProp} ${styles.quill}`} src={`${ASSET_ROOT}/desktop/quill.png`} alt="" />
            <OptimizedImage id="desk-vignette" className={styles.vignette} src={`${ASSET_ROOT}/desktop/vignette.png`} alt="" />
          </div>

          <header
            id="scene-logo"
            className={`${styles.logo} ${styles.sceneLogo}`}
            aria-label={`${copy.logoTitle}, ${copy.logoCreditPrefix} ${brandName}`}
          >
            <StoryLogo brandName={brandName} brandUrl={brandUrl} copy={copy} />
          </header>

          <div
            id="stage"
            className={styles.stage}
            tabIndex={0}
            role="button"
            aria-label={copy.stageLabel}
            aria-describedby="pan-instructions"
          />
          <p id="author-mark" className={styles.authorMark}>
            {copy.authorMark}
          </p>
          <div id="clue-layer" className={styles.clueLayer} aria-label={copy.clueLayerLabel} />
        </div>
      </div>

      <section
        id="intro"
        className={`${styles.intro} ${directStoryEntry ? styles.introDirectEntry : ""}`}
        role="dialog"
        aria-modal={directStoryEntry ? undefined : "true"}
        aria-hidden={directStoryEntry ? "true" : undefined}
        aria-labelledby="intro-title"
        aria-describedby="intro-description intro-instructions"
        inert={directStoryEntry ? true : undefined}
      >
        <div className={styles.introComposition}>
          <header id="intro-logo" className={`${styles.logo} ${styles.introLogo}`}>
            <div id="intro-logo-motion" className={styles.logoMotionSurface}>
              <StoryLogo brandName={brandName} brandUrl={brandUrl} copy={copy} />
            </div>
          </header>
          <article id="intro-card" className={styles.introCard}>
            <p id="intro-kicker" className={styles.introKicker}>
              {copy.introKicker}
            </p>
            <h2 id="intro-title" className={styles.introTitle}>{copy.introTitle}</h2>
            <p id="intro-description" className={styles.introDescription}>
              {copy.introDescription}
            </p>
            <p id="intro-instructions" className={styles.introInstructions}>
              {copy.introInstructions.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
            <button
              id="intro-enter"
              className={styles.introEnter}
              type="button"
              disabled={runtimeStarting}
              aria-busy={runtimeStarting || undefined}
              data-loading={runtimeStarting ? "true" : undefined}
              onClick={() => startExperienceRef.current(true)}
            >
              {copy.introEnterLabel}
            </button>
          </article>
        </div>
      </section>

      <section
        id="reader"
        className={styles.reader}
        role="dialog"
        aria-modal="true"
        aria-hidden="true"
        aria-labelledby="reader-title"
        inert
      >
        <div id="reader-shell" className={styles.readerShell}>
          <button id="reader-close" className={styles.readerClose} type="button">{copy.readerCloseLabel}</button>
          <article id="reader-article" className={styles.readerArticle}>
            <figure id="reader-illustration-wrap" className={styles.readerIllustrationWrap}>
              <img id="reader-illustration" className={styles.readerIllustration} alt="" />
            </figure>
            <div
              id="reader-page"
              className={styles.readerPage}
              tabIndex={0}
              role="region"
              aria-label={copy.readerRegionLabel}
            >
              <header id="reader-header" className={styles.readerHeader}>
                <time id="reader-meta" className={styles.readerMeta} />
                <h2 id="reader-title" className={styles.readerTitle} />
                <div id="reader-rule" className={styles.readerRule} aria-hidden="true" />
              </header>
              <div id="reader-body" className={styles.readerBody} data-form="cuento" />
            </div>
          </article>
        </div>
      </section>

      <section
        id="credits"
        className={`${styles.reader} ${styles.credits}`}
        role="dialog"
        aria-modal="true"
        aria-hidden="true"
        aria-labelledby="credits-title"
        inert
      >
        <div id="credits-shell" className={styles.readerShell}>
          <button
            id="credits-close"
            className={styles.readerClose}
            type="button"
            aria-label={copy.creditsCloseLabel}
          >
            {copy.readerCloseLabel}
          </button>
          <article
            id="credits-panel"
            className={`${styles.readerArticle} has-scene-sequence`}
          >
            <figure
              id="credits-illustration-wrap"
              className={`${styles.readerIllustrationWrap} ${styles.creditsIllustrationWrap}`}
            >
              <OptimizedImage
                id="credits-illustration"
                className={`${styles.readerIllustration} ${styles.creditsIllustration}`}
                src={credits.makingOfScenes[0].image.src}
                alt={credits.makingOfScenes[0].image.alt}
                width={credits.makingOfScenes[0].image.width}
                height={credits.makingOfScenes[0].image.height}
                data-fit={credits.makingOfScenes[0].image.fit}
                loading="lazy"
                decoding="async"
              />
              <figcaption
                id="credits-illustration-caption"
                className={styles.creditsIllustrationCaption}
              >
                {credits.makingOfScenes[0].image.caption}
              </figcaption>
            </figure>
            <div
              id="credits-page"
              className={styles.readerPage}
              tabIndex={0}
              role="region"
              aria-label={credits.title}
            >
              <header className={styles.readerHeader}>
                <p className={styles.readerMeta}>{credits.historyHeading}</p>
                <h2 id="credits-title" className={styles.readerTitle}>{credits.title}</h2>
                <div className={styles.readerRule} aria-hidden="true" />
              </header>
              <div id="credits-body" className={styles.readerBody}>
                {credits.historyParagraphs.map((paragraph, index) => (
                  <p className={index === 0 ? "story-opening" : undefined} key={paragraph}>
                    {paragraph}
                  </p>
                ))}

                {credits.makingOfScenes.map((scene) => (
                  <section
                    className={styles.creditsScene}
                    data-credits-scene={scene.id}
                    data-scene-src={scene.image.src}
                    data-scene-alt={scene.image.alt}
                    data-scene-caption={scene.image.caption}
                    data-scene-fit={scene.image.fit}
                    key={scene.id}
                  >
                    <h2>{scene.heading}</h2>
                    {scene.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </section>
                ))}

                <section className={styles.creditsDetails} aria-labelledby="credits-music-title">
                  <h2 id="credits-music-title">{credits.musicHeading}</h2>
                  <p>{credits.musicBody}</p>
                  <p className={styles.creditsPeriod}>
                    <span className={styles.srOnly}>Período: </span>{credits.periodLabel}
                  </p>
                  <p><a href="/relatos">{copy.storyIndexLabel}</a></p>
                </section>

                <nav className={styles.creditsSocial} aria-labelledby="credits-social-title">
                  <h2 id="credits-social-title">{credits.socialHeading}</h2>
                  <ul>
                    {socialLinks.map((link) => (
                      <li key={link.href}>
                        <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div id="utility-controls" className={styles.utilityControls}>
        <button
          id="credits-toggle"
          className={`${styles.utilityControl} ${styles.creditsToggle}`}
          type="button"
          inert
        >
          {copy.creditsTriggerLabel}
        </button>

        <button
          id="sound-toggle"
          className={`${styles.utilityControl} ${styles.soundToggle}`}
          type="button"
          aria-pressed="true"
          data-on-label={copy.soundOnLabel}
          data-off-label={copy.soundOffLabel}
          data-retry-label={copy.soundRetryLabel}
          inert
        >
          {copy.soundOnLabel}
        </button>
      </div>

      <audio
        id="city-audio-source"
        src={`${ASSET_ROOT}/audio/city-traffic-walla-horns-v003.mp3`}
        preload="none"
        hidden
      />

      <section id="debug-audio" className={styles.debugAudio} aria-labelledby="debug-audio-title" hidden>
        <h2 id="debug-audio-title" className={styles.debugAudioTitle}>Audio debug</h2>
        <div className={styles.debugAudioControl}>
          <label htmlFor="debug-music-volume">Música</label>
          <output id="debug-music-value" htmlFor="debug-music-volume">2%</output>
          <input id="debug-music-volume" type="range" min="0" max="100" step="1" defaultValue="2" />
        </div>
        <div className={styles.debugAudioControl}>
          <label htmlFor="debug-city-volume">Ciudad</label>
          <output id="debug-city-value" htmlFor="debug-city-volume">5%</output>
          <input id="debug-city-volume" type="range" min="0" max="100" step="1" defaultValue="5" />
        </div>
      </section>

      {loadError ? (
        <div className={styles.runtimeError} role="alert">
          {copy.runtimeError}
        </div>
      ) : null}
    </section>
  )
}
