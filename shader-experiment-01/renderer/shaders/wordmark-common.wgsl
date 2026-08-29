export fn hash21(point: vec2f) -> f32 {
  return fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453123);
}

export fn value_noise(point: vec2f) -> f32 {
  let cell = floor(point);
  let fraction = fract(point);
  let a = hash21(cell);
  let b = hash21(cell + vec2f(1.0, 0.0));
  let c = hash21(cell + vec2f(0.0, 1.0));
  let d = hash21(cell + vec2f(1.0, 1.0));
  let eased = fraction * fraction * (vec2f(3.0) - 2.0 * fraction);
  return mix(a, b, eased.x)
    + (c - a) * eased.y * (1.0 - eased.x)
    + (d - b) * eased.x * eased.y;
}

export fn fbm5(point: vec2f) -> f32 {
  var position = point;
  var value = 0.0;
  var amplitude = 0.5;
  for (var octave = 0u; octave < 5u; octave += 1u) {
    value += amplitude * value_noise(position);
    position *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

export fn rotate2(point: vec2f, angle: f32) -> vec2f {
  let sine = sin(angle);
  let cosine = cos(angle);
  // Matches GLSL's column-major mat2(c, -s, s, c) multiplication.
  return vec2f(
    cosine * point.x + sine * point.y,
    -sine * point.x + cosine * point.y,
  );
}

export fn floor_mod(value: f32, divisor: f32) -> f32 {
  return value - divisor * floor(value / divisor);
}

export fn glyph5x5(bits: u32, point: vec2f) -> f32 {
  let cell = vec2i(floor(point * vec2f(4.0, -4.0) + vec2f(2.5)));
  if (cell.x < 0 || cell.x > 4 || cell.y < 0 || cell.y > 4) {
    return 0.0;
  }
  let index = u32(cell.x + 5 * cell.y);
  return f32((bits >> index) & 1u);
}
