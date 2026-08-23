export type TeCuentoStoryScene = {
  id: string
  anchor: string
  src: string
  alt: string
}

export type TeCuentoStoryMedia = {
  anchor: string
  youtubeId: string
  title: string
} | null

export type TeCuentoRenderableStory = {
  form: string
  scenes: TeCuentoStoryScene[]
  media: TeCuentoStoryMedia
}

type MarkdownOptions = {
  mediaOrigin?: string
  storyRouteBase?: string
}

type ListItem = {
  kind: "ordered" | "unordered"
  start?: number
  indent: number
  content: string
}

export function escapeTeCuentoHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character)
}

function normalizeRouteBase(value: string) {
  if (/^https?:\/\//u.test(value)) return value.replace(/\/$/u, "")
  const normalized = value.startsWith("/") ? value : `/${value}`
  return normalized === "/" ? "" : normalized.replace(/\/$/u, "")
}

function inlineMarkdown(value: string, storyRouteBase: string) {
  const routeBase = normalizeRouteBase(storyRouteBase)
  return escapeTeCuentoHtml(value)
    .replace(
      /\[([^\]]+)\]\(story:([a-z0-9%_-]+)\)/gu,
      `<a href="${routeBase}/relatos/$2" data-story-link="$2">$1</a>`,
    )
    .replace(/\*\*([\s\S]+?)\*\*/gu, "<strong>$1</strong>")
    .replace(/\*([\s\S]+?)\*/gu, "<em>$1</em>")
}

function mediaHtml(media: NonNullable<TeCuentoStoryMedia>, mediaOrigin: string) {
  const title = escapeTeCuentoHtml(media.title)
  const youtubeId = escapeTeCuentoHtml(media.youtubeId)
  const origin = encodeURIComponent(mediaOrigin)
  return `<figure class="reader-media" data-story-media="${youtubeId}">
    <div class="reader-media-frame">
      <iframe src="https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&amp;enablejsapi=1&amp;playsinline=1&amp;origin=${origin}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
    <figcaption>${title}</figcaption>
  </figure>`
}

function parseListItem(value: string): ListItem | null {
  const ordered = value.trim().match(/^(\d+)\.\s+([\s\S]+)$/u)
  if (ordered) {
    return {
      kind: "ordered",
      start: Number(ordered[1]),
      indent: 0,
      content: ordered[2],
    }
  }
  const unordered = value.match(/^([\t ]*)-\s+([\s\S]+)$/u)
  if (!unordered) return null
  const indent = [...unordered[1]].reduce(
    (total, character) => total + (character === "\t" ? 4 : 1),
    0,
  )
  return { kind: "unordered", indent, content: unordered[2] }
}

function renderList(items: ListItem[], storyRouteBase: string) {
  if (items.every((item) => item.kind === "ordered")) {
    const startValue = items[0]?.start ?? 1
    const start = startValue === 1 ? "" : ` start="${startValue}"`
    return `<ol class="story-list story-list--ordered"${start}>${items
      .map((item) => `<li>${inlineMarkdown(item.content, storyRouteBase)}</li>`)
      .join("")}</ol>`
  }

  const noteItems = items.map((item) => item.content.match(/^(\d+)\.\s+([\s\S]+)$/u))
  if (noteItems.every(Boolean)) {
    const startValue = Number(noteItems[0]?.[1] ?? 1)
    const start = startValue === 1 ? "" : ` start="${startValue}"`
    return `<ol class="story-notes"${start}>${noteItems
      .map((item) => `<li>${inlineMarkdown(item?.[2] ?? "", storyRouteBase)}</li>`)
      .join("")}</ol>`
  }

  const baseIndent = Math.min(...items.map((item) => item.indent))
  let html = '<ul class="story-list story-list--unordered">'
  let parentOpen = false
  let nestedOpen = false
  for (const item of items) {
    const nested = item.indent > baseIndent
    if (!nested) {
      if (nestedOpen) {
        html += "</ul>"
        nestedOpen = false
      }
      if (parentOpen) html += "</li>"
      html += `<li>${inlineMarkdown(item.content, storyRouteBase)}`
      parentOpen = true
      continue
    }
    if (!parentOpen) {
      html += "<li>"
      parentOpen = true
    }
    if (!nestedOpen) {
      html += '<ul class="story-list story-list--nested">'
      nestedOpen = true
    }
    html += `<li>${inlineMarkdown(item.content, storyRouteBase)}</li>`
  }
  if (nestedOpen) html += "</ul>"
  if (parentOpen) html += "</li>"
  return `${html}</ul>`
}

