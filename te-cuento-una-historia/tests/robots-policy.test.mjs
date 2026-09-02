import assert from "node:assert/strict"
import test from "node:test"

import { buildRobotsPolicy } from "../cloudflare/scripts/robots-policy.mjs"

const robots = buildRobotsPolicy("https://cuentos.ar/")

test("publishes the same content signal as pablozarate.com", () => {
  assert.match(
    robots,
    /^Content-Signal: ai-train=no, search=yes, ai-input=yes$/mu,
  )
})

test("explicitly allows the approved AI crawlers", () => {
  for (const crawler of [
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "PerplexityBot",
  ]) {
    assert.match(robots, new RegExp(`User-agent: ${crawler}\\nAllow: /`, "u"))
  }
})

test("keeps one wildcard group and the canonical sitemap", () => {
  assert.equal(robots.match(/^User-agent: \*$/gmu)?.length, 1)
  assert.match(robots, /^Sitemap: https:\/\/cuentos\.ar\/sitemap\.xml$/mu)
  assert.doesNotMatch(robots, /^Disallow:/mu)
})
