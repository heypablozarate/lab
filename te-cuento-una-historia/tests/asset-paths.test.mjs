import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  encodeAssetPath,
  encodeStorySlug,
  payloadRoot,
} from "../cloudflare/scripts/paths.mjs"

test("encodes literal percent signs in asset filenames without changing story URLs", () => {
  const slug = "buenas-noches-%c2%bfcomo-le-va"
  assert.equal(
    encodeAssetPath(`./assets/stories/${slug}/ink.png`),
    "assets/stories/buenas-noches-%25c2%25bfcomo-le-va/ink.png",
  )
  assert.equal(encodeStorySlug(slug), "buenas-noches-%C2%BFcomo-le-va")
})

test("preserves ordinary asset paths and encodes each filename segment", () => {
  assert.equal(
    encodeAssetPath("./assets/stories/reflexiones-de-taxi/ink.png"),
    "assets/stories/reflexiones-de-taxi/ink.png",
  )
  const literal = "assets/stories/¿qué tal? #1/100%.png"
  assert.equal(
    encodeAssetPath(literal),
    "assets/stories/%C2%BFqu%C3%A9%20tal%3F%20%231/100%25.png",
  )
  assert.equal(decodeURIComponent(encodeAssetPath(literal)), literal)
})

test("every story illustration URL decodes to its existing PNG, AVIF and WebP file", async () => {
  const corpus = JSON.parse(await readFile(path.join(payloadRoot, "data/corpus.json"), "utf8"))
  for (const story of corpus.entries) {
    const illustration = story.illustrations[story.illustrationVariant ?? "ink"]
    assert.equal(typeof illustration, "string", story.slug)
    for (const extension of ["png", "avif", "webp"]) {
      const literal = illustration.replace(/^\.\//u, "").replace(/\.png$/u, `.${extension}`)
      const url = new URL(encodeAssetPath(literal), "https://cuentos.ar/lab/te-cuento-una-historia/")
      const decoded = decodeURIComponent(url.pathname).replace(/^\/lab\/te-cuento-una-historia\//u, "")
      assert.equal(decoded, literal, `${story.slug}/${extension}`)
      assert.ok((await stat(path.join(payloadRoot, decoded))).size > 0, `${story.slug}/${extension}`)
    }
  }
})
