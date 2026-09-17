import type { Metadata } from "next";

import galaxy from "@/content/data/synapsis/galaxy.json";
import { LAB_URL } from "@/lib/lab-content";
import {
  buildLabCreativeWorkStructuredData,
  buildLabSiteName,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo";

import { GalaxyStage } from "./components/galaxy-stage";
import { computeLayout, type GalaxyData } from "./layout-engine";
import styles from "./synapsis.module.css";

const PAGE_URL = `${LAB_URL}/synapsis`;
const SOCIAL_IMAGE_URL = `${PAGE_URL}/opengraph-image.png`;

const graphData = galaxy as GalaxyData;
const pageMetadata = graphData.metadata;
const {
  language: siteLanguage,
  brandName,
  homeUrl,
} = getCanonicalIdentityLabels();

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
      url: SOCIAL_IMAGE_URL,
      width: 2400,
      height: 1260,
      alt: "Synapsis by PabloZarate™ — Everything is connected",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageMetadata.metadataTitle,
    description: pageMetadata.description,
    images: [{
      url: SOCIAL_IMAGE_URL,
      alt: "Synapsis by PabloZarate™ — Everything is connected",
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

      <GalaxyStage
        data={data}
        layout={layout}
        authorName={brandName}
        authorUrl={homeUrl}
      />
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
