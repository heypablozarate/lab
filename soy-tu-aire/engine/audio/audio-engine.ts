import { extractBands } from "./extract-bands"
import type { Bands } from "../types"

const FFT_SIZE = 2048
const DEFAULT_MIN_BUFFER_SECONDS = 12
const DEFAULT_MIN_BUFFER_RATIO = 0.1
const DEFAULT_BUFFER_TIMEOUT_MS = 12000

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private audio: HTMLAudioElement | null = null
  private source: MediaElementAudioSourceNode | null = null
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(FFT_SIZE / 2)
  private playing = false
  private fallbackClock = false
  private fallbackStart = 0
  private loadCleanup: (() => void) | null = null
  private endedListeners = new Set<() => void>()
  private handleEnded = () => {
    this.playing = false
    this.fallbackClock = false
    for (const listener of this.endedListeners) listener()
  }

  constructor(private url: string) {}

  load(onProgress?: (p: number) => void): void {
    this.loadCleanup?.()
    this.loadCleanup = null
    const ctx = new AudioContext()
    if (ctx.state === "suspended") void ctx.resume().catch(() => {})
    const audio = new Audio(this.url)
    audio.preload = "auto"
    audio.setAttribute("playsinline", "")
    audio.addEventListener("ended", this.handleEnded)
    this.ctx = ctx
    this.audio = audio

    const source = ctx.createMediaElementSource(audio)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    analyser.connect(ctx.destination)
    this.source = source
    this.analyser = analyser
    this.freq = new Uint8Array(analyser.frequencyBinCount)

    let settled = false
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onReady)
      audio.removeEventListener("canplay", onReady)
      audio.removeEventListener("loadeddata", onReady)
      audio.removeEventListener("progress", onProgressEvent)
      audio.removeEventListener("error", onError)
      if (this.loadCleanup === cleanup) this.loadCleanup = null
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      onProgress?.(1)
    }
    const onReady = () => finish()
    const onError = () => cleanup()
    const onProgressEvent = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
      if (!duration || audio.buffered.length === 0) return
      const progress = Math.min(1, audio.buffered.end(audio.buffered.length - 1) / duration)
      onProgress?.(progress)
      if (progress >= 0.999) finish()
    }

    this.loadCleanup = cleanup
    audio.addEventListener("loadedmetadata", onReady)
    audio.addEventListener("canplay", onReady)
    audio.addEventListener("loadeddata", onReady)
    audio.addEventListener("progress", onProgressEvent)
    audio.addEventListener("error", onError)
    audio.load()
    if (audio.readyState >= 1) finish()
  }

  async unlockForBufferedStart(): Promise<void> {
    if (!this.ctx || !this.audio) throw new Error("AudioEngine no cargado")

    const wasMuted = this.audio.muted
    this.audio.muted = true
    this.fallbackClock = false
    this.fallbackStart = nowSeconds()
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {})
    }

    const playPromise = this.audio.play()
    const started = await Promise.race([
      playPromise.then(
        () => true,
        (error) => {
          throw error
        },
      ),
      wait(900).then(() => false),
    ])

    if (!started && this.audio.paused) {
      this.audio.muted = wasMuted
      throw new Error("No se pudo desbloquear el audio.")
    }

    this.audio.pause()
    this.audio.currentTime = 0
    this.audio.muted = wasMuted
    this.playing = false
  }

  async waitForBufferedStart(onProgress?: (p: number) => void): Promise<void> {
    if (!this.audio) throw new Error("AudioEngine no cargado")
    const audio = this.audio
    const minSeconds = DEFAULT_MIN_BUFFER_SECONDS
    const minRatio = DEFAULT_MIN_BUFFER_RATIO

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const timeout = window.setTimeout(() => {
        cleanup()
        reject(new Error("No se pudo preparar suficiente audio."))
      }, DEFAULT_BUFFER_TIMEOUT_MS)

      const cleanup = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        audio.removeEventListener("loadedmetadata", check)
        audio.removeEventListener("loadeddata", check)
        audio.removeEventListener("canplay", check)
        audio.removeEventListener("canplaythrough", check)
        audio.removeEventListener("progress", check)
        audio.removeEventListener("error", onError)
      }
      const finish = () => {
        cleanup()
        onProgress?.(1)
        resolve()
      }
      const onError = () => {
        cleanup()
        reject(new Error("No se pudo preparar el audio."))
      }
      const check = () => {
        const status = this.bufferStatus(minSeconds, minRatio)
        onProgress?.(status.progress)
        if (status.ready) finish()
      }

      audio.addEventListener("loadedmetadata", check)
      audio.addEventListener("loadeddata", check)
      audio.addEventListener("canplay", check)
      audio.addEventListener("canplaythrough", check)
      audio.addEventListener("progress", check)
      audio.addEventListener("error", onError)
      check()
    })
  }

  async play(): Promise<void> {
    if (!this.ctx || !this.audio || !this.analyser) throw new Error("AudioEngine no cargado")
    if (this.ctx.state === "suspended") {
      await Promise.race([this.ctx.resume(), wait(250)]).catch(() => {})
    }
    this.playing = true
    this.fallbackClock = false
    this.fallbackStart = nowSeconds() - this.audio.currentTime
    const playPromise = this.audio.play()
    const started = await Promise.race([
      playPromise.then(
        () => true,
        (error) => {
          this.playing = false
          throw error
        },
      ),
      wait(900).then(() => false),
    ])
    if (!started && this.audio.paused) {
      this.fallbackClock = true
      void playPromise.then(() => {
        this.fallbackClock = false
        this.fallbackStart = nowSeconds() - (this.audio?.currentTime ?? 0)
      }).catch(() => {
        this.playing = false
        this.fallbackClock = false
      })
    }
  }

  pause(): void {
    this.audio?.pause()
    this.playing = false
  }

  // Resume after a debug pause: restart the element and recompute the fallback
  // clock anchor so currentTime stays consistent if the element-clock is unusable.
  resume(): void {
    if (!this.audio) return
    this.playing = true
    this.fallbackStart = nowSeconds() - this.audio.currentTime
    void (async () => {
      if (this.ctx?.state === "suspended") await this.ctx.resume()
      await this.audio?.play()
    })().catch(() => {})
  }

  get currentTime(): number {
    if (this.playing && this.fallbackClock) return Math.max(0, nowSeconds() - this.fallbackStart)
    return this.audio?.currentTime ?? 0
  }

  get duration(): number {
    return this.audio?.duration ?? 0
  }

  private bufferStatus(minSeconds: number, minRatio: number): { progress: number; ready: boolean } {
    const audio = this.audio
    if (!audio) return { progress: 0, ready: false }
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    const targetSeconds = duration > 0 ? Math.min(minSeconds, duration) : minSeconds
    const currentTime = Math.max(0, audio.currentTime)
    let bufferedEnd = 0

    for (let i = 0; i < audio.buffered.length; i += 1) {
      const start = audio.buffered.start(i)
      const end = audio.buffered.end(i)
      if (start <= currentTime + 0.25 && end > bufferedEnd) bufferedEnd = end
    }

    const ahead = Math.max(0, bufferedEnd - currentTime)
    const secondsProgress = targetSeconds > 0 ? Math.min(1, ahead / targetSeconds) : 0
    const ratioProgress = duration > 0 ? Math.min(1, bufferedEnd / Math.max(duration * minRatio, 1)) : 0
    const progress = Math.max(secondsProgress, ratioProgress)
    const ready =
      ahead >= targetSeconds ||
      (duration > 0 && (bufferedEnd >= duration - 0.25 || bufferedEnd / duration >= minRatio))

    return { progress, ready }
  }

  getBands(): Bands {
    if (!this.analyser || !this.ctx) return { voz: 0, instrumental: 0, cascabeles: 0, ritmo2: 0 }
    this.analyser.getByteFrequencyData(this.freq)
    return extractBands(this.freq, this.ctx.sampleRate, FFT_SIZE)
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener)
    return () => this.endedListeners.delete(listener)
  }

  destroy(): void {
    this.loadCleanup?.()
    this.loadCleanup = null
    this.audio?.pause()
    if (this.audio) {
      this.audio.removeEventListener("ended", this.handleEnded)
      this.audio.removeAttribute("src")
      this.audio.load()
    }
    this.source?.disconnect()
    this.analyser?.disconnect()
    void this.ctx?.close()
    this.ctx = null
    this.audio = null
    this.source = null
    this.analyser = null
    this.playing = false
    this.fallbackClock = false
    this.endedListeners.clear()
  }
}

function nowSeconds(): number {
  return performance.now() / 1000
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
