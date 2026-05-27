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
        display: "grid",
        alignItems: "center",
        paddingBlock: "clamp(3rem, 12vw, 9rem)",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <section
        className="rams-swiss-grid"
        aria-labelledby="lab-title"
        style={{ rowGap: "clamp(1.25rem, 4vw, 3rem)" }}
      >
        <p
          style={{
            gridColumn: "1 / -1",
            margin: 0,
            color: "var(--muted)",
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.875rem, 1vw, 1rem)",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          Personal experiments, prototypes, and working notes.
        </p>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gap: "clamp(0.5rem, 2vw, 1rem)",
          }}
        >
          <h1
            id="lab-title"
            style={{
              margin: 0,
              color: "var(--brand-accent)",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(5rem, 22vw, 18rem)",
              fontWeight: 900,
              letterSpacing: 0,
              lineHeight: 0.8,
            }}
          >
            Lab
          </h1>

          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body)",
              fontSize: "clamp(1.25rem, 3vw, 2.75rem)",
              fontWeight: 500,
              lineHeight: 1.05,
            }}
          >
            <BrandSignature context="by " />
          </p>
        </div>
      </section>
    </main>
  );
}
