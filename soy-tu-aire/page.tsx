import type { Metadata } from "next"

import {
  LAB_URL,
  getLabExperiment,
  labSocialImages,
} from "@/lib/lab-content"
import {
  buildLabCreativeWorkStructuredData,
  buildLabSiteName,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo"

import { Stage } from "./components/stage"
import styles from "./soy-tu-aire.module.css"

const PAGE_URL = `${LAB_URL}/soy-tu-aire`
const content = getLabExperiment("soy-tu-aire")
const publicContent = {
  ...content,
  introParagraphs: content.introParagraphs.map((paragraph) =>
    paragraph
      .replaceAll("{appleMusicLabel}", content.appleMusicLabel)
      .replaceAll("{originalAgencyLabel}", content.originalAgencyLabel),
  ),
}

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
    siteName: buildLabSiteName(),
    type: "website",
    images: [{ url: labSocialImages.openGraph, width: 1280, height: 746, alt: labSocialImages.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metadataTitle,
    description: content.description,
    images: [{ url: labSocialImages.twitter, alt: labSocialImages.alt }],
  },
}

export default function SoyTuAirePage() {
  const { brandName } = getCanonicalIdentityLabels()
  const jsonLd = buildLabCreativeWorkStructuredData({
    name: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    inLanguage: content.inLanguage,
    dateCreated: content.dateCreated,
    isBasedOn: content.isBasedOn,
  })

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

      <Stage brandName={brandName} content={publicContent} />
    </main>
  )
}
