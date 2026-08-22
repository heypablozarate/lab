import type { Metadata } from "next"
import { preload } from "react-dom"

import { getSiteConfig } from "@/content/loader"
import {
  getLabExperiment,
} from "@/lib/lab-content"
import {
  buildLabCreativeWorkStructuredData,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo"
import { TE_CUENTO_PUBLIC_URL } from "@/lib/te-cuento-stories"

import { ExperienceShell } from "./experience-shell"
import styles from "./te-cuento-una-historia.module.css"

const SLUG = "te-cuento-una-historia"
const PAGE_URL = TE_CUENTO_PUBLIC_URL
const content = getLabExperiment(SLUG)
const identity = getCanonicalIdentityLabels()
const site = getSiteConfig()

const CRITICAL_FONT_URLS = [
  "/rams/assets/fonts/NHaasGroteskDSPro-55Rg.woff2",
  "/rams/assets/fonts/NHaasGroteskDSPro-65Md.woff2",
  "/rams/assets/fonts/NHaasGroteskDSPro-75Bd.woff2",
  "/rams/assets/fonts/CenturyStd-Book.woff2",
  "/rams/assets/fonts/CenturyStd-BookItalic.woff2",
  "/rams/assets/fonts/CenturyStd-Bold.woff2",
] as const

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export const metadata: Metadata = {
  title: content.metadataTitle,
  description: content.description,
  keywords: content.keywords,
  authors: [{ name: identity.agentName, url: identity.homeUrl }],
  creator: identity.agentName,
  publisher: identity.brandName,
  category: "Narrativa interactiva",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: content.metadataTitle,
    description: content.description,
    url: PAGE_URL,
    siteName: content.title,
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: content.socialImages.openGraph,
        width: 1200,
        height: 630,
        alt: content.socialImages.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: content.metadataTitle,
    description: content.description,
    images: [
      { url: content.socialImages.twitter, alt: content.socialImages.alt },
    ],
  },
}

export default function TeCuentoUnaHistoriaPage() {
  for (const href of CRITICAL_FONT_URLS) {
    preload(href, {
      as: "font",
      crossOrigin: "anonymous",
      type: "font/woff2",
    })
  }

  const jsonLd = buildLabCreativeWorkStructuredData({
    name: content.title,
    description: content.description,
    abstract: content.serverContext,
    url: PAGE_URL,
    inLanguage: content.inLanguage,
    keywords: content.keywords,
    dateCreated: content.dateCreated,
    isBasedOn: content.isBasedOn,
    temporalCoverage: `${content.credits.periodStart}/${content.credits.periodEnd}`,
    creditText: content.credits.musicBody,
  })

  return (
    <main className={styles.page} data-theme="dark" lang={content.inLanguage}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <section
        className={styles.serverContext}
        aria-labelledby="te-cuento-server-title"
      >
        <h1 id="te-cuento-server-title">{content.title}</h1>
        <p>{content.serverContext}</p>
      </section>

      <ExperienceShell
        brandName={identity.brandName}
        brandUrl={identity.homeUrl}
        copy={content.interfaceCopy}
        credits={content.credits}
        socialLinks={site.socialLinks}
      />
    </main>
  )
}
