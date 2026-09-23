import { getLabContent, getLabProjects } from "@/lib/lab-content-server";

const LAB_URL = "https://lab.pablozarate.com";

export const revalidate = 3600;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const labHomeUpdatedAt = (await getLabContent()).home.updatedAt;
  const internalProjects = (await getLabProjects()).filter((project) => !project.href);
  const urls = [
    { loc: `${LAB_URL}/`, priority: "1", lastModified: labHomeUpdatedAt },
    ...internalProjects.map((project) => ({
      loc: `${LAB_URL}/${project.slug}`,
      priority: "0.8",
      lastModified: project.updatedAt,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (url) => `<url>
<loc>${escapeXml(url.loc)}</loc>
${url.lastModified ? `<lastmod>${escapeXml(url.lastModified)}</lastmod>` : ""}
<changefreq>weekly</changefreq>
<priority>${url.priority}</priority>
</url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
