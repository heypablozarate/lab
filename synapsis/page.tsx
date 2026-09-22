import type { Metadata } from "next";

import { getSynapsisContent } from "@/lib/synapsis/content";
import { projectPublicSynapsis } from "@/lib/synapsis/public-data";
import { LAB_URL } from "@/lib/lab-content";
import { getLabContent } from "@/lib/lab-content-server";
import {
  buildLabCreativeWorkStructuredData,
  buildLabSiteName,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo";

import { GalaxyStage } from "./components/galaxy-stage";
import { computeLayout } from "./layout-engine";
import styles from "./synapsis.module.css";

const PAGE_URL = `${LAB_URL}/synapsis`;
const SOCIAL_IMAGE_URL = `${LAB_URL}/lab/synapsis/opengraph-image.png`;

const {
  language: siteLanguage,
  brandName,
  homeUrl,
} = getCanonicalIdentityLabels();

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function generateMetadata(): Promise<Metadata> {
  const [pageMetadata, labContent] = await Promise.all([
    getSynapsisContent().then((value) => value.metadata),
    getLabContent(),
  ]);
  return {
  title: pageMetadata.metadataTitle,
  description: pageMetadata.description,
  keywords: pageMetadata.keywords,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: pageMetadata.metadataTitle,
    description: pageMetadata.description,
    url: PAGE_URL,
    siteName: buildLabSiteName(labContent),
    type: "website",
    images: [{
      url: SOCIAL_IMAGE_URL,
      width: 2400,
      height: 1260,
      alt: pageMetadata.metadataTitle,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageMetadata.metadataTitle,
    description: pageMetadata.description,
    images: [{
      url: SOCIAL_IMAGE_URL,
      alt: pageMetadata.metadataTitle,
    }],
  },
  };
}

export default async function SynapsisPage() {
  // Deterministic server layout; shared content cache changes after a save.
  const [synapsis, labContent] = await Promise.all([getSynapsisContent(), getLabContent()]);
  const data = projectPublicSynapsis(synapsis);
  const layout = computeLayout(data);
  const publicMetadata = data.metadata;

  const jsonLd = buildLabCreativeWorkStructuredData({
    name: publicMetadata.metadataTitle,
    description: publicMetadata.description,
    url: PAGE_URL,
    inLanguage: publicMetadata.inLanguage ?? siteLanguage,
    keywords: publicMetadata.keywords,
    labContent,
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
