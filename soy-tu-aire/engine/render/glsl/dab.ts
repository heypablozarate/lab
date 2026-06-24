// dab.ts
export const DAB_VERT = `#version 300 es
layout(location=0) in vec2 aPaper;   // posición en px de papel
layout(location=1) in float aSize;   // diámetro en px
layout(location=2) in float aAlpha;
uniform vec2 uPaper;                  // tamaño del papel
out float vAlpha;
void main() {
  vec2 clip = vec2(aPaper.x / uPaper.x * 2.0 - 1.0, 1.0 - aPaper.y / uPaper.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = aSize;
  vAlpha = aAlpha;
}
`
export const DAB_FRAG = `#version 300 es
precision highp float;
in float vAlpha;
out vec4 o;
uniform vec3 uInk;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.35, r) * vAlpha;   // borde húmedo
  if (a <= 0.001) discard;
  o = vec4(uInk * a, a);                          // premultiplicado
}
`
