import { defineConfig } from "vite"
import {
  deploymentRoot,
  distRoot,
  preparedPublicRoot,
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
  },
})
