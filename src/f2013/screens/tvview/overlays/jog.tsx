import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { img } from '../common'

// CViewerSmartListProgressIndicator (Create 0x0250e100, Show 0x0250db40, UpdateProgress 0x0250d518,
// Hide 0x0250d880, CreateForegroundImage 0x0250de7c): the round "jog" at the screen edge used by the
// channel banner and the volume OSD. A frosted disc and a blue ring with a glow (the "foreground"
// image) that turns with the position in a range: rotation = dir*120 - pos/(n-1)*120*dir degrees
// (0 at the last position), minus 60 for the channel variant. The engine's z rotation turns
// counter-clockwise on screen (checked against the reference footage: a low channel number puts the
// channel jog's glow at the lower left), so CSS gets the negated angle.
//   - the whole jog slides in from `hiddenX` to `x` (300 ms, accel types 0/2 ~ ease-out) when shown and
//     back out when hidden with animation;
//   - a position change of at most one step turns at once; larger steps animate (200 ms under 4
//     steps, else 400 ms), wrapping a full turn the way the step went.

export type JogKind = 'channel' | 'volume'

const EASE_OUT = 'cubic-bezier(0.25, 0.6, 0.35, 1)' // (inferred) CCAniBase accel type 2 with ratio 0.3
const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.55, 1)' // (inferred) accel types 1/1 with ratio 0.3

function angleFor(kind: JogKind, pos: number, n: number): number {
  const dir = kind === 'channel' ? 1 : -1 // b8c: +1 channel (b84 = 1), -1 volume
  let a = n < 2 || pos >= n - 1 ? 0 : dir * 120 - (pos / (n - 1)) * 120 * dir
  if (kind === 'channel') a -= 60 // b88 == 1
  return a
}

export function Jog({ kind, x, hiddenX, y, size, shown, pos, count, up, highlightAtMin, onHidden }: {
  kind: JogKind
  x: number          // shown position (window px)
  hiddenX: number    // where it slides from / to
  y: number
  size: number       // stage px (bitmap size x1.5)
  shown: boolean
  pos: number
  count: number
  up: boolean        // the last step went up (CH +, VOL +): wraps a full turn the other way
  highlightAtMin: boolean
  onHidden?: () => void
}) {
  const [present, setPresent] = useState(shown)
  const [inPlace, setInPlace] = useState(false)
  const angle = useRef(angleFor(kind, pos, count))
  const last = useRef({ pos, shown: false })
  const [rot, setRot] = useState({ a: angle.current, ms: 0 })

  // slide in / out
  useEffect(() => {
    if (shown) {
      setPresent(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setInPlace(true)))
      return () => cancelAnimationFrame(r)
    }
    setInPlace(false)
    const t = setTimeout(() => {
      setPresent(false)
      onHidden?.()
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  // turn with the position
  useEffect(() => {
    const target = angleFor(kind, pos, count)
    const prev = last.current
    last.current = { pos, shown }
    if (!shown || !prev.shown) {
      // (re)shown: Show() sets the rotation directly
      angle.current = target
      setRot({ a: target, ms: 0 })
      return
    }
    const d = pos - prev.pos
    if (d === 0) return
    if (Math.abs(d) <= 1) {
      angle.current = target
      setRot({ a: target, ms: 0 })
      return
    }
    let t = target
    if (!up && prev.pos < pos) t += 360
    else if (up && pos < prev.pos) t -= 360
    angle.current = t
    setRot({ a: t, ms: Math.abs(d) < 4 ? 200 : 400 })
  }, [kind, pos, count, shown, up])

  if (!present) return null
  const glowHidden = count < 2 || (!highlightAtMin && pos === 0)
  const s: CSSProperties = {
    position: 'absolute',
    left: inPlace ? x : hiddenX,
    top: y,
    width: size,
    height: size,
    transition: `left 300ms ${EASE_OUT}`,
  }
  const files = kind === 'channel'
    ? ['TVViewer/ch_jog_main.bmp', 'TVViewer/ch_jog_line.bmp', 'TVViewer/ch_jog_lighting.bmp']
    : ['TVViewer/jog_main_re.bmp', 'TVViewer/jog_lighting_bg_vol.bmp', 'TVViewer/jog_light_highlight_re.bmp']
  // the volume glow sits on a child object turned by +60 (CreateForegroundImage, b84 = 0)
  const glowOffset = kind === 'volume' ? 60 : 0
  const layer: CSSProperties = { position: 'absolute', left: 0, top: 0, width: size, height: size }
  return (
    <div style={s}>
      <img src={img(files[0])} alt="" style={layer} />
      <img src={img(files[1])} alt="" style={layer} />
      {!glowHidden && (
        <img
          src={img(files[2])}
          alt=""
          style={{
            ...layer,
            transform: `rotate(${-(rot.a + glowOffset)}deg)`,
            transition: rot.ms ? `transform ${rot.ms}ms ${EASE_IN_OUT}` : 'none',
          }}
        />
      )}
    </div>
  )
}
