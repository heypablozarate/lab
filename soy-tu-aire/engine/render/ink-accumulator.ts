// ink-accumulator.ts
import { createProgram, createTarget } from "./gl"
import { DAB_VERT, DAB_FRAG } from "./glsl/dab"
import type { Dab } from "../types"

const INK = [0.06, 0.05, 0.08] as const
const MAX_DABS = 4096

export class InkAccumulator {
  private target: { fbo: WebGLFramebuffer; tex: WebGLTexture }
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private buffer: WebGLBuffer
  private data = new Float32Array(MAX_DABS * 4) // x,y,size,alpha
  private uPaper: WebGLUniformLocation | null
  private uInk: WebGLUniformLocation | null

  constructor(private gl: WebGL2RenderingContext, private paperW: number, private paperH: number) {
    this.target = createTarget(gl, paperW, paperH)
    this.clear()
    this.program = createProgram(gl, DAB_VERT, DAB_FRAG)
    this.uPaper = gl.getUniformLocation(this.program, "uPaper")
    this.uInk = gl.getUniformLocation(this.program, "uInk")
    const vao = gl.createVertexArray()!; this.vao = vao
    gl.bindVertexArray(vao)
    this.buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW)
    const stride = 4 * 4
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12)
    gl.bindVertexArray(null)
  }

  get texture(): WebGLTexture { return this.target.tex }

  clear(): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fbo)
    gl.viewport(0, 0, this.paperW, this.paperH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  stamp(dabs: Dab[]): void {
    if (dabs.length === 0) return
    const gl = this.gl
    const n = Math.min(dabs.length, MAX_DABS)
    for (let i = 0; i < n; i++) {
      const d = dabs[i]
      this.data[i * 4] = d.x; this.data[i * 4 + 1] = d.y
      this.data[i * 4 + 2] = d.size; this.data[i * 4 + 3] = d.alpha
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fbo)
    gl.viewport(0, 0, this.paperW, this.paperH)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // premultiplicado: acumula
    gl.useProgram(this.program)
    gl.uniform2f(this.uPaper, this.paperW, this.paperH)
    gl.uniform3f(this.uInk, INK[0], INK[1], INK[2])
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, n * 4)
    gl.drawArrays(gl.POINTS, 0, n)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  destroy(): void {
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
    gl.deleteBuffer(this.buffer)
    gl.deleteFramebuffer(this.target.fbo)
    gl.deleteTexture(this.target.tex)
  }
}
