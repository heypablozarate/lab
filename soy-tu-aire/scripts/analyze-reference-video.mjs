import fs from "node:fs"
import { spawn } from "node:child_process"

const video = process.argv[2] ?? "public/lab/soy-tu-aire/Soy tu Aire - Labuat.mp4"
const out = process.argv[3] ?? "/tmp/soy-tu-aire-reference-metrics.json"
const width = 640
const height = 480
const fps = 30
const cropY = 34
const cropH = 411
const frameSize = width * height * 3

const ffmpeg = spawn("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  video,
  "-map",
  "0:v:0",
  "-pix_fmt",
  "rgb24",
  "-f",
  "rawvideo",
  "-",
])

let pending = Buffer.alloc(0)
let frameIndex = 0
const bySecond = new Map()

ffmpeg.stdout.on("data", (chunk) => {
  pending = Buffer.concat([pending, chunk])
  while (pending.length >= frameSize) {
    consumeFrame(pending.subarray(0, frameSize))
    pending = pending.subarray(frameSize)
  }
})

ffmpeg.on("close", (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1
    return
  }
  const seconds = [...bySecond.entries()].map(([second, values]) => ({
    second,
    darkPct: average(values.map((value) => value.darkPct)),
    colorPct: average(values.map((value) => value.colorPct)),
    colP90: average(values.map((value) => value.colP90)),
    colMax: Math.max(...values.map((value) => value.colMax)),
  }))
  const result = {
    source: video,
    frameCount: frameIndex,
    duration: Math.round((frameIndex / fps) * 1000) / 1000,
    crop: { x: 0, y: cropY, width, height: cropH },
    phases: summarizePhases(seconds),
    topDark: [...seconds].sort((a, b) => b.darkPct - a.darkPct).slice(0, 12),
    topColor: [...seconds].sort((a, b) => b.colorPct - a.colorPct).slice(0, 12),
    topWidth: [...seconds].sort((a, b) => b.colMax - a.colMax).slice(0, 12),
  }
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`Wrote ${out}`)
})

function consumeFrame(frame) {
  const colDark = new Int16Array(width)
  let dark = 0
  let color = 0
  for (let y = cropY; y < cropY + cropH; y += 1) {
    let offset = y * width * 3
    for (let x = 0; x < width; x += 1, offset += 3) {
      const r = frame[offset]
      const g = frame[offset + 1]
      const b = frame[offset + 2]
      const lum = (r + g + b) / 3
      if (Math.max(r, g, b) - Math.min(r, g, b) > 32 && Math.max(r, g, b) > 90) color += 1
      if (lum < 76) {
        dark += 1
        colDark[x] += 1
      }
    }
  }
  const activePx = width * cropH
  const cols = [...colDark].filter(Boolean).sort((a, b) => a - b)
  const second = Math.floor(frameIndex / fps)
  const values = bySecond.get(second) ?? []
  values.push({
    darkPct: round(dark / activePx),
    colorPct: round(color / activePx),
    colP90: percentile(cols, 0.9),
    colMax: percentile(cols, 1),
  })
  bySecond.set(second, values)
  frameIndex += 1
}

function summarizePhases(seconds) {
  return [
    ["intro-thread", 0, 45],
    ["mid-words-splashes", 45, 88],
    ["lip-transition", 88, 125],
    ["thin-motifs", 125, 168],
    ["climax", 168, 218],
    ["dry-out", 218, 240],
  ].map(([name, start, end]) => {
    const values = seconds.filter((entry) => entry.second >= start && entry.second < end)
    return {
      name,
      start,
      end,
      darkPct: average(values.map((value) => value.darkPct)),
      colorPct: average(values.map((value) => value.colorPct)),
      colP90: average(values.map((value) => value.colP90)),
      colMax: Math.max(...values.map((value) => value.colMax)),
    }
  })
}

function average(values) {
  if (values.length === 0) return 0
  return round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function percentile(values, q) {
  if (values.length === 0) return 0
  return values[Math.floor((values.length - 1) * q)]
}

function round(value) {
  return Math.round(value * 100000) / 100000
}
