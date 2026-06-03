"use client"

import { useEffect, useRef } from "react"

/**
 * PabloZarate™ wordmark rendered to a texture, then distorted by a GLSL
 * fragment shader. The effect reacts to mouse hover and proximity
 * ("approximation") with randomized noise-driven displacement and chromatic
 * aberration. Closer cursor + faster movement => stronger, more chaotic warp.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;

uniform sampler2D uTex;
uniform vec2 uRes;     // canvas resolution in px
uniform vec2 uMouse;   // mouse in uv (0..1), y up
uniform float uTime;
uniform float uHover;  // 0..1 eased presence of cursor
uniform float uEnergy; // 0..1 movement speed energy
uniform float uSeed;   // random per-burst seed
uniform float uEffect; // selected effect index
uniform float uIntensity; // user intensity multiplier (0..2)

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// RGB-split sample: returns combined color + max alpha.
vec4 sampleChroma(vec2 uvv, vec2 o) {
  vec4 cr = texture2D(uTex, uvv + o);
  vec4 cg = texture2D(uTex, uvv);
  vec4 cb = texture2D(uTex, uvv - o);
  return vec4(cr.r, cg.g, cb.b, max(max(cr.a, cg.a), cb.a));
}

// 5x5 bitmap glyph (classic ASCII-art encoding, bitwise-free for WebGL1).
float character(float n, vec2 p) {
  p = floor(p * vec2(4.0, -4.0) + 2.5);
  if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y) {
    float idx = p.x + 5.0 * p.y;
    if (mod(floor(n / exp2(idx)), 2.0) > 0.5) return 1.0;
  }
  return 0.0;
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;

  // Aspect-corrected distance to cursor.
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(uMouse.x * aspect, uMouse.y);
  float dist = distance(p, m);

  // Proximity field: 1 right at the cursor, fading out with radius.
  float prox = smoothstep(0.45, 0.0, dist);
  float field = prox * uHover;
  float I = uIntensity;

  vec2 dir = (p - m) / (dist + 0.0001);
  float t = uTime * (0.6 + uEnergy * 1.8);
  vec2 frag = uv * uRes;

  // Per-effect cursor displacement / chromatic split, defaults to none.
  vec2 disp = vec2(0.0);
  vec2 off = vec2(0.0);
  float extra = 0.0; // sparkle amount

  // Geometry-style effects (0-4) precompute disp/off, then sample below.
  if (uEffect < 0.5) {
    // 0 — LIQUID
    float n1 = noise(uv * 9.0 + vec2(uSeed * 13.0, t));
    float n2 = noise(uv * 18.0 - vec2(t * 1.3, uSeed * 7.0));
    float amp = field * (0.05 + uEnergy * 0.06) * I;
    disp = vec2(n1 - 0.5, n2 - 0.5) * amp;
    off = dir * (0.006 + uEnergy * 0.012) * field * I;
    extra = 0.25;
  } else if (uEffect < 1.5) {
    // 1 — RIPPLE
    float ripple = sin(dist * 42.0 - uTime * 7.0) * field * 0.03 * I;
    disp = dir * ripple;
    off = dir * 0.004 * field * I;
    extra = 0.1;
  } else if (uEffect < 2.5) {
    // 2 — CHROMATIC
    off = dir * (0.02 + uEnergy * 0.03) * field * I;
  } else if (uEffect < 3.5) {
    // 3 — GLITCH
    float line = floor(uv.y * 26.0);
    float r = hash(vec2(line, floor(uTime * 14.0) + uSeed * 30.0));
    float shift = (r - 0.5) * field * 0.25 * I * step(0.55, r);
    disp = vec2(shift, 0.0);
    off = vec2(0.014 * field * I, 0.0);
    extra = 0.4;
  } else if (uEffect < 4.5) {
    // 4 — SWIRL
    float ang = field * (2.6 + uEnergy * 3.0) * I;
    vec2 rel = rot(ang) * (p - m) + m;
    disp = vec2(rel.x / aspect, rel.y) - uv;
    off = dir * 0.005 * field * I;
    extra = 0.15;
  }

  vec4 outc;

  if (uEffect < 4.5) {
    // ---- Sample for geometry effects ----
    vec4 s = sampleChroma(uv + disp, off);
    vec3 col = s.rgb;
    float flick = noise(uv * 60.0 + uTime * 3.0 + uSeed * 20.0);
    col += s.a * field * (flick - 0.5) * extra * I;
    outc = vec4(col, s.a);

  } else if (uEffect < 5.5) {
    // 5 — ASCII: quantize into cells, draw a glyph by coverage.
    float cs = mix(11.0, 6.0, clamp(I * 0.5, 0.0, 1.0));
    vec2 cell = floor(frag / cs);
    vec2 wob = vec2(noise(cell * 0.3 + t), noise(cell * 0.3 - t)) - 0.5;
    vec2 ccuv = (cell + 0.5) * cs / uRes + wob * field * 0.02 * I;
    vec4 s = sampleChroma(ccuv, dir * 0.004 * field * I);
    float g = s.a;
    float n = 4096.0;
    if (g > 0.15) n = 65600.0;
    if (g > 0.3) n = 163153.0;
    if (g > 0.45) n = 15255086.0;
    if (g > 0.6) n = 13195790.0;
    if (g > 0.78) n = 11512810.0;
    vec2 pp = mod(frag, cs) / cs * 2.0 - 1.0;
    float ch = character(n, pp);
    outc = vec4(s.rgb, ch * smoothstep(0.05, 0.18, g));

  } else if (uEffect < 6.5) {
    // 6 — PARTICLES: each cell becomes a dot that scatters from the cursor.
    float cs = 7.0;
    vec2 cell = floor(frag / cs);
    vec2 centerPx = (cell + 0.5) * cs;
    vec2 centerUv = centerPx / uRes;
    vec4 s = sampleChroma(centerUv, vec2(0.0));
    float cov = s.a;
    vec2 rnd = vec2(hash(cell), hash(cell + 7.3)) - 0.5;
    vec2 cp = vec2(centerUv.x * aspect, centerUv.y);
    vec2 pdir = (cp - m) / (distance(cp, m) + 0.0001);
    vec2 scatter = (rnd * cs * 3.0 + pdir * uRes.y * 0.06) * field * I
                 + rnd * cs * uEnergy * 4.0;
    vec2 pos = centerPx + scatter;
    float d = distance(frag, pos);
    float r = cs * 0.55 * smoothstep(0.05, 0.6, cov);
    float m2 = smoothstep(r, r - 1.5, d);
    outc = vec4(s.rgb, m2 * step(0.05, cov));

  } else if (uEffect < 7.5) {
    // 7 — HALFTONE: dot grid sized by coverage.
    float cs = mix(9.0, 5.0, clamp(I * 0.5, 0.0, 1.0));
    vec2 cell = floor(frag / cs);
    vec2 centerUv = (cell + 0.5) * cs / uRes;
    vec4 s = sampleChroma(centerUv + disp, dir * 0.003 * field * I);
    float cov = s.a;
    float d = distance(frag, (cell + 0.5) * cs);
    float r = cs * 0.6 * sqrt(cov) * (1.0 + field * 0.4 * I);
    float m2 = smoothstep(r, r - 1.0, d);
    outc = vec4(s.rgb, m2 * step(0.04, cov));

  } else if (uEffect < 8.5) {
    // 8 — PIXELATE: blocky mosaic, blocks grow with intensity + proximity.
    float cs = mix(3.0, 24.0, clamp(I * 0.5 + field * 0.4, 0.0, 1.0));
    vec2 q = (floor(frag / cs) + 0.5) * cs / uRes;
    outc = sampleChroma(q, dir * 0.01 * field * I);

  } else if (uEffect < 9.5) {
    // 9 — WAVE: sinusoidal banner warp.
    vec2 w = uv;
    float amp = (0.012 + field * 0.03) * I;
    w.x += sin(uv.y * 26.0 + uTime * 4.0) * amp;
    w.y += sin(uv.x * 18.0 + uTime * 3.0) * amp * 0.7;
    outc = sampleChroma(w, dir * 0.005 * field * I);

  } else if (uEffect < 10.5) {
    // 10 — KALEIDOSCOPE: angular mirror around center.
    vec2 c = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float ang = atan(c.y, c.x);
    float rad = length(c);
    float seg = 6.2831853 / 8.0;
    ang = abs(mod(ang, seg) - seg * 0.5) + uTime * 0.15 * I + field * I;
    vec2 k = vec2(cos(ang), sin(ang)) * rad;
    outc = sampleChroma(vec2(k.x / aspect + 0.5, k.y + 0.5), vec2(0.0));

  } else if (uEffect < 11.5) {
    // 11 — BULGE: magnifying lens that tracks the cursor.
    vec2 c = p - m;
    float r = length(c);
    float f = 1.0 - field * (0.9 * I) * exp(-r * r * 7.0);
    vec2 np = m + c * f;
    outc = sampleChroma(vec2(np.x / aspect, np.y), dir * 0.004 * field * I);

  } else if (uEffect < 12.5) {
    // 12 — EDGE: Sobel outline with a hot rim near the cursor.
    vec2 e = 2.0 / uRes;
    float l = texture2D(uTex, uv + vec2(-e.x, 0.0)).a;
    float r2 = texture2D(uTex, uv + vec2(e.x, 0.0)).a;
    float u2 = texture2D(uTex, uv + vec2(0.0, e.y)).a;
    float d2 = texture2D(uTex, uv + vec2(0.0, -e.y)).a;
    float edge = clamp(length(vec2(r2 - l, u2 - d2)) * 2.2, 0.0, 1.0);
    vec4 s = texture2D(uTex, uv);
    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    vec3 rim = mix(s.rgb, vec3(0.78, 0.28, 0.14), field * I * (0.5 + 0.5 * pulse));
    outc = vec4(rim, edge * (0.6 + field * 0.4 * I + 0.2 * pulse));

  } else if (uEffect < 13.5) {
    // 13 — CRT: barrel distortion, scanlines, vignette, RGB split.
    vec2 cc = uv - 0.5;
    cc *= 1.0 + dot(cc, cc) * (0.12 + field * 0.1) * I;
    vec2 cu = cc + 0.5;
    vec4 s = sampleChroma(cu, vec2((0.004 + field * 0.006) * I, 0.0));
    float scan = 0.82 + 0.18 * sin(cu.y * uRes.y * 0.6 - uTime * 12.0);
    float vig = smoothstep(1.05, 0.5, length(cc) * 1.4);
    outc = vec4(s.rgb * scan, s.a * scan * vig);

  } else if (uEffect < 14.5) {
    // 14 — DISSOLVE: noise threshold burn with ember edge near the cursor.
    float nz = fbm(uv * 6.0 + uTime * 0.25 + uSeed * 5.0);
    float th = clamp(field * I, 0.0, 1.2);
    vec4 s = sampleChroma(uv + disp, off);
    float keep = smoothstep(th - 0.05, th, nz);
    float ember = smoothstep(th, th + 0.07, nz) - smoothstep(th - 0.07, th, nz);
    vec3 rgb = mix(vec3(0.85, 0.3, 0.12), s.rgb, keep);
    rgb += vec3(0.95, 0.45, 0.12) * ember;
    outc = vec4(rgb, s.a * keep + s.a * ember);

  } else {
    // 15 — VORONOI: shatter the wordmark into drifting shards.
    vec2 grid = vec2(14.0, 8.0);
    vec2 g = uv * grid;
    vec2 cell = floor(g);
    vec2 frac = fract(g);
    vec2 rnd = vec2(hash(cell), hash(cell + 19.7)) - 0.5;
    float spin = (hash(cell + 3.0) - 0.5) * field * I;
    // rotate within the cell, then keep the cell index so shards stay in place at rest.
    vec2 local = rot(spin) * (frac - 0.5) + 0.5;
    vec2 drift = rnd * field * 1.2 * I;
    vec2 shard = (cell + local + drift) / grid;
    vec4 s = sampleChroma(shard, dir * 0.004 * field * I);
    float crack = smoothstep(0.0, 0.04, min(frac.x, frac.y));
    outc = vec4(s.rgb, s.a * mix(1.0, crack, field * 0.5 * I));
  }

  gl_FragColor = outc;
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.log("[lab] shader compile error:", gl.getShaderInfoLog(sh))
  }
  return sh
}

export function WordmarkShader({
  effect = 0,
  intensity = 1,
  className,
}: {
  effect?: number
  intensity?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectRef = useRef(effect)
  const intensityRef = useRef(intensity)

  useEffect(() => {
    effectRef.current = effect
    intensityRef.current = intensity
  }, [effect, intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasStyle = getComputedStyle(canvas)

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    })
    if (!gl) {
      console.log("[lab] WebGL not available")
      return
    }

    // ---- Program ----
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.log("[lab] shader link error:", gl.getProgramInfoLog(prog))
    }
    gl.useProgram(prog)

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTex = gl.getUniformLocation(prog, "uTex")
    const uRes = gl.getUniformLocation(prog, "uRes")
    const uMouse = gl.getUniformLocation(prog, "uMouse")
    const uTime = gl.getUniformLocation(prog, "uTime")
    const uHover = gl.getUniformLocation(prog, "uHover")
    const uEnergy = gl.getUniformLocation(prog, "uEnergy")
    const uSeed = gl.getUniformLocation(prog, "uSeed")
    const uEffect = gl.getUniformLocation(prog, "uEffect")
    const uIntensity = gl.getUniformLocation(prog, "uIntensity")

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // ---- Text texture ----
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const textCanvas = document.createElement("canvas")
    const tctx = textCanvas.getContext("2d")!

    const fontFamily =
      getComputedStyle(document.body).fontFamily || "Geist, sans-serif"

    const drawText = (w: number, h: number) => {
      // Read theme colors fresh each draw so dark mode is reflected.
      const wordColor =
        canvasStyle.getPropertyValue("--wordmark").trim() || "var(--ink)"
      const tmColor =
        canvasStyle.getPropertyValue("--wordmark-tm").trim() ||
        "var(--brand-accent)"

      textCanvas.width = w
      textCanvas.height = h
      tctx.clearRect(0, 0, w, h)

      const word = "PabloZarate"
      const tm = "™"

      // Fit the word to ~84% of the width.
      let fontSize = Math.floor(h * 0.5)
      const fit = () => {
        tctx.font = `700 ${fontSize}px ${fontFamily}`
        tctx.letterSpacing = `${-fontSize * 0.04}px` // tight track
        const wordW = tctx.measureText(word).width
        const tmW = tctx.measureText(tm).width * 0.55
        return wordW + tmW
      }
      let total = fit()
      const target = w * 0.84
      fontSize = Math.floor(fontSize * (target / total))
      total = fit()

      const startX = (w - total) / 2
      const baseY = h / 2

      tctx.textBaseline = "middle"
      tctx.textAlign = "left"

      tctx.fillStyle = wordColor
      tctx.fillText(word, startX, baseY)

      const wordW = tctx.measureText(word).width
      // Superscript trademark.
      const tmSize = Math.floor(fontSize * 0.42)
      tctx.font = `700 ${tmSize}px ${fontFamily}`
      tctx.letterSpacing = "0px"
      tctx.fillStyle = tmColor
      tctx.fillText(tm, startX + wordW + fontSize * 0.02, baseY - fontSize * 0.32)

      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        textCanvas,
      )
    }

    // ---- Sizing ----
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      drawText(w, h)
    }

    // ---- Interaction state ----
    const mouse = { x: 0.5, y: 0.5 }
    const target = { x: 0.5, y: 0.5 }
    let hover = 0
    let hoverTarget = 0
    let energy = 0
    let seed = Math.random()
    const last = { x: 0.5, y: 0.5 }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      target.x = x
      target.y = 1 - y // flip for uv

      // "Approximation": stronger presence the closer to the wordmark center.
      const dx = x - 0.5
      const dy = y - 0.5
      const d = Math.sqrt(dx * dx + dy * dy)
      hoverTarget = Math.max(0, 1 - d * 1.6)

      const sp = Math.hypot(target.x - last.x, target.y - last.y)
      energy = Math.min(1, energy + sp * 6)
      last.x = target.x
      last.y = target.y

      // Re-randomize the burst when re-entering from far away.
      if (hover < 0.05) seed = Math.random()
    }
    const onLeave = () => {
      hoverTarget = 0
    }

    window.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize)
      ro.observe(canvas)
    } else {
      window.addEventListener("resize", resize)
    }

    // ---- Render loop ----
    let raf = 0
    const start = performance.now()
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        resize()
      })
    }
    resize()

    const loop = () => {
      const time = (performance.now() - start) / 1000

      // Easing.
      mouse.x += (target.x - mouse.x) * 0.18
      mouse.y += (target.y - mouse.y) * 0.18
      hover += (hoverTarget - hover) * 0.08
      energy *= 0.93

      gl.useProgram(prog)
      gl.uniform1i(uTex, 0)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.uniform1f(uTime, time)
      gl.uniform1f(uHover, hover)
      gl.uniform1f(uEnergy, energy)
      gl.uniform1f(uSeed, seed)
      gl.uniform1f(uEffect, effectRef.current)
      gl.uniform1f(uIntensity, intensityRef.current)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      if (ro) ro.disconnect()
      else window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="PabloZarate trademark wordmark"
    />
  )
}
