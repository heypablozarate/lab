import { init, type Gpu } from "vgpu"

export type InitGpu = typeof init

function abortError(): DOMException {
  return new DOMException("Wordmark renderer initialization aborted.", "AbortError")
}

export async function initializePrimaryGpu(
  signal: AbortSignal,
  initGpu: InitGpu = init,
): Promise<Gpu> {
  if (signal.aborted) throw abortError()

  const gpu = await initGpu({ label: "shader-experiment-01" })
  if (signal.aborted) {
    gpu.dispose()
    throw abortError()
  }

  // A software/fallback adapter is not a dependable presentation path. In
  // Chromium SwiftShader the submitted/read-back frame is valid while the
  // composited canvas remains uniformly blank. Select the isolated WebGL
  // renderer on a fresh canvas before claiming WebGPU readiness.
  if (gpu.device.adapterInfo?.isFallbackAdapter === true) {
    gpu.dispose()
    throw new Error(
      "WebGPU is using a software fallback adapter; selecting the WebGL renderer.",
    )
  }

  return gpu
}
