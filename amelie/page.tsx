import type { Metadata } from "next"

import {
  LAB_URL,
  getLabExperiment,
} from "@/lib/lab-content"

import styles from "./amelie.module.css"

const PAGE_URL = `${LAB_URL}/amelie`
const content = getLabExperiment("amelie")

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
    images: [{ url: "/lab/amelie/assets/og.jpg", width: 1200, height: 630, alt: content.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metadataTitle,
    description: content.description,
    images: ["/lab/amelie/assets/og.jpg"],
  },
}

export default function AmeliePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: content.metadataTitle,
    headline: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    inLanguage: "es",
    dateCreated: "2004",
    creator: {
      "@type": "Person",
      name: "Pablo Zarate",
      alternateName: "PabloZarate™",
      url: "https://pablozarate.com",
      jobTitle: "Design Manager, Product Specialist",
      knowsAbout: ["Design Engineering", "AI Design", "Product Design", "Experience Design"],
    },
    isBasedOn: "Mundo Amélie — student project, Escuela Da Vinci (2004)",
    isPartOf: { "@type": "CollectionPage", name: "PabloZarate™ Lab", url: "https://lab.pablozarate.com" },
  }

  return (
    <main className={styles.page} data-theme="dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {"\n"}
      <section className={styles.serverContext} aria-labelledby="amelie-server-title">
        <h1 id="amelie-server-title">{content.title}</h1>
        <p>{content.serverContext}</p>
      </section>
      {"\n"}

      <iframe
        className={styles.frame}
        src="/lab/amelie/index.html"
        title={content.title}
        allow="autoplay; fullscreen"
      />
    </main>
  )
}
