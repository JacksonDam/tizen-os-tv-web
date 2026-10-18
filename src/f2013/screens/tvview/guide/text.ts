import { useEffect, useState } from 'react'

// Text measuring for the Guide: exeDSP lays text out by measured extents (CCTextDrawing::GetTextExtent)
// and abbreviates overflowing text with "..." (CResourceManager::STRING(0) = "...", three dots).

let ctx: CanvasRenderingContext2D | null = null

export function textWidth(text: string, size: number, weight = 300) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * size * 0.5
  ctx.font = `${weight} ${size}px SamsungSVD`
  return ctx.measureText(text).width
}

export const DOTS = '...'

// The text cut to fit maxW, with "..." appended when it had to be cut.
export function fitText(text: string, size: number, maxW: number, weight = 300) {
  if (maxW <= 0) return ''
  if (textWidth(text, size, weight) <= maxW) return text
  const dots = textWidth(DOTS, size, weight)
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (textWidth(text.slice(0, mid), size, weight) + dots <= maxW) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo).trimEnd() + DOTS
}

// Word-wrapped lines (at most maxRows, the last one abbreviated) for multi-line labels.
export function wrapText(text: string, size: number, maxW: number, maxRows: number, weight = 300) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]
    if (textWidth(next, size, weight) <= maxW || !cur) {
      cur = next
      continue
    }
    lines.push(cur)
    cur = words[i]
    if (lines.length === maxRows) {
      lines[maxRows - 1] = fitText(`${lines[maxRows - 1]} ${words.slice(i).join(' ')}`, size, maxW, weight)
      return lines
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// Re-render once the web fonts are ready (measurements taken before that use a fallback font).
export function useFontsReady() {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || document.fonts.status === 'loaded')
  useEffect(() => {
    if (ready) return
    let alive = true
    void document.fonts.ready.then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [ready])
  return ready
}
