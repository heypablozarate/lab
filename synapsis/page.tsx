import type { Metadata } from "next";

import galaxy from "@/content/data/synapsis/galaxy.json";

import { GalaxyStage } from "./components/galaxy-stage";
import { computeLayout, type GalaxyData } from "./layout-engine";
import styles from "./synapsis.module.css";

const PAGE_URL = "https://lab.pablozarate.com/synapsis";
const SOCIAL_IMAGE_URL = "https://lab.pablozarate.com/lab/opengraph-image.jpg";
const TWITTER_IMAGE_URL = "https://lab.pablozarate.com/lab/twitter-image.jpg";
const DEFAULT_METADATA = {
  title: "Synapsis",
  metadataTitle: "Synapsis by PabloZarate™ — Interactive 3D Knowledge Graph",
  description:
    "A navigable 3D constellation of the topics, links, and ideas Pablo Zarate collects across platforms — hand-curated and AI-proposed connections rendered as a light-mode galaxy on paper, built with React Three Fiber and RAMS tokens.",
  serverContext:
    "Synapsis is a navigable 3D graph of the topics, links, and ideas Pablo Zarate saves across platforms, with hand-curated and AI-proposed connections. Instead of a decorative starfield, the constellation reads like a monochrome map on flat paper: RAMS design tokens, no grid texture, dsaints-inspired depth contrast, ink/paper focus states, and a subtle breathing halo around each spherical node. The layout is deterministic — node positions derive from a hash of each item's id, relevance sets distance to the center and node size, clusters share angular sectors, and edge weight pulls connected ideas together. Built with React Three Fiber on a strict rendering budget: one draw call for nodes, one for edges, and a fixed pool of typographic labels.",
  keywords: [
    "knowledge graph",
    "3D visualization",
    "React Three Fiber",
    "WebGL",
    "information design",
    "design engineering",
    "personal knowledge management",
    "Pablo Zarate",
    "PabloZarate™ Lab",
  ],
};

const graphData = galaxy as GalaxyData;
const pageMetadata = graphData.metadata ?? DEFAULT_METADATA;

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
    siteName: "Lab by PabloZarate™",
    type: "website",
    images: [{ url: SOCIAL_IMAGE_URL, width: 1280, height: 746, alt: "PabloZarate Lab intro card." }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageMetadata.metadataTitle,
    description: pageMetadata.description,
    images: [TWITTER_IMAGE_URL],
  },
};

export default function SynapsisPage() {
  // Deterministic layout, computed at build: the client only renders.
  const data = toPublicGalaxyData(graphData);
  const layout = computeLayout(data);
  const publicMetadata = data.metadata ?? DEFAULT_METADATA;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: publicMetadata.metadataTitle,
    headline: publicMetadata.metadataTitle,
    description: publicMetadata.description,
    url: PAGE_URL,
    inLanguage: "es",
    creator: {
      "@type": "Person",
      name: "Pablo Zarate",
      alternateName: "PabloZarate™",
      url: "https://pablozarate.com",
      jobTitle: "Design Manager, Product Specialist",
      knowsAbout: ["Design Engineering", "AI Design", "Product Design", "Information Design"],
    },
    isPartOf: { "@type": "CollectionPage", name: "PabloZarate™ Lab", url: "https://lab.pablozarate.com" },
    keywords: publicMetadata.keywords,
  };

  return (
    <main className={styles.page}>
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
