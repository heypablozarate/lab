import type { Metadata } from "next";

import { WordmarkStage } from "./components/wordmark-stage";
import styles from "./shader-experiment.module.css";

export const metadata: Metadata = {
  title: "Shader Experiment 01 — Lab by PabloZarate™",
  description: "Interactive PabloZarate™ wordmark shader experiment.",
  alternates: {
    canonical: "https://lab.pablozarate.com/shader-experiment-01",
  },
  openGraph: {
    title: "Shader Experiment 01 — Lab by PabloZarate™",
    description: "Interactive PabloZarate™ wordmark shader experiment.",
    url: "https://lab.pablozarate.com/shader-experiment-01",
    siteName: "Lab by PabloZarate™",
    type: "website",
  },
};

export default function ShaderExperimentPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.srOnly}>PabloZarate™</h1>

      <WordmarkStage />

      <footer className={styles.footer}>
        <span>PabloZarate™ — All rights reserved.</span>
      </footer>
    </main>
  );
}
