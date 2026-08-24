import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  decodeStorySlug,
  distRoot,
  encodeStorySlug,
  fontsRoot,
  payloadRoot,
  projectRoot,
  requirePath,
} from "./paths.mjs"
import {
  renderTeCuentoMarkdown,
  teCuentoMarkdownToPlainText,
} from "../../lib/te-cuento-story-markdown.ts"

requirePath(payloadRoot, "Canonical Te cuento payload")
requirePath(fontsRoot, "RAMS font source")

const payloadDestination = path.join(
  distRoot,
  "lab/te-cuento-una-historia",
)
const fontsDestination = path.join(distRoot, "rams/assets/fonts")

await mkdir(payloadDestination, { recursive: true })
await mkdir(fontsDestination, { recursive: true })
await cp(payloadRoot, payloadDestination, { recursive: true })

const requiredFonts = [
  "NHaasGroteskDSPro-55Rg.woff2",
  "NHaasGroteskDSPro-65Md.woff2",
  "NHaasGroteskDSPro-75Bd.woff2",
  "CenturyStd-Book.woff2",
  "CenturyStd-BookItalic.woff2",
  "CenturyStd-Bold.woff2",
]
for (const font of requiredFonts) {
  const source = path.join(fontsRoot, font)
  requirePath(source, `RAMS font ${font}`)
  await cp(source, path.join(fontsDestination, font))
}

