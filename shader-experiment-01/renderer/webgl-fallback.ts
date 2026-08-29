import type {
  RendererFailureHandler,
  WordmarkBackend,
  WordmarkFrame,
} from "./contracts"

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
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

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("WebGL could not allocate a shader.")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) || "unknown compile error"
    gl.deleteShader(shader)
    throw new Error(`WebGL shader compilation failed: ${detail}`)
  }
  return shader
}

function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) throw new Error(`WebGL uniform ${name} is unavailable.`)
  return location
}

export function createWebglRenderer(
  canvas: HTMLCanvasElement,
  onFatal: RendererFailureHandler,
  signal: AbortSignal,
): WordmarkBackend {
  if (signal.aborted) {
    throw new DOMException("Wordmark renderer initialization aborted.", "AbortError")
  }

  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: true,
  })
  if (!gl) throw new Error("WebGL is unavailable.")

  let disposed = false
  let program: WebGLProgram | undefined
  let buffer: WebGLBuffer | undefined
  let texture: WebGLTexture | undefined

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    if (!disposed) onFatal(new Error("WebGL context lost."))
  }

  canvas.addEventListener("webglcontextlost", handleContextLost)

  try {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const nextProgram = gl.createProgram()
    if (!nextProgram) throw new Error("WebGL could not allocate a program.")
    program = nextProgram
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(
        `WebGL shader linking failed: ${gl.getProgramInfoLog(program) || "unknown link error"}`,
      )
    }

    const nextBuffer = gl.createBuffer()
    if (!nextBuffer) throw new Error("WebGL could not allocate a vertex buffer.")
    buffer = nextBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const position = gl.getAttribLocation(program, "aPos")
    if (position < 0) throw new Error("WebGL vertex position is unavailable.")
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const nextTexture = gl.createTexture()
    if (!nextTexture) throw new Error("WebGL could not allocate a text texture.")
    texture = nextTexture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    )

    const uniforms = {
      texture: requireUniform(gl, program, "uTex"),
      resolution: requireUniform(gl, program, "uRes"),
      mouse: requireUniform(gl, program, "uMouse"),
      time: requireUniform(gl, program, "uTime"),
      hover: requireUniform(gl, program, "uHover"),
      energy: requireUniform(gl, program, "uEnergy"),
      seed: requireUniform(gl, program, "uSeed"),
      effect: requireUniform(gl, program, "uEffect"),
      intensity: requireUniform(gl, program, "uIntensity"),
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    return {
      kind: "webgl",
      resize(width, height) {
        if (disposed) return
        canvas.width = Math.max(1, width)
        canvas.height = Math.max(1, height)
        gl.viewport(0, 0, canvas.width, canvas.height)
      },
      uploadText(source) {
        if (disposed) return
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture!)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source,
        )
      },
      render(current: WordmarkFrame) {
        if (disposed || gl.isContextLost()) return
        try {
          gl.useProgram(program!)
          gl.uniform1i(uniforms.texture, 0)
          gl.uniform2f(
            uniforms.resolution,
            current.resolution[0],
            current.resolution[1],
          )
          gl.uniform2f(uniforms.mouse, current.mouse[0], current.mouse[1])
          gl.uniform1f(uniforms.time, current.time)
          gl.uniform1f(uniforms.hover, current.hover)
          gl.uniform1f(uniforms.energy, current.energy)
          gl.uniform1f(uniforms.seed, current.seed)
          gl.uniform1f(uniforms.effect, current.effect)
          gl.uniform1f(uniforms.intensity, current.intensity)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, texture!)
          gl.drawArrays(gl.TRIANGLES, 0, 6)
        } catch (error) {
          onFatal(error)
        }
      },
      dispose() {
        if (disposed) return
        disposed = true
        canvas.removeEventListener("webglcontextlost", handleContextLost)
        if (!gl.isContextLost()) {
          if (texture) gl.deleteTexture(texture)
          if (buffer) gl.deleteBuffer(buffer)
          if (program) gl.deleteProgram(program)
        }
        texture = undefined
        buffer = undefined
        program = undefined
      },
    }
  } catch (error) {
    disposed = true
    canvas.removeEventListener("webglcontextlost", handleContextLost)
    if (!gl.isContextLost()) {
      if (texture) gl.deleteTexture(texture)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
    }
    throw error
  }
}
