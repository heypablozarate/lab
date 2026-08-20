import type { Metadata } from "next";

import galaxy from "@/content/data/synapsis/galaxy.json";
import { LAB_URL, labSocialImages } from "@/lib/lab-content";
import {
  buildLabCreativeWorkStructuredData,
  buildLabSiteName,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo";

import { GalaxyStage } from "./components/galaxy-stage";
import { computeLayout, type GalaxyData } from "./layout-engine";
import styles from "./synapsis.module.css";

const PAGE_URL = `${LAB_URL}/synapsis`;

const graphData = galaxy as GalaxyData;
const pageMetadata = graphData.metadata;
const { language: siteLanguage } = getCanonicalIdentityLabels();

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const metadata: Metadata = {
  title: pageMetadata.metadataTitle,
  description: pageMetadata.description,
  keywords: pageMetadata.keywords,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: pageMetadata.metadataTitle,
    description: pageMetadata.description,
    url: PAGE_URL,
    siteName: buildLabSiteName(),
    type: "website",
    images: [{
      url: labSocialImages.openGraph,
      width: 1280,
      height: 746,
      alt: labSocialImages.alt,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageMetadata.metadataTitle,
    description: pageMetadata.description,
    images: [{
      url: labSocialImages.twitter,
      alt: labSocialImages.alt,
    }],
  },
};

export default function SynapsisPage() {
  // Deterministic layout, computed at build: the client only renders.
  const data = toPublicGalaxyData(graphData);
  const layout = computeLayout(data);
  const publicMetadata = data.metadata;

  const jsonLd = buildLabCreativeWorkStructuredData({
    name: publicMetadata.metadataTitle,
    description: publicMetadata.description,
    url: PAGE_URL,
    inLanguage: publicMetadata.inLanguage ?? siteLanguage,
    keywords: publicMetadata.keywords,
  });

  return (
    <main className={styles.page} lang={publicMetadata.inLanguage ?? siteLanguage}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {"\n"}
      <section className={styles.serverContext} aria-labelledby="synapsis-server-title">
        <h1 id="synapsis-server-title">{publicMetadata.title}</h1>
        <p>{publicMetadata.serverContext}</p>
      </section>
      {"\n"}

      <GalaxyStage data={data} layout={layout} />
    </main>
  );
}

function toPublicGalaxyData(data: GalaxyData): GalaxyData {
  const nodes = data.nodes.filter((node) => node.status === "active");
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = data.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {
    ...data,
    nodes,
    edges,
  };
}
