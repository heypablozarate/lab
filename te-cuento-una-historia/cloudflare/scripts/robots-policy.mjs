const allowedAiCrawlers = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "PerplexityBot",
]

export function buildRobotsPolicy(canonicalUrl) {
  return [
    "User-agent: *",
    "Allow: /",
    "Content-Signal: ai-train=no, search=yes, ai-input=yes",
    "",
    ...allowedAiCrawlers.flatMap((crawler) => [
      `User-agent: ${crawler}`,
      "Allow: /",
      "",
    ]),
    `Sitemap: ${canonicalUrl}sitemap.xml`,
    "",
  ].join("\n")
}
