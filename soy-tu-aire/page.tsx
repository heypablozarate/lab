import type { Metadata } from "next"

import {
  LAB_URL,
  getLabExperiment,
  labSocialImages,
} from "@/lib/lab-content"

import { Stage } from "./components/stage"
import styles from "./soy-tu-aire.module.css"

const PAGE_URL = `${LAB_URL}/soy-tu-aire`
const content = getLabExperiment("soy-tu-aire")

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export const metadata: Metadata = {
  title: content.metadataTitle,
  description: content.description,
  keywords: content.keywords,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    siteName: "Lab by PabloZarate™",
    type: "website",
    images: [{ url: labSocialImages.openGraph, width: 1280, height: 746, alt: labSocialImages.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metadataTitle,
    description: content.description,
    images: [labSocialImages.twitter],
  },
}

export default function SoyTuAirePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: content.metadataTitle,
    headline: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    inLanguage: "es",
    creator: {
      "@type": "Person",
      name: "Pablo Zarate",
      alternateName: "PabloZarate™",
      url: "https://pablozarate.com",
      jobTitle: "Design Manager, Product Specialist",
      knowsAbout: ["Design Engineering", "AI Design", "Product Design", "Experience Design"],
    },
    isBasedOn: "Soy tu aire — Labuat (Herraiz Soto & Co.)",
    isPartOf: { "@type": "CollectionPage", name: "PabloZarate™ Lab", url: "https://lab.pablozarate.com" },
  }

  return (
    <main className={styles.page} data-theme="light">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {"\n"}
      <section className={styles.serverContext} aria-labelledby="soy-tu-aire-server-title">
        <h1 id="soy-tu-aire-server-title">{content.title}</h1>
        <p>{content.serverContext}</p>
      </section>
      {"\n"}

      <Stage content={content} />
    </main>
  )
}
