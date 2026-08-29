export interface TextRasterContext {
  font: string
  fillStyle: string | CanvasGradient | CanvasPattern
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  letterSpacing?: string
  clearRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  measureText(text: string): Pick<TextMetrics, "width">
}

export type TextRasterMetrics = Readonly<{
  width: number
  height: number
  fontSize: number
  measuredWidth: number
  drawnWidth: number
  startX: number
  baseY: number
}>

const safeDimension = (value: number) =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

const safeWidth = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : Number.MAX_SAFE_INTEGER

function setFont(
  context: TextRasterContext,
  size: number,
  family: string,
  tracking: number,
) {
  context.font = `700 ${size}px ${family}`
  if ("letterSpacing" in context) {
    context.letterSpacing = `${tracking}px`
  }
}

export function splitTrademark(text: string): readonly [string, string] {
  return text.endsWith("™") ? [text.slice(0, -1), "™"] : [text, ""]
}

export function rasterizeWordmark({
  context,
  width,
  height,
  text,
  fontFamily,
  wordColor,
  trademarkColor,
}: {
  context: TextRasterContext
  width: number
  height: number
  text: string
  fontFamily: string
  wordColor: string
  trademarkColor: string
}): TextRasterMetrics {
  const safeW = safeDimension(width)
  const safeH = safeDimension(height)
  const targetWidth = Math.max(1, safeW * 0.84)
  const [word, trademark] = splitTrademark(text)
  const initialSize = Math.max(1, Math.floor(safeH * 0.5))

  context.clearRect(0, 0, safeW, safeH)

  const measureAt = (size: number) => {
    setFont(context, size, fontFamily, -size * 0.04)
    const wordWidth = safeWidth(context.measureText(word).width)
    const trademarkWidth = trademark
      ? safeWidth(context.measureText(trademark).width) * 0.55
      : 0
    return { wordWidth, trademarkWidth, total: wordWidth + trademarkWidth }
  }

  const initial = measureAt(initialSize)
  const ratio = initial.total > 0 ? targetWidth / initial.total : 1
  const scaledSize = Math.floor(initialSize * ratio)
  const maxFiniteSize = Math.max(initialSize, safeH * 4)
  const fontSize = Math.max(
    1,
    Math.min(
      maxFiniteSize,
      Number.isFinite(scaledSize) ? scaledSize : initialSize,
    ),
  )
  const measured = measureAt(fontSize)
  const displayScale =
    measured.total > 0 ? Math.min(1, targetWidth / measured.total) : 1
  const drawnWidth = safeWidth(measured.total * displayScale)
  const startX = (safeW - drawnWidth) / 2
  const baseY = safeH / 2

  context.textBaseline = "middle"
  context.textAlign = "left"

  if (word) {
    context.fillStyle = wordColor
    context.fillText(
      word,
      startX,
      baseY,
      Math.max(1, measured.wordWidth * displayScale),
    )
  }

  if (trademark) {
    const trademarkSize = Math.max(1, Math.floor(fontSize * 0.42))
    setFont(context, trademarkSize, fontFamily, 0)
    context.fillStyle = trademarkColor
    context.fillText(
      trademark,
      startX + measured.wordWidth * displayScale + fontSize * 0.02,
      baseY - fontSize * 0.32,
      Math.max(1, measured.trademarkWidth * displayScale),
    )
  }

  return {
    width: safeW,
    height: safeH,
    fontSize,
    measuredWidth: measured.total,
    drawnWidth,
    startX,
    baseY,
  }
}

export function resolveCanvasColor(
  canvas: HTMLCanvasElement,
  customProperty: string,
  fallback: string,
): string {
  const styles = getComputedStyle(canvas)
  const specified = styles.getPropertyValue(customProperty).trim()
  const parent = canvas.parentElement ?? document.body ?? document.documentElement
  const probe = document.createElement("span")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText =
    "position:fixed;inset:auto;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none"
  probe.style.color = specified || fallback
  parent.appendChild(probe)

  try {
    return getComputedStyle(probe).color || fallback
  } finally {
    probe.remove()
  }
}
