export const escapeServerHtml = (value) => String(value).replace(
  /[&<>"']/gu,
  (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character],
)

export function renderServerAuthorMarkup(deployment) {
  const { content, identity, socialLinks } = deployment
  const copy = content.interfaceCopy
  const credits = content.credits
  const socialItems = socialLinks.map((link) => `
      <li><a href="${escapeServerHtml(link.href)}">${escapeServerHtml(link.label)}</a></li>`).join("")

  return `<footer style="max-width:760px;margin:32px auto 0;padding:28px;color:#f0e8d8;font-family:Arial,sans-serif;line-height:1.5">
  <p>${escapeServerHtml(copy.logoCreditPrefix)} <a rel="author" href="${escapeServerHtml(identity.brandUrl)}" style="color:inherit">${escapeServerHtml(identity.brandName)}</a></p>
  <section aria-labelledby="server-credits-title">
    <h2 id="server-credits-title">${escapeServerHtml(credits.title)}</h2>
    <h3>${escapeServerHtml(credits.musicHeading)}</h3>
    <p>${escapeServerHtml(credits.musicBody)}</p>
    <p>${escapeServerHtml(credits.periodLabel)}</p>
    <nav aria-labelledby="server-social-title">
      <h3 id="server-social-title">${escapeServerHtml(credits.socialHeading)}</h3>
      <ul>${socialItems}
      </ul>
    </nav>
  </section>
</footer>`
}
