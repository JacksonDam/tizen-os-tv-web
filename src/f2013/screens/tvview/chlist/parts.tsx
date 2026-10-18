import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { FONT, IMG_SCALE, argb, img } from '../common'

// Drawing helpers for the Channel List (exeDSP CCImageCompositeDrawing, CCTextAniDrawing).

// A composite (nine-slice) image stretched over w x h stage px. CChannelListUtil::SetCompositeRect
// (0x029c2db0) slices an image W x H into corners of (W-1-W/2, W/2) x (H-1-H/2, H/2) around a 1 px
// stretchable centre. The bitmap's own pixels are 1280-OSD pixels (x1.5 on the stage).
export function Composite({ src, iw, ih, x, y, w, h, style }: {
  src: string
  iw: number
  ih: number
  x: number
  y: number
  w: number
  h: number
  style?: CSSProperties
}) {
  const l = iw - 1 - Math.floor(iw / 2)
  const r = Math.floor(iw / 2)
  const t = ih - 1 - Math.floor(ih / 2)
  const b = Math.floor(ih / 2)
  const k = IMG_SCALE
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderStyle: 'solid',
        borderWidth: `${t * k}px ${r * k}px ${b * k}px ${l * k}px`,
        borderImage: `url(${img(src)}) ${t} ${r} ${b} ${l} fill / ${t * k}px ${r * k}px ${b * k}px ${l * k}px stretch`,
        ...style,
      }}
    />
  )
}

// CCTextAniDrawing: one line in a box, abbreviated with an ellipsis (SetAbbrText) and, while
// StartScroll is on and the text does not fit, scrolled after SetStartDelay(1000), held for
// SetEndDelay(1000), stepping every SetTextScrollInterval(30) ms. The step size is not in the
// callers: 1 OSD px per step (x1.5 on the stage) is inferred.
const SCROLL_PX_PER_MS = 1.5 / 30

export function AniText({ text, x, y, w, h, size, color, align = 'left', scroll = false, opacity = 1, weight = 300 }: {
  text: string
  x: number
  y: number
  w: number
  h: number
  size: number
  color: number
  align?: 'left' | 'center' | 'right'
  scroll?: boolean
  opacity?: number
  weight?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const b = box.current
    const s = inner.current
    if (!b || !s || !scroll) return
    const over = s.scrollWidth - b.clientWidth
    if (over <= 0) return
    const move = over / SCROLL_PX_PER_MS
    const total = 1000 + move + 1000
    const anim = s.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: 1000 / total },
        { transform: `translateX(${-over}px)`, offset: (1000 + move) / total },
        { transform: `translateX(${-over}px)`, offset: 1 },
      ],
      { duration: total, iterations: Infinity },
    )
    return () => anim.cancel()
  }, [scroll, text, w, size])
  return (
    <div
      ref={box}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        overflow: 'hidden',
        fontFamily: FONT,
        fontWeight: weight,
        fontSize: size,
        color: argb(color),
        opacity,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        ref={inner}
        style={{
          display: 'block',
          overflow: scroll ? 'visible' : 'hidden',
          textOverflow: scroll ? 'clip' : 'ellipsis',
          maxWidth: scroll ? undefined : '100%',
        }}
      >
        {text}
      </span>
    </div>
  )
}

// CChannelListTextViewRenderer::m_DrawChannelNumber (0x029b8738): one ch_num_30_* bitmap per
// character of the "%d" channel string (CCountryOption::t_GetChannelNum), CHANNEL_NUMBER_GAP apart.
const DIGIT: Record<string, string> = { '-': 'hyphen', '.': 'dot' }
export function ChannelNumber({ value, x, y, gap, opacity }: { value: string; x: number; y: number; gap: number; opacity: number }) {
  return (
    <>
      {[...value].slice(0, 8).map((c, i) => (
        <img
          key={i}
          src={img(`ChannelList/ch_num_30_${DIGIT[c] ?? `0${c}`}.bmp`)}
          alt=""
          draggable={false}
          style={{ position: 'absolute', left: x + gap * i, top: y, width: 15 * IMG_SCALE, height: 20 * IMG_SCALE, opacity }}
        />
      ))}
    </>
  )
}

// A firmware bitmap at stage position (x, y) at its OSD size (x1.5). The offset is applied by a
// wrapper so that the zoom scales only the bitmap, not its position.
export function Pic({ src, x, y, style }: { src: string; x: number; y: number; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, lineHeight: 0, ...style }}>
      <img src={img(src)} alt="" draggable={false} style={{ display: 'block', zoom: IMG_SCALE }} />
    </div>
  )
}
