import { fbm5, floor_mod, glyph5x5, hash21, rotate2, value_noise } from "./wordmark-common.wgsl";

struct Params {
  resolution: vec2f,
  mouse: vec2f,
  time: f32,
  hover: f32,
  energy: f32,
  seed: f32,
  effect: u32,
  intensity: f32,
  _padding: vec2f,
}

@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var textTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;

fn text_sample(logicalUv: vec2f) -> vec4f {
  // vgpu's fullscreen UV starts at the top. The original renderer calculated
  // every effect in bottom-origin GL space, so only this boundary flips back
  // to the top-origin Canvas2D texture.
  return textureSample(textTexture, linearSampler, vec2f(logicalUv.x, 1.0 - logicalUv.y));
}

fn sample_chroma(logicalUv: vec2f, offset: vec2f) -> vec4f {
  let red = text_sample(logicalUv + offset);
  let green = text_sample(logicalUv);
  let blue = text_sample(logicalUv - offset);
  return vec4f(red.r, green.g, blue.b, max(max(red.a, green.a), blue.a));
}

@fragment
fn fs_main(@location(0) topUv: vec2f) -> @location(0) vec4f {
  let uv = vec2f(topUv.x, 1.0 - topUv.y);
  let aspect = params.resolution.x / max(params.resolution.y, 1.0);
  let point = vec2f(uv.x * aspect, uv.y);
  let mouse = vec2f(params.mouse.x * aspect, params.mouse.y);
  let distanceToMouse = distance(point, mouse);
  let proximity = 1.0 - smoothstep(0.0, 0.45, distanceToMouse);
  let field = proximity * params.hover;
  let intensity = params.intensity;
  let direction = (point - mouse) / (distanceToMouse + 0.0001);
  let animatedTime = params.time * (0.6 + params.energy * 1.8);
  let fragmentPx = uv * params.resolution;

  var displacement = vec2f(0.0);
  var chromaOffset = vec2f(0.0);
  var sparkle = 0.0;

  if (params.effect == 0u) {
    let firstNoise = value_noise(uv * 9.0 + vec2f(params.seed * 13.0, animatedTime));
    let secondNoise = value_noise(uv * 18.0 - vec2f(animatedTime * 1.3, params.seed * 7.0));
    let amplitude = field * (0.05 + params.energy * 0.06) * intensity;
    displacement = vec2f(firstNoise - 0.5, secondNoise - 0.5) * amplitude;
    chromaOffset = direction * (0.006 + params.energy * 0.012) * field * intensity;
    sparkle = 0.25;
  } else if (params.effect == 1u) {
    let ripple = sin(distanceToMouse * 42.0 - params.time * 7.0) * field * 0.03 * intensity;
    displacement = direction * ripple;
    chromaOffset = direction * 0.004 * field * intensity;
    sparkle = 0.1;
  } else if (params.effect == 2u) {
    chromaOffset = direction * (0.02 + params.energy * 0.03) * field * intensity;
  } else if (params.effect == 3u) {
    let line = floor(uv.y * 26.0);
    let randomLine = hash21(vec2f(line, floor(params.time * 14.0) + params.seed * 30.0));
    let shift = (randomLine - 0.5) * field * 0.25 * intensity * step(0.55, randomLine);
    displacement = vec2f(shift, 0.0);
    chromaOffset = vec2f(0.014 * field * intensity, 0.0);
    sparkle = 0.4;
  } else if (params.effect == 4u) {
    let angle = field * (2.6 + params.energy * 3.0) * intensity;
    let relative = rotate2(point - mouse, angle) + mouse;
    displacement = vec2f(relative.x / aspect, relative.y) - uv;
    chromaOffset = direction * 0.005 * field * intensity;
    sparkle = 0.15;
  }

  var outputColor: vec4f;

  if (params.effect <= 4u) {
    let sampled = sample_chroma(uv + displacement, chromaOffset);
    var color = sampled.rgb;
    let flicker = value_noise(uv * 60.0 + vec2f(params.time * 3.0 + params.seed * 20.0));
    color += vec3f(sampled.a * field * (flicker - 0.5) * sparkle * intensity);
    outputColor = vec4f(color, sampled.a);
  } else if (params.effect == 5u) {
    let cellSize = mix(11.0, 6.0, clamp(intensity * 0.5, 0.0, 1.0));
    let cell = floor(fragmentPx / cellSize);
    let wobble = vec2f(
      value_noise(cell * 0.3 + vec2f(animatedTime)),
      value_noise(cell * 0.3 - vec2f(animatedTime)),
    ) - vec2f(0.5);
    let centerUv = (cell + vec2f(0.5)) * cellSize / params.resolution
      + wobble * field * 0.02 * intensity;
    let sampled = sample_chroma(centerUv, direction * 0.004 * field * intensity);
    let coverage = sampled.a;
    var glyph = 4096u;
    if (coverage > 0.15) { glyph = 65600u; }
    if (coverage > 0.3) { glyph = 163153u; }
    if (coverage > 0.45) { glyph = 15255086u; }
    if (coverage > 0.6) { glyph = 13195790u; }
    if (coverage > 0.78) { glyph = 11512810u; }
    let glyphPoint = fract(fragmentPx / cellSize) * 2.0 - vec2f(1.0);
    let mask = glyph5x5(glyph, glyphPoint);
    outputColor = vec4f(sampled.rgb, mask * smoothstep(0.05, 0.18, coverage));
  } else if (params.effect == 6u) {
    let cellSize = 7.0;
    let cell = floor(fragmentPx / cellSize);
    let centerPx = (cell + vec2f(0.5)) * cellSize;
    let centerUv = centerPx / params.resolution;
    let sampled = sample_chroma(centerUv, vec2f(0.0));
    let coverage = sampled.a;
    let randomDirection = vec2f(hash21(cell), hash21(cell + vec2f(7.3))) - vec2f(0.5);
    let correctedCenter = vec2f(centerUv.x * aspect, centerUv.y);
    let particleDirection = (correctedCenter - mouse) / (distance(correctedCenter, mouse) + 0.0001);
    let scatter = (randomDirection * cellSize * 3.0 + particleDirection * params.resolution.y * 0.06)
      * field * intensity + randomDirection * cellSize * params.energy * 4.0;
    let particlePosition = centerPx + scatter;
    let particleDistance = distance(fragmentPx, particlePosition);
    let radius = cellSize * 0.55 * smoothstep(0.05, 0.6, coverage);
    let mask = 1.0 - smoothstep(radius - 1.5, radius, particleDistance);
    outputColor = vec4f(sampled.rgb, mask * step(0.05, coverage));
  } else if (params.effect == 7u) {
    let cellSize = mix(9.0, 5.0, clamp(intensity * 0.5, 0.0, 1.0));
    let cell = floor(fragmentPx / cellSize);
    let centerUv = (cell + vec2f(0.5)) * cellSize / params.resolution;
    let sampled = sample_chroma(centerUv, direction * 0.003 * field * intensity);
    let coverage = sampled.a;
    let dotDistance = distance(fragmentPx, (cell + vec2f(0.5)) * cellSize);
    let radius = cellSize * 0.6 * sqrt(coverage) * (1.0 + field * 0.4 * intensity);
    let mask = 1.0 - smoothstep(radius - 1.0, radius, dotDistance);
    outputColor = vec4f(sampled.rgb, mask * step(0.04, coverage));
  } else if (params.effect == 8u) {
    let cellSize = mix(3.0, 24.0, clamp(intensity * 0.5 + field * 0.4, 0.0, 1.0));
    let quantizedUv = (floor(fragmentPx / cellSize) + vec2f(0.5)) * cellSize / params.resolution;
    outputColor = sample_chroma(quantizedUv, direction * 0.01 * field * intensity);
  } else if (params.effect == 9u) {
    var wavedUv = uv;
    let amplitude = (0.012 + field * 0.03) * intensity;
    wavedUv.x += sin(uv.y * 26.0 + params.time * 4.0) * amplitude;
    wavedUv.y += sin(uv.x * 18.0 + params.time * 3.0) * amplitude * 0.7;
    outputColor = sample_chroma(wavedUv, direction * 0.005 * field * intensity);
  } else if (params.effect == 10u) {
    let centered = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);
    var angle = atan2(centered.y, centered.x);
    let radius = length(centered);
    let segment = 6.2831853 / 8.0;
    angle = abs(floor_mod(angle, segment) - segment * 0.5)
      + params.time * 0.15 * intensity + field * intensity;
    let kaleidoscope = vec2f(cos(angle), sin(angle)) * radius;
    outputColor = sample_chroma(
      vec2f(kaleidoscope.x / aspect + 0.5, kaleidoscope.y + 0.5),
      vec2f(0.0),
    );
  } else if (params.effect == 11u) {
    let centered = point - mouse;
    let radius = length(centered);
    let factor = 1.0 - field * (0.9 * intensity) * exp(-radius * radius * 7.0);
    let displaced = mouse + centered * factor;
    outputColor = sample_chroma(
      vec2f(displaced.x / aspect, displaced.y),
      direction * 0.004 * field * intensity,
    );
  } else if (params.effect == 12u) {
    let texel = 2.0 / params.resolution;
    let left = text_sample(uv + vec2f(-texel.x, 0.0)).a;
    let right = text_sample(uv + vec2f(texel.x, 0.0)).a;
    let up = text_sample(uv + vec2f(0.0, texel.y)).a;
    let down = text_sample(uv + vec2f(0.0, -texel.y)).a;
    let edge = clamp(length(vec2f(right - left, up - down)) * 2.2, 0.0, 1.0);
    let sampled = text_sample(uv);
    let pulse = 0.5 + 0.5 * sin(params.time * 4.0);
    let rim = mix(sampled.rgb, vec3f(0.78, 0.28, 0.14), field * intensity * (0.5 + 0.5 * pulse));
    outputColor = vec4f(rim, edge * (0.6 + field * 0.4 * intensity + 0.2 * pulse));
  } else if (params.effect == 13u) {
    var centered = uv - vec2f(0.5);
    centered *= 1.0 + dot(centered, centered) * (0.12 + field * 0.1) * intensity;
    let crtUv = centered + vec2f(0.5);
    let sampled = sample_chroma(crtUv, vec2f((0.004 + field * 0.006) * intensity, 0.0));
    let scanline = 0.82 + 0.18 * sin(crtUv.y * params.resolution.y * 0.6 - params.time * 12.0);
    let vignette = 1.0 - smoothstep(0.5, 1.05, length(centered) * 1.4);
    outputColor = vec4f(sampled.rgb * scanline, sampled.a * scanline * vignette);
  } else if (params.effect == 14u) {
    let noiseValue = fbm5(uv * 6.0 + vec2f(params.time * 0.25 + params.seed * 5.0));
    let threshold = clamp(field * intensity, 0.0, 1.2);
    let sampled = sample_chroma(uv, vec2f(0.0));
    let keep = smoothstep(threshold - 0.05, threshold, noiseValue);
    let ember = smoothstep(threshold, threshold + 0.07, noiseValue)
      - smoothstep(threshold - 0.07, threshold, noiseValue);
    var color = mix(vec3f(0.85, 0.3, 0.12), sampled.rgb, keep);
    color += vec3f(0.95, 0.45, 0.12) * ember;
    outputColor = vec4f(color, sampled.a * keep + sampled.a * ember);
  } else {
    let grid = vec2f(14.0, 8.0);
    let gridPosition = uv * grid;
    let cell = floor(gridPosition);
    let fraction = fract(gridPosition);
    let randomDirection = vec2f(hash21(cell), hash21(cell + vec2f(19.7))) - vec2f(0.5);
    let spin = (hash21(cell + vec2f(3.0)) - 0.5) * field * intensity;
    let local = rotate2(fraction - vec2f(0.5), spin) + vec2f(0.5);
    let drift = randomDirection * field * 1.2 * intensity;
    let shardUv = (cell + local + drift) / grid;
    let sampled = sample_chroma(shardUv, direction * 0.004 * field * intensity);
    let crack = smoothstep(0.0, 0.04, min(fraction.x, fraction.y));
    outputColor = vec4f(sampled.rgb, sampled.a * mix(1.0, crack, field * 0.5 * intensity));
  }

  return outputColor;
}
