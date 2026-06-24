// extract-creatures.mjs
//
// Reproducible pipeline for the "soy tu aire" stylized creature sprites.
//
// For every unique creature class referenced by data/choreography.json this
// script takes the first choreography time at which that class appears, grabs
// a single video frame at that timestamp with ffmpeg, and stylizes it to an
// ink sprite with PIL (dark pixels -> opaque ink, paper background ->
// transparent). The result is a 256x256 RGBA PNG per class written to
// public/lab/soy-tu-aire/creatures/<class>.png (in the PARENT webpz repo).
//
// v1 (declared): one fixed stylized image per creature class. Frame-by-frame
// animation is deferred to v2. Some frames are rough -> a faint blob is the
// accepted v1 look.
//
// Requirements: ffmpeg on PATH, /usr/bin/python3 with PIL (Pillow).
// Source video: /tmp/labuat_rec.mp4 (the original-piece recording).
//
// Usage:  node src/app/lab/soy-tu-aire/scripts/extract-creatures.mjs
// Run from the webpz repo root.

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const VIDEO = "/tmp/labuat_rec.mp4"
const HERE = dirname(fileURLToPath(import.meta.url))
const SOY = join(HERE, "..") // soy-tu-aire submodule root
const REPO_ROOT = join(SOY, "..", "..", "..", "..") // parent webpz root
const CHOREO = join(SOY, "data", "choreography.json")
const OUT_DIR = join(REPO_ROOT, "public", "lab", "soy-tu-aire", "creatures")

if (!existsSync(VIDEO)) {
  console.error(`Source video not found at ${VIDEO}. Regenerate it (see LAB_RUNBOOK / onboarding) and re-run.`)
  process.exit(1)
}

// 1) first-appearance time per unique creature class
const choreo = JSON.parse(readFileSync(CHOREO, "utf8"))
const firstAt = {}
for (const e of choreo.events) {
  for (const c of e.creatures || []) {
    if (firstAt[c] === undefined) firstAt[c] = e.t
  }
}
const classes = Object.keys(firstAt)
console.log(`Found ${classes.length} creature classes.`)

mkdirSync(OUT_DIR, { recursive: true })

// PIL stylize program (reads SRC/DST from argv). Keeps the brief's threshold math.
const PY = `
from PIL import Image, ImageOps
import sys
def stylize(src, dst):
    im = ImageOps.grayscale(Image.open(src)).resize((256, 256))
    px = im.load()
    out = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    op = out.load()
    for y in range(256):
        for x in range(256):
            v = px[x, y]
            a = max(0, 200 - v)              # dark -> opaque
            if a > 20:
                op[x, y] = (22, 21, 26, min(255, a * 2))
    out.save(dst)
stylize(sys.argv[1], sys.argv[2])
`
const pyFile = join(tmpdir(), "stylize_creature.py")
writeFileSync(pyFile, PY)

let ok = 0
const failed = []
for (const name of classes) {
  const t = firstAt[name]
  const frame = join(tmpdir(), `creature_frame_${name}.png`)
  const dst = join(OUT_DIR, `${name}.png`)
  try {
    // -ss before -i = fast seek; -frames:v 1 = single frame
    execFileSync("ffmpeg", ["-y", "-ss", String(t), "-i", VIDEO, "-frames:v", "1", frame], {
      stdio: ["ignore", "ignore", "ignore"],
    })
    if (!existsSync(frame)) throw new Error("ffmpeg produced no frame")
    execFileSync("/usr/bin/python3", [pyFile, frame, dst], { stdio: ["ignore", "ignore", "inherit"] })
    if (!existsSync(dst)) throw new Error("PIL produced no sprite")
    ok++
    console.log(`  ✓ ${name}.png  (t=${t}s)`)
  } catch (err) {
    failed.push(name)
    console.error(`  ✗ ${name}  (t=${t}s): ${err.message}`)
  } finally {
    rmSync(frame, { force: true })
  }
}

rmSync(pyFile, { force: true })
console.log(`Done: ${ok}/${classes.length} sprites written to ${OUT_DIR}`)
if (failed.length) console.log(`Failed: ${failed.join(", ")}`)
