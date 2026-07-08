import type { Metadata } from "next";
import Link from "next/link";

import {
  LAB_URL,
  getLabExperiment,
  labSocialImages,
} from "@/lib/lab-content";

import { WordmarkStage } from "./components/wordmark-stage";
import styles from "./shader-experiment.module.css";

const PAGE_URL = `${LAB_URL}/shader-experiment-01`;
const content = getLabExperiment("shader-experiment-01");

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const metadata: Metadata = {
  title: content.metadataTitle,
  description: content.description,
  keywords: content.keywords,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    siteName: "Lab by PabloZarate™",
    type: "website",
    images: [
      {
        url: labSocialImages.openGraph,
        width: 1280,
        height: 746,
        alt: labSocialImages.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metadataTitle,
    description: content.description,
    images: [labSocialImages.twitter],
  },
};

export default function ShaderExperimentPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: content.metadataTitle,
    headline: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    inLanguage: "en",
    creator: {
      "@type": "Person",
      name: "Pablo Zarate",
      alternateName: "PabloZarate™",
      url: "https://pablozarate.com",
    },
    isPartOf: {
      "@type": "CollectionPage",
      name: "PabloZarate™ Lab",
      url: "https://lab.pablozarate.com",
    },
    keywords: [
      "WebGL",
      "shader",
      "typography",
      "interface design",
      "digital experience design",
    ],
  };

  return (
    <main className={styles.page} data-theme="dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {"\n"}
      <section className={styles.intro} aria-labelledby="shader-experiment-title">
        <h1 id="shader-experiment-title" className={styles.title}>
          {content.title}
        </h1>
        <p>{content.serverContext}</p>
      </section>
      {"\n"}

      <WordmarkStage />

      <footer className={styles.footer}>
        <span className={styles.footerCredit}>
          {content.footerCreditPrefix}{" "}
          <span className={styles.footerWordmark}>
            <span className={styles.footerWordmarkName}>PabloZarate</span>
            <span className={styles.footerWordmarkMark} aria-hidden="true">
              ™
            </span>
          </span>
        </span>
        <Link className={styles.backLink} href="/">
          {content.backLabel}
        </Link>
      </footer>
    </main>
  );
}
