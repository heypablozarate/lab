import type { Metadata } from "next"
import Link from "next/link"

import { Stage } from "./components/stage"
import styles from "./soy-tu-aire.module.css"

const PAGE_URL = "https://lab.pablozarate.com/soy-tu-aire"
const SOCIAL_IMAGE_URL = "https://lab.pablozarate.com/lab/opengraph-image.jpg"
const TWITTER_IMAGE_URL = "https://lab.pablozarate.com/lab/twitter-image.jpg"
const PAGE_TITLE = "Soy tu aire — Homenaje interactivo · Lab by PabloZarate™"
const PAGE_DESCRIPTION =
  "Homenaje moderno a 'Soy tu aire' de Labuat: un pincel de tinta que dibuja la música y respondés con el mouse. PixiJS + Web Audio por Pablo Zarate."

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "Labuat",
    "Soy tu aire",
    "PixiJS",
    "audio reactive",
    "generative ink",
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
}

export default function SoyTuAirePage() {
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
      <h1 className={styles.srOnly}>Soy tu aire — homenaje interactivo</h1>

      <Stage />

      <footer className={styles.footer}>
        <span>
          Homenaje a <strong>Labuat — “Soy tu aire”</strong>. Recreación por PabloZarate™.
        </span>
        <Link href="/">Back to the Lab</Link>
      </footer>
    </main>
  )
}
