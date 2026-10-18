import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

// CCTextAniDrawing as the Smart Hub panels set it up: one line, cut with the abbreviation string "…"
// (g_HomePanelWStringEng 0x69) while it does not fit; when the item has the focus and the text is too
// long it scrolls left continuously (SetScrollMotionType 4, SetContinuousScrollGap
// GBHOME_COMMON_ITEM_TEXT_SCROLL_GAP = 60) after SetStartDelay(1000). SetTextScrollSpeed(0x1e) is read as
// 30 ms per pixel (inferred: the unit is not visible in the decompile).
const SCROLL_MS_PER_PX = 30
const START_DELAY = 1000
const GAP = 60

export function ScrollText({ text, scroll, style, className }: {
  text: string
  scroll: boolean
  style?: CSSProperties
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const [over, setOver] = useState(0) // width of the text when it overflows the box, else 0
  useLayoutEffect(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    const w = i.scrollWidth
    setOver(w > b.clientWidth + 0.5 ? w : 0)
  }, [text, style?.width, style?.fontSize])
  const moving = scroll && over > 0
  const dist = over + GAP
  return (
    <div
      ref={box}
      className={className}
      style={{ ...style, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: moving ? 'clip' : 'ellipsis' }}
    >
      {moving ? (
        <span
          key={text}
          style={{
            display: 'inline-block',
            textAlign: 'left',
            animation: `hub-marquee ${dist * SCROLL_MS_PER_PX}ms linear ${START_DELAY}ms infinite`,
            ['--hub-marquee' as string]: `-${dist}px`,
          }}
        >
          <span ref={inner}>{text}</span>
          <span style={{ paddingLeft: GAP }}>{text}</span>
        </span>
      ) : (
        <span ref={inner}>{text}</span>
      )}
    </div>
  )
}
