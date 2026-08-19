import type { Metadata } from "next";

import {
  LAB_URL,
  labHome,
  labSocialImages,
} from "@/lib/lab-content";
import {
  buildLabLandingStructuredData,
  buildLabSiteName,
  getCanonicalIdentityLabels,
} from "@/lib/lab-seo";

import { LabCanvas } from "./lab-canvas";

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function LabStructuredData() {
  const data = buildLabLandingStructuredData();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(LAB_URL),
  title: labHome.metadataTitle,
  description: labHome.description,
  keywords: labHome.keywords,
  alternates: {
    canonical: LAB_URL,
  },
  openGraph: {
    title: labHome.metadataTitle,
    description: labHome.description,
    url: LAB_URL,
    siteName: buildLabSiteName(),
    type: "website",
    images: [{
      url: labSocialImages.openGraph,
      width: 1280,
      height: 746,
      alt: labSocialImages.alt,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: labHome.metadataTitle,
    description: labHome.description,
    images: [{ url: labSocialImages.twitter, alt: labSocialImages.alt }],
  },
};

export default function LabLandingPage() {
  const { brandName, homeUrl, siteTitle } = getCanonicalIdentityLabels();

  return (
    <>
      <LabStructuredData />
      <LabCanvas
        brandName={brandName}
        canonicalHomeUrl={homeUrl}
        creditLabel={siteTitle}
      />
    </>
  );
}
