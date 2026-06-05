const LAB_URL = "https://lab.pablozarate.com";

export const revalidate = 3600;

export async function GET() {
  const robots = [
    "User-agent: *",
    "Allow: /",
    "Content-Signal: ai-train=no, search=yes, ai-input=yes",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    `Sitemap: ${LAB_URL}/sitemap.xml`,
  ].join("\n");

  return new Response(robots, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
