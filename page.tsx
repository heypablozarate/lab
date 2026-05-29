import type { Metadata } from "next";

import styles from "./lab-landing.module.css";

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

const PHRASE = "This is an experimental space.";
const WEIGHTS = [400, 400, 500, 700, 900, 700, 500, 400, 400, 500, 700, 900, 700, 500, 400];

export default function LabLandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.circle} aria-hidden="true" />
      <div className={styles.triangle} aria-hidden="true" />

      <header className={styles.header}>
        <h1 className={styles.title}>
          LAB<span className={styles.accent}>.</span>
        </h1>
        <p className={styles.description}>
          {WEIGHTS.map((weight, i) => (
            <span key={i} style={{ fontWeight: weight }}>
              {PHRASE}{" "}
            </span>
          ))}
        </p>
      </header>

      <div className={styles.spacer} />

      <footer className={styles.footer}>
        <span className={styles.footerLocation}>
          Made in Buenos Aires, Argentina 🇦🇷
        </span>
        <span className={styles.footerSignature}>
          <span className={styles.footerSignatureContext}>Designed by </span>
          <span className={styles.footerSignatureName}>
            PabloZarate<span className={styles.accent}>™</span>
          </span>
        </span>
      </footer>
    </main>
  );
}
