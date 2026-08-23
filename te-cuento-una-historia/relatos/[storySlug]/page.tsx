import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { RamsWordmark } from "@/components/rams/primitives"
import { getSiteConfig } from "@/content/loader"
import { getLabExperiment, LAB_URL } from "@/lib/lab-content"
import { getCanonicalIdentityLabels } from "@/lib/lab-seo"
import {
  getTeCuentoStories,
  getTeCuentoStory,
  getTeCuentoStoryNeighbors,
  TE_CUENTO_PUBLIC_URL,
} from "@/lib/te-cuento-stories"

import styles from "../../te-cuento-una-historia.module.css"

const PROJECT_SLUG = "te-cuento-una-historia"
const content = getLabExperiment(PROJECT_SLUG)
const identity = getCanonicalIdentityLabels()
const site = getSiteConfig()

type StoryPageProps = {
  params: Promise<{ storySlug: string }>
}

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export const dynamicParams = false

export function generateStaticParams() {
  return getTeCuentoStories().map((story) => ({ storySlug: story.slug }))
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { storySlug } = await params
  const story = getTeCuentoStory(storySlug)
  if (!story) return {}

  const url = `${TE_CUENTO_PUBLIC_URL}/relatos/${story.slug}`
  const title = `${story.title} — ${content.title}`
  return {
    title,
    description: story.description,
    authors: [{ name: identity.agentName, url: identity.homeUrl }],
    creator: identity.agentName,
    publisher: identity.brandName,
    category: "Relato",
    alternates: { canonical: url },
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
    openGraph: {
      title,
      description: story.description,
      url,
      siteName: content.title,
      locale: "es_AR",
      type: "article",
      publishedTime: story.datePublished,
      authors: [identity.homeUrl],
      images: [{
        url: content.socialImages.openGraph,
        width: 1200,
        height: 630,
        alt: content.socialImages.alt,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: story.description,
      images: [{ url: content.socialImages.twitter, alt: content.socialImages.alt }],
    },
  }
}

export default async function TeCuentoStoryPage({ params }: StoryPageProps) {
  const { storySlug } = await params
  const story = getTeCuentoStory(storySlug)
  if (!story) notFound()

  const { previous, next } = getTeCuentoStoryNeighbors(story.slug)
  const storyUrl = `${TE_CUENTO_PUBLIC_URL}/relatos/${story.slug}`
  const projectUrl = TE_CUENTO_PUBLIC_URL
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${storyUrl}#article`,
    headline: story.title,
    description: story.description,
    url: storyUrl,
    mainEntityOfPage: storyUrl,
    datePublished: story.datePublished,
    inLanguage: content.inLanguage,
    articleSection: story.form,
    image: new URL(story.illustration, LAB_URL).toString(),
    author: { "@id": `${site.siteUrl}/#person` },
    publisher: { "@id": `${site.siteUrl}/#person` },
    isPartOf: {
      "@type": "CreativeWork",
      "@id": `${projectUrl}#creative-work`,
      name: content.title,
      url: projectUrl,
    },
  }

  return (
    <main className={`${styles.page} ${styles.storyRoutePage}`} lang={content.inLanguage}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <nav className={styles.storyRouteTopbar} aria-label={content.title}>
        <Link className={styles.storyRouteBack} href="/lab/te-cuento-una-historia">
          {content.interfaceCopy.readerCloseLabel}
        </Link>
        <a
          className={styles.storyRouteBrand}
          href={identity.homeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${identity.brandName}, sitio web`}
        >
          <RamsWordmark variant="signature" />
        </a>
      </nav>

      <article className={`${styles.readerArticle} ${styles.storyRouteArticle}`}>
        <figure className={styles.readerIllustrationWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Spatial editorial artwork keeps its intrinsic composition. */}
          <img
            className={styles.readerIllustration}
            src={story.illustration}
            alt={story.illustrationAlt}
          />
        </figure>
        <div className={`${styles.readerPage} ${styles.storyRouteReaderPage}`}>
          <header>
            <time className={styles.readerMeta} dateTime={story.datePublished}>
              {formatDate(story.datePublished)}
            </time>
            <h1 className={styles.readerTitle}>{story.title}</h1>
            <div className={styles.readerRule} aria-hidden="true" />
          </header>
          <div
            className={styles.readerBody}
            data-form={story.form}
            dangerouslySetInnerHTML={{ __html: story.html }}
          />
          <nav className={styles.storyRoutePagination} aria-label="Relatos">
            {previous ? (
              <a href={`${TE_CUENTO_PUBLIC_URL}/relatos/${previous.slug}`} rel="prev">
                <span aria-hidden="true">←</span> {previous.title}
              </a>
            ) : <span />}
            {next ? (
              <a href={`${TE_CUENTO_PUBLIC_URL}/relatos/${next.slug}`} rel="next">
                {next.title} <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </nav>
        </div>
      </article>
    </main>
  )
}
