import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
export const experienceRoot = path.resolve(projectRoot, "..")

export const deploymentRoot = path.resolve(
  process.env.TE_CUENTO_DEPLOYMENT_ROOT ??
    path.join(experienceRoot, ".artifacts/cloudflare"),
)
export const preparedPublicRoot = path.join(deploymentRoot, "prepared-public")
export const distRoot = path.join(deploymentRoot, "dist")

export const payloadRoot = path.resolve(
  path.join(experienceRoot, "public/lab/te-cuento-una-historia"),
)
export const fontsRoot = path.resolve(
  path.join(experienceRoot, "public/rams/assets/fonts"),
)
export const contentPath = path.join(experienceRoot, "content.json")

export function requirePath(target, label) {
  if (!existsSync(target)) {
    throw new Error(
      `${label} not found at ${target}. The Cloudflare project must build from its canonical Lab checkout.`,
    )
  }
}

export function decodeStorySlug(slug) {
  return decodeURIComponent(slug)
}

export function encodeStorySlug(slug) {
  return encodeURIComponent(decodeStorySlug(slug))
}
