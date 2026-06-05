import type { Metadata } from "next";
import Link from "next/link";

import { WordmarkStage } from "./components/wordmark-stage";
import styles from "./shader-experiment.module.css";

const PAGE_URL = "https://lab.pablozarate.com/shader-experiment-01";
const PAGE_TITLE = "Shader Experiment 01 — WebGL Typography Lab by PabloZarate™";
const PAGE_DESCRIPTION =
  "Interactive WebGL wordmark experiment by Pablo Zarate exploring shader motion, typography, interface craft, and technology-led digital experience design.";

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "WebGL typography",
    "shader experiment",
    "digital experience design",
    "interface craft",
    "Pablo Zarate",
    "PabloZarate Lab",
  ],
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "Lab by PabloZarate™",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function ShaderExperimentPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: PAGE_TITLE,
    headline: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
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
      name: "PabloZarate Lab",
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
      <h1 className={styles.srOnly}>Shader Experiment 01</h1>

      <WordmarkStage />

      <footer className={styles.footer}>
        <span className={styles.footerCredit}>
          Designed by{" "}
          <span className={styles.footerWordmark}>
            <span className={styles.footerWordmarkName}>PabloZarate</span>
            <span className={styles.footerWordmarkMark} aria-hidden="true">
              ™
            </span>
          </span>
        </span>
        <Link className={styles.backLink} href="/lab">
          Back to the Lab
        </Link>
      </footer>
    </main>
  );
}
