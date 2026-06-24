// build-choreography.mjs — node (ESM). Uso: node scripts/build-choreography.mjs
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, "..", "data", "setup.original.xml")
const OUT = join(here, "..", "data", "choreography.json")

const xml = readFileSync(SRC, "utf8")

// "MM:SS:CC" → segundos (CC = centésimas)
function parseTime(s) {
  const m = /(\d+):(\d+):(\d+)/.exec(s)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 100
}

// Mapa de fotos id → ruta (del bloque <fotos>)
const fotos = {}
for (const m of xml.matchAll(/<foto\s+id="([^"]+)"\s*>\s*([^<]+?)\s*<\/foto>/g)) {
  fotos[m[1]] = m[2].trim()
}

// Eventos
const events = []
let lastVel = 1
let lastPres = 0.2
const eventRe = /<evento\b([^>]*)>([\s\S]*?)<\/evento>/g
for (const m of xml.matchAll(eventRe)) {
  const attrs = m[1]
  const body = m[2]
  const tm = /tiempo="([^"]+)"/.exec(attrs)
  const t = tm ? parseTime(tm[1]) : 0
  const vel = /<velocidad>\s*([\d.]+)\s*<\/velocidad>/.exec(body)
  const pres = /<presion>\s*([\d.]+)\s*<\/presion>/.exec(body)
  if (vel) lastVel = Number(vel[1])
  if (pres) lastPres = Number(pres[1])
  const climax = /<pincelClimax\b/.test(body) ? 1 : 0
  const reveals = [...body.matchAll(/<foto\s+id="([^"]+)"/g)].map((x) => x[1])
  const creatures = [...body.matchAll(/<movieclip[^>]*clase="(?:animaciones\.)?([^"]+)"/g)].map((x) => x[1])
  events.push({ t, velocidad: lastVel, presion: lastPres, climax, reveals, creatures })
}
events.sort((a, b) => a.t - b.t)
const duration = events.length ? events[events.length - 1].t : 0

writeFileSync(OUT, JSON.stringify({ duration, events, fotos }, null, 2))
console.log(`choreography.json: ${events.length} eventos, dur ${duration.toFixed(2)}s, ${Object.keys(fotos).length} fotos`)
