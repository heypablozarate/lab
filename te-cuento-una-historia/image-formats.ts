export type OptimizedImageSources = {
  avif: string
  webp: string
}

function replacePngExtension(value: string, extension: "avif" | "webp") {
  return value.replace(/\.png(?=$|[?#])/iu, `.${extension}`)
}

export function optimizedImageSources(value: string): OptimizedImageSources {
  return {
    avif: replacePngExtension(value, "avif"),
    webp: replacePngExtension(value, "webp"),
  }
}

export function optimizedImageCandidates(value: string) {
  const sources = optimizedImageSources(value)
  return sources.avif === value ? [value] : [sources.avif, sources.webp]
}

export function assignOptimizedImage(image: HTMLImageElement, value: string) {
  const [preferred, fallback] = optimizedImageCandidates(value)
  image.onerror = fallback
    ? () => {
        image.onerror = null
        image.src = fallback
      }
    : null
  image.src = preferred
}

export async function preloadOptimizedImage(
  value: string,
  { signal }: { signal?: AbortSignal } = {},
) {
  let lastError: unknown = null
  for (const candidate of optimizedImageCandidates(value)) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Carga cancelada", "AbortError")
    const image = new Image()
    image.decoding = "async"
    image.src = candidate
    try {
      if (typeof image.decode === "function") await image.decode()
      else {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true, signal })
          image.addEventListener("error", () => reject(new Error(`No se pudo cargar ${candidate}`)), { once: true, signal })
        })
      }
      return { image, src: candidate }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error(`No se pudo cargar ${value}`)
}
