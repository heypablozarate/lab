import {
  LAB_URL,
  getLabProjectUrl,
} from "@/lib/lab-content";
import { getLabContent } from "@/lib/lab-content-server";
import { buildLabOwnershipNote } from "@/lib/lab-seo";

export const revalidate = 3600;

export async function GET() {
  const labContent = await getLabContent();
  const labHome = labContent.home;
  const labPositioning = labContent.positioning;
  const projects = labContent.projects;
  const copy = labContent.publicDocuments.llms;
  const lines = [
    `# ${labHome.title}`,
    "",
    labHome.description,
    "",
    `## ${copy.interpretationHeading}`,
    `- ${labPositioning.agentGuidance}`,
    `- ${copy.topicsTemplate.replace("{topics}", labPositioning.topics.join(", "))}`,
    `- ${await buildLabOwnershipNote(labContent)}`,
    "",
    `## ${copy.canonicalUrlsHeading}`,
    `- ${copy.labHomeLabel}: ${LAB_URL}/`,
    `- ${copy.sitemapLabel}: ${LAB_URL}/sitemap.xml`,
    `- ${copy.robotsLabel}: ${LAB_URL}/robots.txt`,
    `- ${copy.publicApiLabel}: https://pablozarate.com/api/public/lab`,
    "",
    `## ${copy.experimentsHeading}`,
    ...projects.flatMap((project) => [
        `### ${project.title}`,
        `- ${copy.urlLabel}: ${getLabProjectUrl(project)}`,
        `- ${copy.yearLabel}: ${project.year}`,
        `- ${copy.typeLabel}: ${project.kind}`,
        `- ${copy.summaryLabel}: ${project.description}`,
        `- ${copy.topicsLabel}: ${project.tags.join(", ")}`,
        "",
      ]),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Language": copy.inLanguage,
    },
  });
}
