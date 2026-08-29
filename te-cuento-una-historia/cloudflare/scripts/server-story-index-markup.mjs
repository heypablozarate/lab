import { escapeServerHtml, renderServerAuthorMarkup } from "./server-author-markup.mjs"

const storyUrl = (canonicalRoot, slug) =>
  `${canonicalRoot}/relatos/${encodeURIComponent(decodeURIComponent(slug))}`

export function renderServerStoryIndexLink(deployment) {
  const copy = deployment.content.interfaceCopy

  return `<nav aria-label="${escapeServerHtml(copy.storyIndexTitle)}" style="max-width:760px;margin:28px auto;padding:0 28px;font-family:Arial,sans-serif">
  <a href="/relatos" style="color:#f0e8d8">${escapeServerHtml(copy.storyIndexLabel)}</a>
</nav>`
}

export function renderServerStoryIndex(deployment, stories, canonicalRoot) {
  const copy = deployment.content.interfaceCopy
  const storyItems = stories.map((story) => {
    const published = story.date.slice(0, 10)
    return `      <li style="margin:0 0 1rem">
        <a href="${storyUrl(canonicalRoot, story.slug)}" style="color:#6d2c26">${escapeServerHtml(story.title)}</a>
        <time datetime="${published}" style="display:block;margin-top:.2rem;color:#735b43;font:14px/1.4 Arial,sans-serif">${published}</time>
      </li>`
  }).join("\n")

  return `<main lang="${escapeServerHtml(deployment.content.inLanguage)}" style="min-height:100vh;padding:32px;background:#120b07;color:#211913">
  <article style="max-width:760px;margin:0 auto;padding:clamp(28px,6vw,72px);border-radius:8px;background:#f0e8d8">
    <a href="/" style="color:#6d2c26">${escapeServerHtml(copy.storyIndexBackLabel)}</a>
    <h1>${escapeServerHtml(copy.storyIndexTitle)}</h1>
    <p>${escapeServerHtml(copy.storyIndexDescription)}</p>
    <ol style="margin:2rem 0 0;padding-left:1.5rem">
${storyItems}
    </ol>
  </article>
  ${renderServerAuthorMarkup(deployment)}
</main>`
}
