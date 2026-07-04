import type { Metadata } from "next";

import { GalaxyStage } from "./components/galaxy-stage";
import galaxy from "./data/galaxy.dummy.json";
import { computeLayout, type GalaxyData } from "./layout-engine";
import styles from "./galaxia.module.css";

const PAGE_URL = "https://lab.pablozarate.com/galaxia-de-intereses";
const SOCIAL_IMAGE_URL = "https://lab.pablozarate.com/lab/opengraph-image.jpg";
const TWITTER_IMAGE_URL = "https://lab.pablozarate.com/lab/twitter-image.jpg";
const PAGE_TITLE = "Galaxia de Intereses — Interactive 3D Knowledge Graph by PabloZarate™";
const PAGE_DESCRIPTION =
  "A navigable 3D constellation of the topics, links, and ideas Pablo Zarate collects across platforms — hand-curated and AI-proposed connections rendered as a light-mode galaxy on paper, built with React Three Fiber and RAMS tokens.";
const SERVER_CONTEXT =
  "Galaxia de Intereses is a navigable 3D graph of the topics, links, and ideas Pablo Zarate saves across platforms, with hand-curated and AI-proposed connections. Instead of a dark starfield, the constellation lives on paper: light mode, RAMS design tokens, fog toward the page background, and a single saturated accent reserved for the active node. The layout is deterministic — node positions derive from a hash of each item's id, relevance sets distance to the center and node size, clusters share angular sectors, and edge weight pulls connected ideas together. Built with React Three Fiber on a strict rendering budget: one draw call for nodes, one for edges, and a fixed pool of typographic labels.";

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
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
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "Lab by PabloZarate™",
    type: "website",
    images: [{ url: SOCIAL_IMAGE_URL, width: 1280, height: 746, alt: "PabloZarate Lab intro card." }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [TWITTER_IMAGE_URL],
  },
};

export default function GalaxiaDeInteresesPage() {
  // Deterministic layout, computed at build: the client only renders.
  const data = galaxy as GalaxyData;
  const layout = computeLayout(data);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: PAGE_TITLE,
    headline: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
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
    keywords: ["knowledge graph", "3D visualization", "React Three Fiber", "design engineering"],
  };

  return (
    <main className={styles.page} data-theme="light">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      {"\n"}
      <section className={styles.serverContext} aria-labelledby="galaxia-server-title">
        <h1 id="galaxia-server-title">Galaxia de Intereses</h1>
        <p>{SERVER_CONTEXT}</p>
      </section>
      {"\n"}

      <GalaxyStage data={data} layout={layout} />
    </main>
  );
}
