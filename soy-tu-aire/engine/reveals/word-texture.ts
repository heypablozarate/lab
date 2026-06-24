export function makeWordTexture(gl: WebGL2RenderingContext, word: string): WebGLTexture {
  const cv = document.createElement("canvas")
  cv.width = 512; cv.height = 256
  const ctx = cv.getContext("2d")!
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = "#16151a"
  ctx.font = "120px Georgia, 'Times New Roman', serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(word, cv.width / 2, cv.height / 2)
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  return tex
}
