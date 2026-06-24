// creatures.ts
import { createProgram, createUnitQuad } from "../render/gl"
import { fadeAlpha } from "../reveals/fade"
import type { Vec2, ViewRect } from "../types"

const LIFE = 4
const VERT = `#version 300 es
layout(location=0) in vec2 aPos; uniform vec4 uRect; out vec2 vUv;
void main(){ vUv=vec2(aPos.x*0.5+0.5,1.0-(aPos.y*0.5+0.5));
  vec2 p=uRect.xy+(aPos*0.5+0.5)*uRect.zw; gl_Position=vec4(p,0.0,1.0); }
`
const FRAG = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uAlpha;
void main(){ o = texture(uTex,vUv) * uAlpha; }
`
type Active = { tex: WebGLTexture; at: Vec2; born: number }

export class Creatures {
  private program: WebGLProgram; private quad: WebGLVertexArrayObject
  private textures = new Map<string, WebGLTexture>(); private active: Active[] = []
  private uRect: WebGLUniformLocation | null; private uAlpha: WebGLUniformLocation | null; private uTex: WebGLUniformLocation | null
  constructor(private gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VERT, FRAG); this.quad = createUnitQuad(gl)
    this.uRect = gl.getUniformLocation(this.program, "uRect")
    this.uAlpha = gl.getUniformLocation(this.program, "uAlpha")
    this.uTex = gl.getUniformLocation(this.program, "uTex")
  }
  register(name: string, tex: WebGLTexture): void { this.textures.set(name, tex) }
  spawn(name: string, at: Vec2, now: number): void {
    const tex = this.textures.get(name); if (!tex) return
    this.active.push({ tex, at, born: now })
  }
  draw(view: ViewRect, now: number): void {
    const gl = this.gl
    this.active = this.active.filter((a) => now - a.born <= LIFE)
    if (!this.active.length) return
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.useProgram(this.program); gl.bindVertexArray(this.quad)
    for (const a of this.active) {
      const alpha = fadeAlpha(now - a.born, LIFE)
      const ndcx = ((a.at.x - view.x) / view.w) * 2 - 1
      const ndcy = 1 - ((a.at.y - view.y) / view.h) * 2
      const w = 0.3, h = 0.3
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex)
      gl.uniform1i(this.uTex, 0); gl.uniform4f(this.uRect, ndcx - w/2, ndcy - h/2, w, h); gl.uniform1f(this.uAlpha, alpha)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    gl.bindVertexArray(null)
  }
  destroy(): void {
    this.gl.deleteProgram(this.program); this.gl.deleteVertexArray(this.quad)
    for (const t of this.textures.values()) this.gl.deleteTexture(t)
  }
}
