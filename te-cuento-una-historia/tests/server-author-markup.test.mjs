import assert from "node:assert/strict"
import test from "node:test"

import { renderServerAuthorMarkup } from "../cloudflare/scripts/server-author-markup.mjs"

const deployment = {
  content: {
    interfaceCopy: { logoCreditPrefix: "Escrito & diseñado por" },
    credits: {
      title: "Créditos",
      musicHeading: "Música",
      musicBody: "Notas < sampleadas",
      periodLabel: "2006 — 2013",
      socialHeading: "Encontrame en",
    },
  },
  identity: {
    brandName: "PabloZarate™",
    brandUrl: "https://pablozarate.com",
  },
  socialLinks: [
    { href: "https://x.com/heyPabloZarate", label: "X" },
    { href: "https://www.linkedin.com/in/pablozarate/", label: "LinkedIn" },
  ],
}

test("renders crawlable author and credit links in the server fallback", () => {
  const html = renderServerAuthorMarkup(deployment)

  assert.match(html, /<a rel="author" href="https:\/\/pablozarate\.com"/u)
  assert.match(html, /<h2 id="server-credits-title">Créditos<\/h2>/u)
  assert.match(html, /href="https:\/\/x\.com\/heyPabloZarate"/u)
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/pablozarate\/"/u)
  assert.match(html, /Escrito &amp; diseñado por/u)
  assert.match(html, /Notas &lt; sampleadas/u)
})
