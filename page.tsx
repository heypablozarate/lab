import type { Metadata } from "next";

import { BrandSignature } from "@/components/site/brand-signature";

export const metadata: Metadata = {
  title: "Lab by PabloZarate™",
  description: "Experimentos y proyectos personales de Pablo Zarate.",
  alternates: {
    canonical: "https://lab.pablozarate.com",
  },
  openGraph: {
    title: "Lab by PabloZarate™",
    description: "Experimentos y proyectos personales de Pablo Zarate.",
    url: "https://lab.pablozarate.com",
    siteName: "Lab by PabloZarate™",
    type: "website",
  },
};

export default function LabLandingPage() {
  return (
    <main
      className="rams-page"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        paddingBlock: "clamp(1.75rem, 4vw, 3rem)",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: "center",
          color: "var(--muted)",
          fontFamily: "var(--font-body)",
          fontSize: "clamp(0.875rem, 1vw, 1rem)",
          fontWeight: 500,
          letterSpacing: "0.01em",
          lineHeight: 1.4,
        }}
      >
        Personal experiments, prototypes, and working notes.
      </p>

      <section
        aria-labelledby="lab-title"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(0.75rem, 2vw, 1.5rem)",
        }}
      >
        <h1
          id="lab-title"
          style={{
            margin: 0,
            color: "var(--ink)",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(5rem, 21vw, 17rem)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 0.8,
          }}
        >
          Lab<span style={{ color: "var(--brand-accent)" }}>.</span>
        </h1>

        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontSize: "clamp(1.25rem, 3vw, 2.5rem)",
            fontWeight: 500,
            lineHeight: 1.05,
          }}
        >
          <BrandSignature context="by " />
        </p>
      </section>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderTop: "0.5px solid var(--line)",
          paddingTop: "clamp(0.75rem, 1.5vw, 1rem)",
          color: "var(--muted)",
          fontFamily: "var(--font-body)",
          fontSize: "clamp(0.75rem, 0.9vw, 0.8125rem)",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        <span>© 1999—2026</span>
        <span>Buenos Aires</span>
      </footer>
    </main>
  );
}
