import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  contentRoot,
  deploymentRoot,
  payloadRoot,
  preparedPublicRoot,
  projectRoot,
  requirePath,
} from "./paths.mjs"
import { teCuentoMarkdownToPlainText } from "../../../../../lib/te-cuento-story-markdown.ts"

const CANONICAL_URL = "https://cuentos.ar/"
const SLUG = "te-cuento-una-historia"

await Promise.all([
  rm(deploymentRoot, { recursive: true, force: true }),
  rm(path.join(projectRoot, "dist"), { recursive: true, force: true }),
  rm(path.join(projectRoot, "generated-public"), {
    recursive: true,
    force: true,
  }),
  rm(path.join(projectRoot, "index.html"), { force: true }),
])
await mkdir(deploymentRoot, { recursive: true })

const labPath = path.join(contentRoot, "lab.json")
const sitePath = path.join(contentRoot, "site.json")
const corpusPath = path.join(payloadRoot, "data/corpus.json")
requirePath(labPath, "Lab content")
requirePath(sitePath, "Site content")
requirePath(corpusPath, "Story corpus")

const [lab, site, corpus] = await Promise.all(
  [labPath, sitePath, corpusPath].map(async (file) =>
    JSON.parse(await readFile(file, "utf8")),
  ),
)

const content = lab.experiments?.[SLUG]
if (!content) throw new Error(`Missing Lab experiment content for ${SLUG}`)

const deployment = {
  content,
  identity: {
    brandName: site.identity.brandName,
    brandUrl: site.siteUrl,
  },
  socialLinks: site.socialLinks,
}

const generatedContentPath = path.join(
  projectRoot,
  "src/generated-content.json",
)
await mkdir(path.dirname(generatedContentPath), { recursive: true })
await writeFile(
  generatedContentPath,
  `${JSON.stringify(deployment, null, 2)}\n`,
  "utf8",
)

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  )

const project = lab.projects.find((entry) => entry.slug === SLUG)
if (!project) throw new Error(`Missing Lab project record for ${SLUG}`)

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  name: content.title,
  description: content.description,
  abstract: content.serverContext,
  url: CANONICAL_URL,
  inLanguage: content.inLanguage,
  keywords: content.keywords,
  dateCreated: content.dateCreated,
  isBasedOn: content.isBasedOn,
  author: {
    "@type": "Person",
    name: site.identity.agentName,
    url: site.siteUrl,
  },
  creator: {
    "@type": "Person",
    name: site.identity.agentName,
    url: site.siteUrl,
  },
}

const substitutions = {
  LANG: content.inLanguage,
  TITLE: content.title,
  METADATA_TITLE: content.metadataTitle,
  DESCRIPTION: content.description,
  SERVER_CONTEXT: content.serverContext,
  IMAGE_ALT: content.socialImages.alt,
  JSON_LD: JSON.stringify(jsonLd).replace(/</gu, "\\u003c"),
}

let html = await readFile(
  path.join(projectRoot, "index.template.html"),
  "utf8",
)
for (const [key, value] of Object.entries(substitutions)) {
  html = html.replaceAll(
    `{{${key}}}`,
    key === "JSON_LD" ? value : escapeHtml(value),
  )
}
const viteEntryPath = path.join(projectRoot, "src/main.tsx")
html = html.replace(
  'src="/src/main.tsx"',
  `src="/@fs/${viteEntryPath}"`,
)
await writeFile(path.join(deploymentRoot, "index.html"), html, "utf8")

const publicRoot = preparedPublicRoot
await mkdir(publicRoot, { recursive: true })

const robots = [
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${CANONICAL_URL}sitemap.xml`,
  "",
].join("\n")

const sitemapUrls = [
  CANONICAL_URL,
  ...corpus.entries.map(
    (story) => `${CANONICAL_URL}relatos/${encodeURIComponent(story.slug)}`,
  ),
]
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls.flatMap((url) => [
    "  <url>",
    `    <loc>${url}</loc>`,
    "  </url>",
  ]),
  "</urlset>",
  "",
].join("\n")

const storySummaries = await Promise.all(
  corpus.entries.map(async (story) => {
    const markdown = await readFile(
      path.join(payloadRoot, story.file.replace(/^\.\//u, "")),
      "utf8",
    )
    const text = teCuentoMarkdownToPlainText(markdown)
    const clipped = text.length <= 180 ? text : `${text.slice(0, 179).trimEnd()}…`
    return {
      title: story.title,
      url: `${CANONICAL_URL}relatos/${encodeURIComponent(story.slug)}`,
      summary: clipped,
    }
  }),
)

const llms = [
  `# ${content.title}`,
  "",
  content.description,
  "",
  `Canonical: ${CANONICAL_URL}`,
  `Language: ${content.inLanguage}`,
  `Period: ${content.credits.periodLabel}`,
  "",
  content.serverContext,
  "",
  ...storySummaries.flatMap((story) => [
    `## ${story.title}`,
    story.url,
    story.summary,
    "",
  ]),
].join("\n")

const headers = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
  "",
  "/lab/te-cuento-una-historia/assets/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
].join("\n")

const redirects = [
  "/te-cuento-una-historia / 308",
  "/lab/te-cuento-una-historia / 308",
  "",
].join("\n")

await Promise.all([
  writeFile(path.join(publicRoot, "robots.txt"), robots, "utf8"),
  writeFile(path.join(publicRoot, "sitemap.xml"), sitemap, "utf8"),
  writeFile(path.join(publicRoot, "llms.txt"), llms, "utf8"),
  writeFile(path.join(publicRoot, "_headers"), headers, "utf8"),
  writeFile(path.join(publicRoot, "_redirects"), redirects, "utf8"),
])