export function renderTeCuentoMarkdown(
  markdown: string,
  story: TeCuentoRenderableStory,
  options: MarkdownOptions = {},
) {
  const storyRouteBase = options.storyRouteBase ?? "/lab/te-cuento-una-historia"
  const mediaOrigin = options.mediaOrigin ?? "https://lab.pablozarate.com"
  const content = markdown
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/^# .*$/mu, "")
    .trim()
  const scenesByAnchor = new Map(story.scenes.map((scene) => [scene.anchor, scene]))
  const blocks = content.split(/\n\s*\n/u).flatMap((block) => {
    const lines = block.split("\n")
    return lines.length > 1 && lines.every((line) => parseListItem(line)) ? lines : [block]
  })
  let html = ""
  let openingAssigned = false

  const paragraphHtml = (paragraph: string) => {
    const raw = paragraph.trim()
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean)
    const dialogue = lines.some((line) => line.startsWith("—"))
    const verse = story.form === "poema"
      || (lines.length > 1 && lines.every((line) => /^\*[^*]+\*$/u.test(line)))
      || (lines.length > 1 && /^\*[\s\S]+\*$/u.test(raw))
    const preserveLineBreaks = verse
      || ["diálogo", "escena", "prosa poética"].includes(story.form)
      || lines.filter((line) => line.startsWith("—")).length > 1
    const normalized = preserveLineBreaks ? raw : lines.join(" ")
    const speaker = ["diálogo", "escena"].includes(story.form)
      ? normalized.match(/^([\p{L}][\p{L}\s.]{0,24}:)\s+([\s\S]+)$/u)
      : null
    const opening = !openingAssigned
      && !dialogue
      && !speaker
      && !["diálogo", "poema", "escena"].includes(story.form)
      && raw.length >= 80
      && /^\p{L}/u.test(raw)
    if (opening) openingAssigned = true
    const classes = [
      "story-paragraph",
      dialogue ? "story-dialogue" : "",
      speaker ? "story-speaker-line" : "",
      verse ? "story-verse" : "",
      opening ? "story-opening" : "",
    ].filter(Boolean).join(" ")
    const body = speaker
      ? `<strong class="story-speaker">${inlineMarkdown(speaker[1], storyRouteBase)}</strong> ${inlineMarkdown(speaker[2], storyRouteBase)}`
      : inlineMarkdown(normalized, storyRouteBase)
    return `<p class="${classes}">${body.replace(/\n/g, "<br />")}</p>`
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const paragraph = blocks[index]
    const item = parseListItem(paragraph)
    if (item) {
      const items = [item]
      while (index + 1 < blocks.length) {
        const next = parseListItem(blocks[index + 1])
        if (!next || next.kind !== item.kind) break
        items.push(next)
        index += 1
      }
      html += renderList(items, storyRouteBase)
      continue
    }
    const heading = paragraph.trim().match(/^###\s+(.+)$/u)
    if (heading) {
      const label = heading[1].trim()
      const scene = scenesByAnchor.get(label)
      const sceneAttribute = scene ? ` data-scene-id="${escapeTeCuentoHtml(scene.id)}"` : ""
      const kind = scene
        ? "scene"
        : (/^[IVXLCDM]+(?:\s+[—-]|$)/u.test(label) ? "roman" : "descriptive")
      html += `<h2 class="story-section story-section--${kind}"${sceneAttribute}>${inlineMarkdown(label, storyRouteBase)}</h2>`
      continue
    }
    const dotHeading = paragraph.trim().match(/^\*\*·\s*(.+?)\*\*$/u)
    if (dotHeading) {
      html += `<h2 class="story-section story-section--descriptive">${inlineMarkdown(dotHeading[1], storyRouteBase)}</h2>`
      continue
    }
    if (paragraph.trim() === "Comentario del autor:") {
      const note: string[] = []
      while (index + 1 < blocks.length && !/^---$/u.test(blocks[index + 1].trim())) {
        note.push(blocks[index + 1])
        index += 1
      }
      html += '<aside class="story-author-note" aria-label="Comentario del autor"><p class="story-note-label">Comentario del autor</p>'
      html += note
        .map((value) => `<p>${inlineMarkdown(value.trim(), storyRouteBase).replace(/\n/g, "<br />")}</p>`)
        .join("")
      html += "</aside>"
      continue
    }
    if (/^---$/u.test(paragraph.trim())) {
      html += "<hr />"
      continue
    }
    const quoteLines = paragraph.split("\n")
    if (quoteLines.every((line) => /^>\s?/u.test(line))) {
      html += `<blockquote>${inlineMarkdown(
        quoteLines.map((line) => line.replace(/^>\s?/u, "")).join("\n"),
        storyRouteBase,
      ).replace(/\n/g, "<br />")}</blockquote>`
      continue
    }
    html += paragraphHtml(paragraph)
    if (story.media?.anchor && paragraph.includes(story.media.anchor)) {
      html += mediaHtml(story.media, mediaOrigin)
    }
  }

  return html
}

export function teCuentoMarkdownToPlainText(markdown: string) {
  return markdown
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/^# .*$/mu, "")
    .replace(/\[([^\]]+)\]\(story:[^)]+\)/gu, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
