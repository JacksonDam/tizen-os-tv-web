import { useEffect, useRef, useState } from 'react'
import { useForeground } from '../../../shell'
import { currentSource, getTv, useTv } from '../../../tv/store'
import { argb, img } from '../common'
import { deviceName } from '../sources'
import { dateTimeStr } from './info/model'
import { emit, on } from './bus'

// The source banner shown when the TV switches to an external input (banner 0x13, CViewerSource
// with the Ace window CViewerSourceWndAce: t_SetBackground 0x024fea04, t_CreateForm 0x024feaec ->
// CViewerSourceWnd::t_CreateForm 0x024696ac, UpdateItem 0x0246b8e0). A band across the top of the
// screen (image 0xbc TVViewer/info_mini_top_bg.bmp stretched to VIEWER_SOURCE_WND 1920 x 238,
// alpha 0xcc) with the input's name (CViewerSource::t_ReadSourceType -> GetSourceWStringID) in
// white and, right after it, the name the user gave the input (t_ReadSourceName -> the Edit Name
// device type) in blue. Values in 1920 stage px.

const WND = { x: 0, y: 0, w: 1920, h: 238 }                 // VIEWER_SOURCE_WND_*
const TYPE = { x: 54, y: 48, h: 80 }                        // CHANNEL_LABEL_SOURCE_TYPE_* (left-to-right layout)
const TIME = { x: 1472, y: 18, w: 400, h: 32 }              // SOURCE_LABEL_TIME_*, right-aligned (2, 4)
const GAP = 16                                              // INFO_LABEL_GAP_8 (16 at 1920): the name label sits after the type
const FONT_14 = 52                                          // VIEWER_FONT_SIZE_14
const FONT_2 = 30                                           // VIEWER_FONT_SIZE_2
const COLOR = {
  type: argb(0xffffffff),      // BUTTON_FOCUS_FONT_COLOR
  name: argb(0xffb1ccf1),      // INFO_TOPLINE_BLUE_COLOR
  shadow75: argb(0xbf000000),  // SHADOW_FONT_BLACK_COLOR_TRANSPANENCY_75_PER, offset INFO_TXT_SHADOW (0, -2)
  shadow85: argb(0xd8000000),  // ..._85_PER, offset (0, 2)
  time: argb(0xffbdbdbd),
}
const HIDE_MS = 3000           // (inferred) same display time as the channel banner

const label = {
  position: 'absolute' as const,
  top: TYPE.y,
  height: TYPE.h,
  lineHeight: `${TYPE.h}px`,
  fontFamily: "'SamsungSVD', sans-serif",
  fontWeight: 500,
  fontSize: FONT_14,
  whiteSpace: 'nowrap' as const,
}

export function SourceBanner() {
  const switchSeq = useTv(s => s.switchSeq)
  const source = useTv(currentSource)
  const fg = useForeground()
  const [shown, setShown] = useState(0)
  const lastSeq = useRef(switchSeq)
  const typeRef = useRef<HTMLDivElement>(null)
  const [typeW, setTypeW] = useState(0)

  const show = () => {
    if (getTv().source === 'TV') return
    emit('hideBanner')
    setShown(n => n + 1)
  }

  useEffect(() => {
    if (switchSeq === lastSeq.current) return
    lastSeq.current = switchSeq
    if (!fg) show()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switchSeq])
  // emit('banner') on an external input (e.g. INFO) shows it again
  useEffect(() => on('banner', show), [])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(0), HIDE_MS)
    return () => clearTimeout(t)
  }, [shown])
  useEffect(() => {
    if (fg || source.id === 'TV') setShown(0)
  }, [fg, source.id])

  useEffect(() => {
    if (typeRef.current) setTypeW(typeRef.current.offsetWidth)
  }, [shown, source.title])

  if (!shown || source.id === 'TV') return null
  // the Edit Name chosen in the Source app (sources.ts deviceName)
  const name = deviceName(source.id)
  return (
    <div key={shown} className="f13-tvv-fade" style={{ position: 'absolute', left: WND.x, top: WND.y, width: WND.w, height: WND.h, zIndex: 45, pointerEvents: 'none' }}>
      <img src={img('TVViewer/info_mini_top_bg.bmp')} alt="" style={{ position: 'absolute', left: 0, top: 0, width: WND.w, height: WND.h, opacity: 0xcc / 255 }} />
      <div ref={typeRef} style={{ ...label, left: TYPE.x, color: COLOR.type, textShadow: `0 -2px 0 ${COLOR.shadow75}` }}>
        {source.title}
      </div>
      {/* t_ReadSourceTime: GetDateTimeStr type 4 ("9:05 Sat 18 Oct") */}
      <div style={{ ...label, left: TIME.x, top: TIME.y, width: TIME.w, height: TIME.h, lineHeight: `${TIME.h}px`, fontSize: FONT_2, textAlign: 'right', color: COLOR.time, textShadow: `0 2px 0 ${COLOR.shadow85}` }}>
        {dateTimeStr(new Date())}
      </div>
      {name && (
        <div style={{ ...label, left: TYPE.x + typeW + GAP, color: COLOR.name, textShadow: `0 2px 0 ${COLOR.shadow85}` }}>
          {name}
        </div>
      )}
    </div>
  )
}
