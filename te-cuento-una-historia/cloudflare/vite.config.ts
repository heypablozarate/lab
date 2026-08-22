import path from "node:path"

import { defineConfig } from "vite"
import {
  deploymentRoot,
  distRoot,
  preparedPublicRoot,
  projectRoot,
} from "./scripts/paths.mjs"

export default defineConfig({
  root: deploymentRoot,
  publicDir: preparedPublicRoot,
  build: {
    outDir: distRoot,
    emptyOutDir: true,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@/components/rams/primitives": path.join(
        projectRoot,
        "src/rams-wordmark.tsx",
      ),
      "@/lib/lab-content": path.join(projectRoot, "src/content-types.ts"),
      "@/lib/te-cuento-story-markdown": path.resolve(
        projectRoot,
        "../../../../lib/te-cuento-story-markdown.ts",
      ),
    },
  },
})
