import type { Metadata } from "next"

import { Stage } from "./components/stage"
import styles from "./soy-tu-aire.module.css"

const PAGE_URL = "https://lab.pablozarate.com/soy-tu-aire"
const SOCIAL_IMAGE_URL = "https://lab.pablozarate.com/lab/opengraph-image.jpg"
const TWITTER_IMAGE_URL = "https://lab.pablozarate.com/lab/twitter-image.jpg"
const PAGE_TITLE = "Soy tu aire — Interactive Design Engineering Homage by PabloZarate™"
const PAGE_DESCRIPTION =
  "An interactive Experience Design and Design Engineering homage to Labuat's Soy tu aire by Pablo Zarate, using PixiJS, Web Audio, and generative ink to paint music in the browser."
const SERVER_CONTEXT =
  "Soy tu aire is an interactive homage to the 2009 Labuat web piece: a song painted in ink rather than a canvas demo. It explores how memory, cursor movement, and music can become one generative interface. The experience is built with PixiJS, Web Audio, a choreography timeline recovered from archival material, and a custom ink engine that reacts to the track while the browser draws a unique performance on every play."

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
    "Design Engineering",
    "Experience Design",
    "AI Design",
    "Product Specialist",
    "creative coding",
    "interactive web experience",
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
        <h1 id="soy-tu-aire-server-title">Soy tu aire</h1>
        <p>{SERVER_CONTEXT}</p>
      </section>
      {"\n"}

      <Stage />
    </main>
  )
}
