import assert from "node:assert/strict"
import test from "node:test"

import {
  renderServerStoryIndex,
  renderServerStoryIndexLink,
} from "../cloudflare/scripts/server-story-index-markup.mjs"

const deployment = {
  content: {
    inLanguage: "es",
    interfaceCopy: {
      storyIndexTitle: "Relatos & escenas",
      storyIndexLabel: "Leer todos <los relatos>",
      storyIndexDescription: "Archivo completo",
      storyIndexBackLabel: "Volver",
      logoCreditPrefix: "Escrito por",
    },
    credits: {
      title: "Créditos",
      musicHeading: "Música",
      musicBody: "Notas",
      periodLabel: "2006 — 2013",
      socialHeading: "Encontrame en",
    },
  },
  identity: {
    brandName: "PabloZarate™",
    brandUrl: "https://pablozarate.com",
  },
  socialLinks: [],
}

test("links the server home to the story archive", () => {
  const html = renderServerStoryIndexLink(deployment)
  assert.match(html, /href="\/relatos"/u)
  assert.match(html, /Leer todos &lt;los relatos&gt;/u)
})

test("renders every story as a crawlable dated link", () => {
  const html = renderServerStoryIndex(
    deployment,
    [
      { slug: "uno", title: "Uno & dos", date: "2006-10-09T00:00:00.000Z" },
      { slug: "buenas-noches-%C2%BFcomo-le-va", title: "Buenas noches", date: "2007-01-02" },
    ],
    "https://cuentos.ar",
  )

  assert.match(html, /<h1>Relatos &amp; escenas<\/h1>/u)
  assert.match(html, /href="https:\/\/cuentos\.ar\/relatos\/uno"/u)
  assert.match(html, /href="https:\/\/cuentos\.ar\/relatos\/buenas-noches-%C2%BFcomo-le-va"/u)
  assert.match(html, /<time datetime="2006-10-09"/u)
  assert.equal(html.match(/<li /gu)?.length, 2)
})
