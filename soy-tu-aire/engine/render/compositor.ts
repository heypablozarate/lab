// compositor.ts
import { createProgram, createQuad } from "./gl"
import { COMPOSITE_VERT, COMPOSITE_FRAG } from "./glsl/composite"
import type { ViewRect } from "../types"

const PAPER_COL = [0.925, 0.922, 0.902] as const
const INK_COL = [0.08, 0.07, 0.09] as const

export class Compositor {
  private program: WebGLProgram
  private quad: WebGLVertexArrayObject
  private u: Record<string, WebGLUniformLocation | null>
  constructor(private gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, COMPOSITE_VERT, COMPOSITE_FRAG)
    this.quad = createQuad(gl)
    this.u = {
      ink: gl.getUniformLocation(this.program, "uInk"),
      paperTex: gl.getUniformLocation(this.program, "uPaperTex"),
      view: gl.getUniformLocation(this.program, "uView"),
      paper: gl.getUniformLocation(this.program, "uPaper"),
      paperCol: gl.getUniformLocation(this.program, "uPaperCol"),
      inkCol: gl.getUniformLocation(this.program, "uInkCol"),
      glow: gl.getUniformLocation(this.program, "uGlow"),
    }
  }
  draw(inkTex: WebGLTexture, paperTex: WebGLTexture, view: ViewRect, paperW: number, paperH: number, glow: number): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.disable(gl.BLEND)
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inkTex)
    gl.uniform1i(this.u.ink, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, paperTex)
    gl.uniform1i(this.u.paperTex, 1)
    gl.uniform4f(this.u.view, view.x, view.y, view.w, view.h)
    gl.uniform2f(this.u.paper, paperW, paperH)
    gl.uniform3f(this.u.paperCol, PAPER_COL[0], PAPER_COL[1], PAPER_COL[2])
    gl.uniform3f(this.u.inkCol, INK_COL[0], INK_COL[1], INK_COL[2])
    gl.uniform1f(this.u.glow, glow)
    gl.bindVertexArray(this.quad)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }
  destroy(): void {
    this.gl.deleteProgram(this.program)
    this.gl.deleteVertexArray(this.quad)
  }
}
