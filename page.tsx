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
// Symmetric weight ramp (thin → black → thin) using the NHaas Display weights
// available in the app (400/500/700/900), cycled to fill the column.
const RAMP = [400, 500, 700, 900, 700, 500, 400];
const WEIGHTS = Array.from({ length: 49 }, (_, i) => RAMP[i % RAMP.length]);

export default function LabLandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.triangle} aria-hidden="true" />
      <div className={styles.circle} aria-hidden="true" />

      <div className={styles.content}>
        <p className={styles.description}>
          {WEIGHTS.map((weight, i) => (
            <span key={i} style={{ fontWeight: weight }}>
              {PHRASE}{" "}
            </span>
          ))}
        </p>

        <h1 className={styles.title}>
          L<span className={styles.letterA}>A</span>
          <span className={styles.letterB}>B</span>
          <span className={styles.accent}>.</span>
        </h1>
      </div>

      <footer className={styles.footer}>
        <span className={styles.madeIn}>Made in Buenos Aires, Argentina 🇦🇷</span>
        <a
          className={styles.designedBy}
          href="https://pablozarate.com"
          aria-label="Designed by PabloZarate — pablozarate.com"
        >
          <span className={styles.designedByContext}>Designed by </span>
          <span className={styles.designedByName}>
            PabloZarate<span className={styles.accent}>™</span>
          </span>
        </a>
      </footer>
    </main>
  );
}
