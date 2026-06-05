import type { Metadata } from "next";

import { LabCanvas } from "./lab-canvas";
import { projects } from "./projects";

const LAB_URL = "https://lab.pablozarate.com";
const LAB_TITLE =
  "PabloZarate Lab — Product Design Experiments & Digital Prototypes";
const LAB_DESCRIPTION =
  "A product design and digital experimentation lab by Pablo Zarate exploring interfaces, WebGL, design systems, one-person product craft, and technology-led experiences.";

function getProjectUrl(project: (typeof projects)[number]) {
  return project.href ?? `${LAB_URL}/${project.slug}`;
}

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
        name: LAB_TITLE,
        headline: LAB_TITLE,
        description: LAB_DESCRIPTION,
        url: LAB_URL,
        inLanguage: "en",
        isPartOf: {
          "@type": "WebSite",
          "@id": "https://pablozarate.com/#website",
          name: "Designed by PabloZarate™",
          url: "https://pablozarate.com",
        },
        author: { "@id": "https://pablozarate.com/#person" },
        about: [
          "Product design",
          "Digital experimentation",
          "Digital experiences",
          "Technology prototypes",
          "One man army product craft",
          "Design systems",
          "WebGL interfaces",
        ],
        mainEntity: { "@id": `${LAB_URL}/#experiments` },
      },
      {
        "@type": "ItemList",
        "@id": `${LAB_URL}/#experiments`,
        name: "Lab experiments by PabloZarate",
        itemListElement: projects.map((project, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: project.title,
          url: getProjectUrl(project),
          item: {
            "@type": "CreativeWork",
            name: project.title,
            url: getProjectUrl(project),
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
  title: LAB_TITLE,
  description: LAB_DESCRIPTION,
  keywords: [
    "Pablo Zarate",
    "PabloZarate Lab",
    "product design experiments",
    "digital experience design",
    "one man army design",
    "one-person product design",
    "technology prototypes",
    "WebGL experiments",
    "design systems",
    "diseño de productos",
    "experiencias digitales",
    "experimentacion digital",
  ],
  alternates: {
    canonical: LAB_URL,
  },
  openGraph: {
    title: LAB_TITLE,
    description: LAB_DESCRIPTION,
    url: LAB_URL,
    siteName: "Lab by PabloZarate™",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: LAB_TITLE,
    description: LAB_DESCRIPTION,
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
