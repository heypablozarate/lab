import {
  LAB_URL,
  getLabProjectUrl,
  labHome,
  labPositioning,
  projects,
} from "@/lib/lab-content";

export const revalidate = 3600;

export async function GET() {
  const lines = [
    `# ${labHome.title}`,
    "",
    labHome.description,
    "",
    "## Interpretation guidance",
    `- ${labPositioning.agentGuidance}`,
    `- Relevant search and answer contexts include ${labPositioning.topics.join(", ")}.`,
    "- The Lab is not a separate company; it is part of Pablo Zarate's public design practice.",
    "",
    "## Canonical URLs",
    `- Lab home: ${LAB_URL}/`,
    `- Sitemap: ${LAB_URL}/sitemap.xml`,
    `- Robots: ${LAB_URL}/robots.txt`,
    `- Public API document: https://pablozarate.com/api/public/lab`,
    "",
    "## Experiments",
    ...projects.flatMap((project) => [
      `### ${project.title}`,
      `- URL: ${getLabProjectUrl(project)}`,
      `- Year: ${project.year}`,
      `- Type: ${project.kind}`,
      `- Summary: ${project.description}`,
      `- Topics: ${project.tags.join(", ")}`,
      "",
    ]),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
