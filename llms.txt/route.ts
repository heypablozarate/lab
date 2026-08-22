import {
  LAB_URL,
  getLabProjectUrl,
  labHome,
  labPositioning,
  labContent,
  projects,
} from "@/lib/lab-content";
import { buildLabOwnershipNote } from "@/lib/lab-seo";
import { getTeCuentoStories, TE_CUENTO_PUBLIC_URL } from "@/lib/te-cuento-stories";

export const revalidate = 3600;

export async function GET() {
  const copy = labContent.publicDocuments.llms;
  const lines = [
    `# ${labHome.title}`,
    "",
    labHome.description,
    "",
    `## ${copy.interpretationHeading}`,
    `- ${labPositioning.agentGuidance}`,
    `- ${copy.topicsTemplate.replace("{topics}", labPositioning.topics.join(", "))}`,
    `- ${buildLabOwnershipNote()}`,
    "",
    `## ${copy.canonicalUrlsHeading}`,
    `- ${copy.labHomeLabel}: ${LAB_URL}/`,
    `- ${copy.sitemapLabel}: ${LAB_URL}/sitemap.xml`,
    `- ${copy.robotsLabel}: ${LAB_URL}/robots.txt`,
    `- ${copy.publicApiLabel}: https://pablozarate.com/api/public/lab`,
    "",
    `## ${copy.experimentsHeading}`,
    ...projects.flatMap((project) => {
      const storyLines = project.slug === "te-cuento-una-historia"
        ? getTeCuentoStories().flatMap((story) => [
          `#### ${story.title}`,
          `- ${copy.urlLabel}: ${TE_CUENTO_PUBLIC_URL}/relatos/${story.slug}`,
          `- ${copy.summaryLabel}: ${story.description}`,
          "",
        ])
        : [];
      return [
        `### ${project.title}`,
        `- ${copy.urlLabel}: ${getLabProjectUrl(project)}`,
        `- ${copy.yearLabel}: ${project.year}`,
        `- ${copy.typeLabel}: ${project.kind}`,
        `- ${copy.summaryLabel}: ${project.description}`,
        `- ${copy.topicsLabel}: ${project.tags.join(", ")}`,
        "",
        ...storyLines,
      ];
    }),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": copy.inLanguage,
    },
  });
}
