import {
  effect,
  frame,
  sampler,
  surface,
  type Effect,
  type Gpu,
  type Surface,
} from "vgpu"

import type {
  RendererFailureHandler,
  WordmarkBackend,
  WordmarkFrame,
} from "./contracts"
import {
  hasExpectedPixelSignal,
  inspectPixels,
  type PixelEvidence,
} from "./pixel-evidence"
import {
  initializePrimaryGpu,
  type InitGpu,
} from "./webgpu-init"
import wordmarkShader from "./shaders/wordmark.wgsl"

const TEXTURE_USAGE_COPY_DST = 0x02
const TEXTURE_USAGE_TEXTURE_BINDING = 0x04
const TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10
const TEXTURE_USAGE_COPY_SRC = 0x01
const BUFFER_USAGE_MAP_READ = 0x01
const BUFFER_USAGE_COPY_DST = 0x08
const MAP_MODE_READ = 0x01

function abortError(): DOMException {
  return new DOMException("Wordmark renderer initialization aborted.", "AbortError")
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortError()
}

function bestEffort(cleanup: () => void) {
  try {
    cleanup()
  } catch {
    // A teardown failure must not hide the renderer failure that triggered it.
  }
}

function createTextTexture(gpu: Gpu, width: number, height: number): GPUTexture {
  return gpu.gpu.createTexture({
    label: "shader-experiment-wordmark-text",
    size: [Math.max(1, width), Math.max(1, height)],
    format: "rgba8unorm",
    // Matches the official vgpu 0.3.1 browser-raster recipe. Keeping the
    // render-attachment bit also preserves the portable external-image/color
    // conversion path should this upload strategy change again.
    usage:
      TEXTURE_USAGE_COPY_SRC |
      TEXTURE_USAGE_COPY_DST |
      TEXTURE_USAGE_TEXTURE_BINDING |
      TEXTURE_USAGE_RENDER_ATTACHMENT,
  })
}

async function readTexture(
  gpu: Gpu,
  texture: GPUTexture,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const sourceBytesPerRow = width * 4
  const bytesPerRow = Math.ceil(sourceBytesPerRow / 256) * 256
  const readback = gpu.gpu.createBuffer({
    label: "shader-experiment-wordmark-text-readback",
    size: bytesPerRow * height,
    usage: BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST,
  })

  try {
    const encoder = gpu.gpu.createCommandEncoder({
      label: "shader-experiment-wordmark-text-readback",
    })
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow, rowsPerImage: height },
      [width, height],
    )
    gpu.gpu.queue.submit([encoder.finish()])
    await readback.mapAsync(MAP_MODE_READ)
    const mapped = new Uint8Array(readback.getMappedRange())
    const pixels = new Uint8Array(sourceBytesPerRow * height)
    for (let row = 0; row < height; row += 1) {
      pixels.set(
        mapped.subarray(row * bytesPerRow, row * bytesPerRow + sourceBytesPerRow),
        row * sourceBytesPerRow,
      )
    }
    readback.unmap()
    return pixels
  } finally {
    readback.destroy()
  }
}

function uploadCanvas(
  gpu: Gpu,
  source: HTMLCanvasElement,
  texture: GPUTexture,
): PixelEvidence {
  const context = source.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas2D text pixels are unavailable.")
  const width = Math.max(1, source.width)
  const height = Math.max(1, source.height)
  const pixels = context.getImageData(0, 0, width, height).data
  const sourceBytesPerRow = width * 4
  const bytesPerRow = Math.ceil(sourceBytesPerRow / 256) * 256
  let upload: Uint8Array<ArrayBuffer>

  if (bytesPerRow === sourceBytesPerRow) {
    upload = new Uint8Array(
      pixels.buffer as ArrayBuffer,
      pixels.byteOffset,
      pixels.byteLength,
    )
  } else {
    upload = new Uint8Array(bytesPerRow * height)
    for (let row = 0; row < height; row += 1) {
      const sourceOffset = row * sourceBytesPerRow
      upload.set(
        pixels.subarray(sourceOffset, sourceOffset + sourceBytesPerRow),
        row * bytesPerRow,
      )
    }
  }

  gpu.gpu.queue.writeTexture(
    { texture },
    upload,
    { bytesPerRow, rowsPerImage: height },
    [width, height],
  )
  return inspectPixels(pixels)
}

function setFrameUniforms(shaderEffect: Effect, current: WordmarkFrame) {
  shaderEffect.set({
    params: {
      resolution: current.resolution,
      mouse: current.mouse,
      time: current.time,
      hover: current.hover,
      energy: current.energy,
      seed: current.seed,
      effect: current.effect,
      intensity: current.intensity,
      _padding: [0, 0],
    },
  })
}

const INITIAL_FRAME: WordmarkFrame = {
  resolution: [1, 1],
  mouse: [0.5, 0.5],
  time: 0,
  hover: 0,
  energy: 0,
  seed: 0,
  effect: 0,
  intensity: 1,
}

