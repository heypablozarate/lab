import type { Metadata } from "next";
import Link from "next/link";

import {
  LAB_URL,
  getLabExperiment,
  labSocialImages,
} from "@/lib/lab-content";
import {
  buildCanonicalBrandWordmark,
  buildLabCreativeWorkStructuredData,
  buildLabSiteName,
} from "@/lib/lab-seo";

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
    siteName: buildLabSiteName(),
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
    images: [{ url: labSocialImages.twitter, alt: labSocialImages.alt }],
  },
};

export default function ShaderExperimentPage() {
  const jsonLd = buildLabCreativeWorkStructuredData({
    name: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    inLanguage: content.inLanguage,
    keywords: content.keywords,
  });
  const wordmark = buildCanonicalBrandWordmark();

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

      <WordmarkStage brandName={`${wordmark.name}${wordmark.mark}`} />

      <footer className={styles.footer}>
        <span className={styles.footerCredit}>
          {content.footerCreditPrefix}{" "}
          <span className={styles.footerWordmark}>
            <span className={styles.footerWordmarkName}>{wordmark.name}</span>
            <span className={styles.footerWordmarkMark} aria-hidden="true">
              {wordmark.mark}
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
