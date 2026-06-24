// composite.ts
export const COMPOSITE_VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`
export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uInk;
uniform vec4 uView;     // x,y,w,h del view en px de papel
uniform vec2 uPaper;    // tamaño del papel
uniform vec3 uPaperCol;
uniform vec3 uInkCol;
uniform float uGlow;    // 0..1
void main() {
  // uv de pantalla (con y arriba) → coordenada de papel del view → uv de la textura de tinta.
  vec2 paperPx = uView.xy + vec2(vUv.x, 1.0 - vUv.y) * uView.zw;
  vec2 inkUv = vec2(paperPx.x / uPaper.x, 1.0 - paperPx.y / uPaper.y);
  float coverage = texture(uInk, inkUv).a;
  vec3 paper = uPaperCol + uGlow * 0.06;            // brillo de fondo
  vec3 col = mix(paper, uInkCol, clamp(coverage, 0.0, 1.0));
  // viñeta suave
  float d = distance(vUv, vec2(0.5));
  col *= 1.0 - smoothstep(0.55, 0.95, d) * 0.25;
  o = vec4(col, 1.0);
}
`