export async function createVgpuRenderer(
  canvas: HTMLCanvasElement,
  onFatal: RendererFailureHandler,
  signal: AbortSignal,
  initGpu?: InitGpu,
): Promise<WordmarkBackend> {
  let gpu: Gpu | undefined
  let output: Surface | undefined
  let textTexture: GPUTexture | undefined
  let unsubscribeError: (() => void) | undefined
  let disposed = false
  let fatalDelivered = false
  let fatalError: unknown
  let sourceEvidence: PixelEvidence | undefined
  let uploadedTextureEvidence: Promise<PixelEvidence | undefined> | undefined

  const fail = (error: unknown) => {
    if (disposed || fatalDelivered) return
    fatalDelivered = true
    fatalError = error
    onFatal(error)
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    bestEffort(() => unsubscribeError?.())
    bestEffort(() => textTexture?.destroy())
    bestEffort(() => output?.dispose())
    bestEffort(() => gpu?.dispose())
  }

  try {
    throwIfAborted(signal)
    gpu = await initializePrimaryGpu(signal, initGpu)

    const preferredFormat = navigator.gpu.getPreferredCanvasFormat()
    output = surface(gpu, canvas, {
      autoResize: false,
      size: [1, 1],
      dpr: [1, 2],
      format: preferredFormat,
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
      label: "shader-experiment-wordmark-output",
    })

    textTexture = createTextTexture(gpu, 1, 1)
    gpu.gpu.queue.writeTexture(
      { texture: textTexture },
      new Uint8Array([0, 0, 0, 0]),
      { bytesPerRow: 4, rowsPerImage: 1 },
      [1, 1],
    )

    const linearSampler = sampler(gpu, {
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    })
    const shaderEffect = effect(gpu, wordmarkShader, {
      label: "shader-experiment-wordmark-effect",
      blend: "alpha",
      set: {
        linearSampler,
        textTexture,
        params: {
          resolution: [1, 1],
          mouse: [0.5, 0.5],
          time: 0,
          hover: 0,
          energy: 0,
          seed: 0,
          effect: 0,
          intensity: 1,
          _padding: [0, 0],
        },
      },
    })

    unsubscribeError = gpu.onError(fail)
    void gpu.gpu.lost.then((info) => {
      fail(new Error(`WebGPU device lost (${info.reason}): ${info.message}`))
    })

    // Surface signatures may only be inspected while a vgpu frame is active.
    // Compile first, then submit a deterministic frame and wait for every
    // asynchronous validation/error delivery before declaring this backend ready.
    let compilePromise: Promise<Effect> | undefined
    frame(gpu, () => {
      compilePromise = shaderEffect.compile(output)
    })
    await compilePromise
    throwIfAborted(signal)

    setFrameUniforms(shaderEffect, INITIAL_FRAME)
    frame(gpu, (currentFrame) => {
      currentFrame.pass(output!, shaderEffect)
    })
    await gpu.settled()
    throwIfAborted(signal)
    if (fatalDelivered) throw fatalError

    return {
      kind: "webgpu",
      resize(width, height) {
        if (disposed) return
        output!.resize([Math.max(1, width), Math.max(1, height)])
      },
      uploadText(source) {
        if (disposed) return
        const replacement = createTextTexture(gpu!, source.width, source.height)
        try {
          // SwiftShader can validate copyExternalImageToTexture yet produce an
          // all-transparent texture. Reading the infrequent text raster on CPU
          // and using writeTexture follows vgpu's official rgbaRaster pattern
          // and behaves consistently across hardware and software adapters.
          const nextSourceEvidence = uploadCanvas(gpu!, source, replacement)
          if (!sourceEvidence) {
            sourceEvidence = nextSourceEvidence
            uploadedTextureEvidence = readTexture(
              gpu!,
              replacement,
              Math.max(1, source.width),
              Math.max(1, source.height),
            )
              .then(inspectPixels)
              .catch((error: unknown) => {
                fail(error)
                return undefined
              })
          }
          shaderEffect.set({ textTexture: replacement })
        } catch (error) {
          replacement.destroy()
          throw error
        }
        const previous = textTexture
        textTexture = replacement
        previous?.destroy()
      },
      render(current) {
        if (disposed || fatalDelivered) return
        try {
          setFrameUniforms(shaderEffect, current)
          frame(gpu!, (currentFrame) => {
            currentFrame.pass(output!, shaderEffect)
          })
        } catch (error) {
          fail(error)
        }
      },
      async settled({ expectVisible = false } = {}) {
        await gpu!.settled()
        if (fatalDelivered) throw fatalError
        const textureEvidence = await uploadedTextureEvidence
        if (fatalDelivered) throw fatalError
        if (
          expectVisible &&
          sourceEvidence &&
          textureEvidence &&
          !hasExpectedPixelSignal(sourceEvidence, textureEvidence)
        ) {
          throw new Error(
            "WebGPU text upload did not preserve the raster pixel signal.",
          )
        }
      },
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}
