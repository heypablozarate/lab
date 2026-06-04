import type { Metadata } from "next";

import { LabCanvas } from "./lab-canvas";

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
  return <LabCanvas />;
}