const escapeHtml = (value) => String(value).replace(
  /[&<>"']/gu,
  (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character],
)

const summarize = (markdown) => {
  const text = teCuentoMarkdownToPlainText(markdown)
  if (text.length <= 158) return text
  const clipped = text.slice(0, 158)
  const boundary = clipped.lastIndexOf(" ")
  return `${clipped.slice(0, boundary > 110 ? boundary : 158).trim()}…`
}

const replaceTag = (html, pattern, replacement) => {
  if (!pattern.test(html)) throw new Error(`Cloudflare story shell is missing ${pattern}`)
  return html.replace(pattern, replacement)
}

const [shell, corpus, sceneData, mediaData, deployment] = await Promise.all([
  readFile(path.join(distRoot, "index.html"), "utf8"),
  readFile(path.join(payloadRoot, "data/corpus.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "data/story-scenes.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "data/story-media.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "src/generated-content.json"), "utf8").then(JSON.parse),
])
const scenesBySlug = new Map(sceneData.entries.map((entry) => [entry.slug, entry.scenes]))
const mediaBySlug = new Map(mediaData.entries.map((entry) => [entry.slug, entry]))
const canonicalRoot = "https://cuentos.ar"
const optimizedImageSources = (value) => ({
  avif: value.replace(/\.png(?=$|[?#])/iu, ".avif"),
  webp: value.replace(/\.png(?=$|[?#])/iu, ".webp"),
})

for (const story of corpus.entries) {
  const markdown = await readFile(
    path.join(payloadRoot, story.file.replace(/^\.\//u, "")),
    "utf8",
  )
  const form = story.form ?? "cuento"
  const scenes = scenesBySlug.get(story.slug) ?? []
  const media = mediaBySlug.get(story.slug) ?? null
  const canonicalSlug = encodeStorySlug(story.slug)
  const storyUrl = `${canonicalRoot}/relatos/${canonicalSlug}`
  const title = `${story.title} — ${deployment.content.title}`
  const description = summarize(markdown)
  const datePublished = story.date.slice(0, 10)
  const illustrationVariant = story.illustrationVariant ?? "ink"
  const illustrationPath = story.illustrations[illustrationVariant]
  if (!illustrationPath) {
    throw new Error(`Missing illustration for ${story.slug}/${illustrationVariant}`)
  }
  const illustration = `/lab/te-cuento-una-historia/${illustrationPath.replace(/^\.\//u, "")}`
  const illustrationSources = optimizedImageSources(illustration)
  const articleBody = renderTeCuentoMarkdown(
    markdown,
    { form, scenes, media },
    { mediaOrigin: canonicalRoot, storyRouteBase: canonicalRoot },
  )
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${storyUrl}#article`,
    headline: story.title,
    description,
    url: storyUrl,
    mainEntityOfPage: storyUrl,
    datePublished,
    inLanguage: deployment.content.inLanguage,
    articleSection: form,
    image: `${canonicalRoot}${illustrationSources.avif}`,
    author: {
      "@type": "Person",
      name: deployment.identity.brandName,
      url: deployment.identity.brandUrl,
    },
    isPartOf: {
      "@type": "CreativeWork",
      name: deployment.content.title,
      url: `${canonicalRoot}/`,
    },
  }
  const serverArticle = `<main lang="${escapeHtml(deployment.content.inLanguage)}" style="min-height:100vh;padding:32px;background:#120b07;color:#211913">
  <article style="max-width:760px;margin:0 auto;padding:clamp(28px,6vw,72px);border-radius:8px;background:#f0e8d8">
    <a href="/" style="color:#6d2c26">${escapeHtml(deployment.content.interfaceCopy.readerCloseLabel)}</a>
    <time datetime="${datePublished}" style="display:block;margin:36px 0 12px;color:#735b43">${datePublished}</time>
    <h1>${escapeHtml(story.title)}</h1>
    <picture>
      <source srcset="${illustrationSources.avif}" type="image/avif" />
      <img src="${illustrationSources.webp}" alt="${escapeHtml(story.illustrationAlt ?? `Ilustración de ${story.title}`)}" width="1120" height="1400" loading="eager" decoding="async" style="display:block;width:100%;height:auto;max-height:520px;object-fit:contain;margin:32px 0" />
    </picture>
    <div>${articleBody}</div>
  </article>
</main>`

  let storyHtml = shell
  storyHtml = replaceTag(storyHtml, /<title>[\s\S]*?<\/title>/u, `<title>${escapeHtml(title)}</title>`)
  storyHtml = replaceTag(storyHtml, /<meta name="description" content="[^"]*" \/>/u, `<meta name="description" content="${escapeHtml(description)}" />`)
  storyHtml = replaceTag(storyHtml, /<link rel="canonical" href="[^"]*" \/>/u, `<link rel="canonical" href="${storyUrl}" />`)
  storyHtml = replaceTag(storyHtml, /<meta property="og:type" content="[^"]*" \/>/u, '<meta property="og:type" content="article" />')
  storyHtml = replaceTag(storyHtml, /<meta property="og:title" content="[^"]*" \/>/u, `<meta property="og:title" content="${escapeHtml(title)}" />`)
  storyHtml = replaceTag(storyHtml, /<meta property="og:description" content="[^"]*" \/>/u, `<meta property="og:description" content="${escapeHtml(description)}" />`)
  storyHtml = replaceTag(storyHtml, /<meta property="og:url" content="[^"]*" \/>/u, `<meta property="og:url" content="${storyUrl}" />`)
  storyHtml = replaceTag(storyHtml, /<meta name="twitter:title" content="[^"]*" \/>/u, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
  storyHtml = replaceTag(storyHtml, /<meta name="twitter:description" content="[^"]*" \/>/u, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
  storyHtml = replaceTag(
    storyHtml,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/u,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</gu, "\\u003c")}</script>`,
  )
  storyHtml = replaceTag(
    storyHtml,
    /<div id="root">[\s\S]*<\/div>\s*<\/body>/u,
    `<div id="root">${serverArticle}</div>\n  </body>`,
  )

  const storyDirectory = path.join(
    distRoot,
    "relatos",
    decodeStorySlug(story.slug),
  )
  await mkdir(storyDirectory, { recursive: true })
  await writeFile(path.join(storyDirectory, "index.html"), storyHtml, "utf8")
}

const notFoundHtml = `<!doctype html>
<html lang="${escapeHtml(deployment.content.inLanguage)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex, follow" />
    <meta name="theme-color" content="#120b07" />
    <title>404 — ${escapeHtml(deployment.content.title)}</title>
  </head>
  <body style="min-height:100vh;margin:0;display:grid;place-items:center;background:#120b07;color:#f0e8d8;font-family:Georgia,serif">
    <main style="max-width:36rem;padding:2rem;text-align:center">
      <p style="font-family:Arial,sans-serif;letter-spacing:.16em">404</p>
      <h1>${escapeHtml(deployment.content.title)}</h1>
      <a href="/" style="color:#f0e8d8">${escapeHtml(deployment.content.interfaceCopy.readerCloseLabel)}</a>
    </main>
  </body>
</html>
`
await writeFile(path.join(distRoot, "404.html"), notFoundHtml, "utf8")

async function countFiles(root) {
  let count = 0
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name)
    count += entry.isDirectory() ? await countFiles(target) : 1
  }
  return count
}

async function largestFile(root) {
  let largest = { bytes: 0, path: "" }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) {
      const nested = await largestFile(target)
      if (nested.bytes > largest.bytes) largest = nested
    } else {
      const details = await stat(target)
      if (details.size > largest.bytes) {
        largest = { bytes: details.size, path: target }
      }
    }
  }
  return largest
}

const fileCount = await countFiles(distRoot)
const largest = await largestFile(distRoot)
const maxFiles = 20_000
const maxFileBytes = 25 * 1024 * 1024

if (fileCount > maxFiles) {
  throw new Error(`Cloudflare Free asset limit exceeded: ${fileCount}/${maxFiles}`)
}
if (largest.bytes > maxFileBytes) {
  throw new Error(
    `Cloudflare Free file limit exceeded: ${largest.path} is ${largest.bytes} bytes`,
  )
}

console.log(
  `Cloudflare static bundle verified: ${fileCount} files; largest ${largest.bytes} bytes`,
)
