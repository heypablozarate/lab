import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"
import {
  deploymentRoot,
  distRoot,
  preparedPublicRoot,
} from "./scripts/paths.mjs"

export default defineConfig({
  root: deploymentRoot,
  publicDir: preparedPublicRoot,
  esbuild: {
    jsx: "automatic",
  },
  build: {
    outDir: distRoot,
    emptyOutDir: true,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: "react/jsx-runtime",
        replacement: fileURLToPath(import.meta.resolve("react/jsx-runtime")),
      },
      {
        find: "react-dom/client",
        replacement: fileURLToPath(import.meta.resolve("react-dom/client")),
      },
      {
        find: "react-dom",
        replacement: fileURLToPath(import.meta.resolve("react-dom")),
      },
      {
        find: "react",
        replacement: fileURLToPath(import.meta.resolve("react")),
      },
      {
        find: "three",
        replacement: fileURLToPath(import.meta.resolve("three")),
      },
    ],
  },
})
