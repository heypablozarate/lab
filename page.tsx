import type { Metadata } from "next";

import {
  LAB_URL,
  getLabProjectUrl,
  labHome,
  labPositioning,
  projects,
} from "@/lib/lab-content";

import { LabCanvas } from "./lab-canvas";

function serializeJsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function LabStructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": "https://pablozarate.com/#person",
        name: "Pablo Zarate",
        alternateName: "PabloZarate™",
        url: "https://pablozarate.com",
        sameAs: [
          "https://twitter.com/heyPabloZarate",
          "https://ar.linkedin.com/in/pablozarate",
          "https://instagram.com/heyPabloZarate",
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${LAB_URL}/#collection`,
        name: labHome.metadataTitle,
        headline: labHome.metadataTitle,
        description: labHome.description,
        url: LAB_URL,
        inLanguage: "en",
        isPartOf: {
          "@type": "WebSite",
          "@id": "https://pablozarate.com/#website",
          name: "Designed by PabloZarate™",
          url: "https://pablozarate.com",
        },
        author: { "@id": "https://pablozarate.com/#person" },
        about: labPositioning.topics,
        mainEntity: { "@id": `${LAB_URL}/#experiments` },
      },
      {
        "@type": "ItemList",
        "@id": `${LAB_URL}/#experiments`,
        name: "Lab experiments by PabloZarate™",
        itemListElement: projects.map((project, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: project.title,
          url: getLabProjectUrl(project),
          item: {
            "@type": "CreativeWork",
            name: project.title,
            url: getLabProjectUrl(project),
            description: project.description,
            dateCreated: String(project.year),
            creator: { "@id": "https://pablozarate.com/#person" },
            keywords: project.tags,
          },
        })),
      },
    ],
  };

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
    siteName: "Lab by PabloZarate™",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: labHome.metadataTitle,
    description: labHome.description,
  },
};

export default function LabLandingPage() {
  return (
    <>
      <LabStructuredData />
      <LabCanvas />
    </>
  );
}
