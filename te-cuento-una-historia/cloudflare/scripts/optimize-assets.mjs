import { readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

import { payloadRoot } from "./paths.mjs"

const assetsRoot = path.join(payloadRoot, "assets")
const manifestPath = path.join(assetsRoot, "image-formats.json")
const concurrency = Math.max(1, Math.min(4, Number(process.env.IMAGE_CONCURRENCY) || 4))

const resizeRules = new Map([
  ["cover.png", { width: 768, height: 1152 }],
  ["desktop/table.png", { width: 1920, height: 1200 }],
])

async function findPngFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await findPngFiles(target))
    else if (entry.name.toLowerCase().endsWith(".png")) files.push(target)
  }
  return files
}

function outputPath(source, extension) {
  return source.replace(/\.png$/iu, `.${extension}`)
}

async function optimize(source) {
  const relativeSource = path.relative(assetsRoot, source)
  const sourceInfo = await sharp(source).metadata()
  const rule = resizeRules.get(relativeSource)
  const pipeline = () => {
    const image = sharp(source, { limitInputPixels: false }).rotate()
    if (!rule) return image
    return image.resize({
      ...rule,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
  }
  const avifPath = outputPath(source, "avif")
  const webpPath = outputPath(source, "webp")
  const avifQuality = relativeSource === "desktop/table.png" ? 55 : 72
  await Promise.all([
    pipeline().avif({
      quality: avifQuality,
      effort: 6,
      chromaSubsampling: "4:4:4",
    }).toFile(avifPath),
    pipeline().webp({
      quality: 84,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
    }).toFile(webpPath),
  ])
  const [sourceStat, avifStat, webpStat, outputInfo] = await Promise.all([
    stat(source),
    stat(avifPath),
    stat(webpPath),
    sharp(avifPath).metadata(),
  ])
  return {
    source: relativeSource,
    width: outputInfo.width,
    height: outputInfo.height,
    sourceWidth: sourceInfo.width,
    sourceHeight: sourceInfo.height,
    bytes: {
      png: sourceStat.size,
      avif: avifStat.size,
      webp: webpStat.size,
    },
  }
}

const sources = (await findPngFiles(assetsRoot)).sort()
const entries = new Array(sources.length)
let cursor = 0

async function worker() {
  while (cursor < sources.length) {
    const index = cursor
    cursor += 1
    entries[index] = await optimize(sources[index])
    process.stdout.write(`\rOptimized ${index + 1}/${sources.length}`)
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))
process.stdout.write("\n")

const totals = entries.reduce(
  (result, entry) => {
    for (const format of ["png", "avif", "webp"]) {
      result[format] += entry.bytes[format]
    }
    return result
  },
  { png: 0, avif: 0, webp: 0 },
)

const manifest = {
  schema: "te-cuento-image-formats/v1",
  sourceFormat: "png",
  preferredFormat: "avif",
  fallbackFormat: "webp",
  entries,
  totals,
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

console.log(
  `AVIF ${Math.round(totals.avif / 1024)} KiB; WebP ${Math.round(totals.webp / 1024)} KiB; PNG ${Math.round(totals.png / 1024)} KiB`,
)
