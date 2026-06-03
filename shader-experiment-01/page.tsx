import type { Metadata } from "next";

import { ShaderExperimentShell } from "./components/shader-experiment-shell";

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
  return <ShaderExperimentShell />;
}
