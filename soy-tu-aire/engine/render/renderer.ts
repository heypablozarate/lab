import { createProgram, createQuad, resizeCanvasToDisplaySize } from "./gl"

const PAPER = [0.925, 0.922, 0.902] as const // ~#ecebe6

const CLEAR_VERT = `#version 300 es
layout(location=0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`
const CLEAR_FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec3 uPaper;
void main() { o = vec4(uPaper, 1.0); }
`

export class Renderer {
  readonly gl: WebGL2RenderingContext
  private quad: WebGLVertexArrayObject
  private clearProgram: WebGLProgram
  private uPaper: WebGLUniformLocation | null

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false })
    if (!gl) throw new Error("WebGL2 no soportado")
    this.gl = gl
    this.quad = createQuad(gl)
    this.clearProgram = createProgram(gl, CLEAR_VERT, CLEAR_FRAG)
    this.uPaper = gl.getUniformLocation(this.clearProgram, "uPaper")
    this.resize()
  }

  resize(): void {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    if (resizeCanvasToDisplaySize(this.canvas, dpr)) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  /** Pinta el viewport con el color papel (placeholder de Fase 1). */
  clearPaper(): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.clearProgram)
    gl.uniform3f(this.uPaper, PAPER[0], PAPER[1], PAPER[2])
    gl.bindVertexArray(this.quad)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  destroy(): void {
    const gl = this.gl
    gl.deleteProgram(this.clearProgram)
    gl.deleteVertexArray(this.quad)
    const ext = gl.getExtension("WEBGL_lose_context")
    ext?.loseContext()
  }
}
