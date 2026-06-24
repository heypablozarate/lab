import { extractBands } from "./extract-bands"
import type { Bands } from "../types"

const FFT_SIZE = 2048

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(FFT_SIZE / 2)
  private startTime = 0
  private startOffset = 0
  private playing = false

  constructor(private url: string) {}

  async load(onProgress?: (p: number) => void): Promise<void> {
    const res = await fetch(this.url)
    if (!res.ok) throw new Error(`No se pudo cargar el audio: ${res.status}`)
    // Progreso de descarga si el server manda Content-Length.
    const total = Number(res.headers.get("Content-Length") || 0)
    const reader = res.body?.getReader()
    let bytes: Uint8Array
    if (reader && total > 0) {
      const chunks: Uint8Array[] = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        onProgress?.(received / total)
      }
      bytes = new Uint8Array(received)
      let off = 0
      for (const c of chunks) { bytes.set(c, off); off += c.length }
    } else {
      bytes = new Uint8Array(await res.arrayBuffer())
      onProgress?.(1)
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.buffer = await ctx.decodeAudioData(bytes.buffer as ArrayBuffer)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.8
    analyser.connect(ctx.destination)
    this.analyser = analyser
    this.freq = new Uint8Array(analyser.frequencyBinCount)
  }

  async play(): Promise<void> {
    if (!this.ctx || !this.buffer || !this.analyser) throw new Error("AudioEngine no cargado")
    if (this.ctx.state === "suspended") await this.ctx.resume()
    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.analyser)
    source.start(0, this.startOffset)
    this.source = source
    this.startTime = this.ctx.currentTime
    this.playing = true
  }

  pause(): void {
    if (!this.ctx || !this.source) return
    this.startOffset += this.ctx.currentTime - this.startTime
    this.source.stop()
    this.source.disconnect()
    this.source = null
    this.playing = false
  }

  get currentTime(): number {
    if (!this.ctx) return 0
    return this.playing ? this.startOffset + (this.ctx.currentTime - this.startTime) : this.startOffset
  }

  get duration(): number {
    return this.buffer?.duration ?? 0
  }

  getBands(): Bands {
    if (!this.analyser || !this.ctx) return { voz: 0, instrumental: 0, cascabeles: 0, ritmo2: 0 }
    this.analyser.getByteFrequencyData(this.freq)
    return extractBands(this.freq, this.ctx.sampleRate, FFT_SIZE)
  }

  destroy(): void {
    try { this.source?.stop() } catch { /* noop */ }
    this.source?.disconnect()
    this.analyser?.disconnect()
    void this.ctx?.close()
    this.ctx = null
    this.source = null
    this.analyser = null
    this.playing = false
  }
}
