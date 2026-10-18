import { useEffect, useRef, useState } from 'react'
import { currentVideo, useTv } from './store'

// Ambilight: the set's rear-facing LEDs wash colour onto the wall around the TV. In the exhibit the
// wash is drawn in the letterbox around the scaled stage. The colour is cycled on a timer per mode
// rather than sampled from the picture (inferred: the real set derives it from the live video, which
// a muted cross-origin-safe loop here does not expose).
const PALETTE = ['#2b6cff', '#17a2b8', '#38b24a', '#d8a200', '#c0392b', '#7d3cff']

export function Ambilight() {
  const mode = useTv(s => s.ambilight)
  const power = useTv(s => s.power)
  const hasPicture = useTv(s => !!currentVideo(s))
  const [i, setI] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  const period = mode === 'relaxed' ? 9000 : mode === 'moderate' ? 5000 : mode === 'dynamic' ? 2200 : 0
  useEffect(() => {
    clearInterval(timer.current)
    if (period) timer.current = setInterval(() => setI(n => n + 1), period)
    return () => clearInterval(timer.current)
  }, [period])

  if (power !== 'on' || mode === 'off' || !hasPicture) return null
  // "Color" mode holds a single custom colour; the active modes cycle through the palette.
  const left = mode === 'color' ? PALETTE[0] : PALETTE[i % PALETTE.length]
  const right = mode === 'color' ? PALETTE[0] : PALETTE[(i + 3) % PALETTE.length]
  const dur = `${Math.max(period, 1500)}ms`
  return (
    <div className="ph-ambilight" aria-hidden>
      <div className="ph-ambilight__side ph-ambilight__side--l" style={{ background: left, transition: `background ${dur} linear` }} />
      <div className="ph-ambilight__side ph-ambilight__side--r" style={{ background: right, transition: `background ${dur} linear` }} />
    </div>
  )
}
