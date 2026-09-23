import type { Metadata } from "next"

import {
  LAB_URL,
} from "@/lib/lab-content"
import { getLabContent } from "@/lib/lab-content-server"
import {
  buildLabCreativeWorkStructuredData,
  buildLabSiteName,
} from "@/lib/lab-seo"

import styles from "./amelie.module.css"

const PAGE_URL = `${LAB_URL}/amelie`
const SOCIAL_IMAGE_URL = `${PAGE_URL}/assets/og.jpg`

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export async function generateMetadata(): Promise<Metadata> {
  const labContent = await getLabContent()
  const content = labContent.experiments.amelie
  return {
  title: content.metadataTitle,
  description: content.description,
  keywords: content.keywords,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    siteName: await buildLabSiteName(labContent),
    type: "website",
    images: [{ url: SOCIAL_IMAGE_URL, width: 1200, height: 630, alt: content.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metadataTitle,
    description: content.description,
    images: [{ url: SOCIAL_IMAGE_URL, alt: content.title }],
  },
  }
}

export default async function AmeliePage() {
  const labContent = await getLabContent()
  const content = labContent.experiments.amelie
  const jsonLd = await buildLabCreativeWorkStructuredData({
    name: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    inLanguage: content.inLanguage,
    dateCreated: content.dateCreated,
    isBasedOn: content.isBasedOn,
    labContent,
  })

  return (
    <main className={styles.page} data-theme="dark" lang={content.inLanguage}>
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
