import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)

const inferredParentRoot = path.resolve(projectRoot, "../../../../..")
export const parentRoot = path.resolve(
  process.env.TE_CUENTO_PARENT_ROOT ?? inferredParentRoot,
)

export const deploymentRoot = path.resolve(
  process.env.TE_CUENTO_DEPLOYMENT_ROOT ??
    path.join(parentRoot, ".artifacts/te-cuento-cloudflare"),
)
export const preparedPublicRoot = path.join(deploymentRoot, "prepared-public")
export const distRoot = path.join(deploymentRoot, "dist")

export const payloadRoot = path.resolve(
  process.env.TE_CUENTO_PAYLOAD_ROOT ??
    path.join(parentRoot, "public/lab/te-cuento-una-historia"),
)
export const fontsRoot = path.resolve(
  process.env.TE_CUENTO_FONTS_ROOT ??
    path.join(parentRoot, "public/rams/assets/fonts"),
)
export const contentRoot = path.resolve(
  process.env.TE_CUENTO_CONTENT_ROOT ??
    path.join(parentRoot, "src/content/data"),
)

export function requirePath(target, label) {
  if (!existsSync(target)) {
    throw new Error(
      `${label} not found at ${target}. Set TE_CUENTO_PARENT_ROOT or the corresponding TE_CUENTO_*_ROOT variable.`,
    )
  }
}
