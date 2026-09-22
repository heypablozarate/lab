import type { Metadata } from "next";

import { LAB_URL } from "@/lib/lab-content";
import { getLabContent } from "@/lib/lab-content-server";
import {
  buildLabLandingStructuredData,
  buildLabSiteName,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo";

import { LabCanvas } from "./lab-canvas";

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function LabStructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getLabContent();
  const { home, socialImages } = content;
  return {
  metadataBase: new URL(LAB_URL),
  title: home.metadataTitle,
  description: home.description,
  keywords: home.keywords,
  alternates: {
    canonical: LAB_URL,
  },
  openGraph: {
    title: home.metadataTitle,
    description: home.description,
    url: LAB_URL,
    siteName: buildLabSiteName(content),
    type: "website",
    images: [{
      url: socialImages.openGraph,
      width: 1280,
      height: 746,
      alt: socialImages.alt,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: home.metadataTitle,
    description: home.description,
    images: [{ url: socialImages.twitter, alt: socialImages.alt }],
  },
  };
}

export default async function LabLandingPage() {
  const content = await getLabContent();
  const { brandName, homeUrl, siteTitle } = getCanonicalIdentityLabels();

  return (
    <>
      <LabStructuredData data={buildLabLandingStructuredData(content)} />
      <LabCanvas
        brandName={brandName}
        canonicalHomeUrl={homeUrl}
        creditLabel={siteTitle}
        home={content.home}
        projects={content.projects}
      />
    </>
  );
}
