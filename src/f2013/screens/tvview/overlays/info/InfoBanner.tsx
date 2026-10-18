import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRemote, type RemoteKey } from '../../../../../input/remote'
import type { Channel } from '../../../../../tv/channels'
import { useForeground } from '../../../../shell'
import { playUi } from '../../../../tv/sound'
import { getTv, useTv } from '../../../../tv/store'
import { argb, Bmp, img, IMG_SCALE } from '../../common'
import { chModeLabel, navList } from '../../navmode'
import { emit, on } from '../bus'
import {
  audioStr, chTypeStr, dateTimeStr, iconList, programDayStr, programmeFor, progressPct, termStr,
} from './model'
import './info.css'

// The INFO banner: Ace window factory (vtable 0x06101938) -> CViewerInfoWndAce (0x025030d0), derived
// from CViewerInfoWnd; content in CChannelInfoSubWnd::Create 0x024f350c, CViewerInfoWnd::t_Create
// 0x024df1f8 / CreateInfoBanner 0x024de4d8, laid out by CViewerInfoWnd::UpdateItem 0x024e2220 and
// CViewerWnd::t_AdjustChannelLabelPosition 0x024cf174. A dark band across the top of the picture.
// All values are 1920 stage px: CViewerOSDInfo evaluated at 1920/960 *without* t_InitReverse (the
// right-to-left variant; English is orientation 0), see spec/tvview-info.md. This model has no
// channel thumbnail (CViewerCommon::FlagChannelThumbnailSupport() returns 0), so the sub-window
// labels sit CHANNEL_INFO_WITHOUT_THUMBNAIL_X_OFFSET (140) further left.

const WND_H = 450                         // VIEWER_INFO_WND_H (window at VIEWER_INFO_WND_X/Y 0,0)
const BG_Y = 340 - WND_H                  // t_SetBackground: VIEWER_INFO_WND_H_SMALL - VIEWER_INFO_WND_H (no PVR rows)
const BG_ALPHA = 0xcc / 255               // CViewerInfoWndAce::t_Create: pvr_bg_l_450 at alpha 0xcc
const TOP = { x: 50, y: 14, h: 44 }       // INFO_LABEL_SOURCE_X/Y/H; chmode and audio follow (UpdateItem 2 and 9)
const DATE = { right: 1888, y: 2, h: 68 } // t_ShowWidget(10): CHANNEL_RIGHT_ALIGN_POSITION, CHANNEL_LABEL_DATE_Y/H
const DETAIL = { x: 1470, y: 70, w: 400, h: 40, icon: 40, iconGap: 12 } // CHANNEL_BUTTON_DETAIL_INFO_*
const UP = { x: 984, y: 0 }               // CHANNEL_BUTTON_UP_NAVI_X/Y (top_arrow, id 34)
const DOWN = { x: 984, y: 214 }           // CHANNEL_BUTTON_DOWN_NAVI_X/Y (bottom_arrow, id 35)
const PREV = { x: 8, y: 86, w: 32, h: 52 }    // CHANNEL_BUTTON_PREVIOUS_NAVI_* (left_arrow, id 36)
const NEXT = { x: 1880, y: 86, w: 32, h: 52 } // CHANNEL_BUTTON_NEXT_NAVI_* (right_arrow, id 37)
const ROW = { x: 210 - 140, y: 58, h: 66 } // INFO_LABEL_CHNUM_X - ..._WITHOUT_THUMBNAIL_X_OFFSET, INFO_LABEL_CHNUM_Y, CHANNEL_LABEL_INFO_NAME_H
const PROG_H = 70                         // CHANNEL_LABEL_PROGRAM_NAME_H
const GAP_8 = 16                          // INFO_LABEL_GAP_8
const GAP_13 = 26                         // INFO_LABEL_GAP_13 (number to name)
const PART = { y: 74, w: 2, h: 38 }       // CHANNEL_LABEL_PARTITION_LINE_Y/W/H (between name and programme)
const NUM_NAME_MAX = 740                  // INFO_CHNUM_CHNAME_TOTAL_WIDTH
const NUM_NAME_PROG_MAX = 1240            // INFO_CHNUM_CHNAME_PRGNAME_TOTAL_WIDTH
const TIME = { x: 210 - 140, y: 126, h: 40 } // CHANNEL_LABEL_INFO_TIME_X - offset, _Y, _H (UpdateItem 7)
const DAY_Y = 125                         // CHANNEL_LABEL_PROGRAM_DAY_Y
const BAR = { y: 140, w: 204, stretch: 8 } // INFO_PROGRESS_BAR_Y/WIDTH/STRETCH_WIDTH (UpdateItem 0x2f)
const BAR_H = 11 * IMG_SCALE              // pvr_progress2(_bg).bmp height
const LIST = { x: 50, y: 178, h: 44, iconTop: 4, iconGap: 4 } // CHANNEL_LIST_INFOBAR_X/Y/H, CHANNEL_ICONBAR_TOP_MARGIN/ICON_GAP
const FONT = { big: 52, prog: 36, small: 30 } // t_GetFontSize: VIEWER_FONT_SIZE_14 (1, 2), _5 (8), _2 (7, 9, 10, 0xc, 0x11-0x14)
const COLOR = {
  type: argb(0xffb1ccf1),   // CHANNEL_TYPE_COLOR (type and mode), CHANNEL_AUDIO_COLOR (audio)
  date: argb(0xffbdbdbd),   // CHANNEL_DATE_COLOR
  name: argb(0xff6bc7ed),   // CHANNEL_NAME_CORLOR
  text: argb(0xffffffff),   // VIEWER_TEXT_COLOR (number, programme name, day, button)
  term: argb(0xffbdbdbd),   // PROGRAM_TERM_COLOR
  list: argb(0xffbdbdbd),   // INFOBAR_COLOR
  line: argb(0xff707070),   // RECORDING_PARTITION_LINE_COLOR / INFOBAR_PARTITIONLINE_COLOR
}
// Timings: CViewerInfo::t_AfterSetState 0x024d99d4 (info state hides after 10 s; navigation restarts
// it, CViewerManagerDVB::ProcessChannelNavi / ProcessProgramReceived), CViewerInfoWndAce
// m_CreateAnimation 0x0250197c (show: slide down INFO_MOVE_ANI_OFFSET 50 with the alpha helper,
// 500 ms), PlayHideAni 0x02500c40 (back up and out, 330 ms), t_PlayNaviAni 0x025012b8 (250 ms).
const HIDE_MS = 10000
const HIDE_ANI_MS = 330                   // (show is 500 ms, in info.css)
const NAVI_MS = 250 + 80
const SOUND_NAVI = 16                     // CBInfoHelpInput 0x024e0e70: CAudioUIUtil::PlayAudio(0x10) (1_move)
const EPG_DAYS = 8                        // how far Right can page (inferred: DVB EIT schedule range)

// ---- text measuring (the firmware's CViewerCommon::GetEffectiveTextExtent) ----

const TEXT_FONT = "'SamsungSVD', sans-serif"
const TEXT_WEIGHT = 500 // CViewerCommon::GetFont -> font 0 -> shadow_eu.ttf (SVD Medium)
let ctx: CanvasRenderingContext2D | null = null
function measure(text: string, size: number) {
  if (!text) return 0
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * size * 0.5
  ctx.font = `${TEXT_WEIGHT} ${size}px ${TEXT_FONT}`
  return Math.ceil(ctx.measureText(text).width)
}
// CCTextDrawing abbreviates text wider than its drawing with '...' (TVViewer string 96).
function fit(text: string, size: number, max: number) {
  if (measure(text, size) <= max) return text
  let t = text
  while (t.length > 1 && measure(`${t}...`, size) > max) t = t.slice(0, -1)
  return `${t.trimEnd()}...`
}

function useFontsReady() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && force())
    return () => {
      live = false
    }
  }, [])
}

// ---- open / close requests ----

type Req = 'toggle' | 'show' | 'hide'
const reqSubs = new Set<(r: Req) => void>()
let visible = false
export function requestInfo(r: Req) {
  reqSubs.forEach(f => f(r))
}
export function infoVisible() {
  return visible
}

// ---- the banner ----

type Content = {
  ch: Channel
  index: number           // channel index (channel session)
  offset: number          // programme steps after the one on air (programme session)
  tuned: boolean          // the channel session is the tuned channel
}
type Layer = { key: number; c: Content; cls: string }

function Label({ x, y, h, size, color, children, align = 'left', w }: {
  x: number; y: number; h: number; size: number; color: string; children: ReactNode; align?: 'left' | 'right'; w?: number
}) {
  const s: CSSProperties = {
    position: 'absolute', left: x, top: y, height: h, lineHeight: `${h}px`, fontSize: size, color,
    fontFamily: TEXT_FONT, fontWeight: TEXT_WEIGHT, whiteSpace: 'nowrap', textAlign: align,
  }
  if (w !== undefined) s.width = w
  return <div style={s}>{children}</div>
}

// The CChannelInfoSubWnd part: number, name, programme, term, progress/day, icon and info bars.
function SubWindow({ c, now }: { c: Content; now: Date }) {
  const p = programmeFor(c.ch, c.offset, now)
  const onAir = c.offset === 0
  const live = c.tuned && onAir
  const num = String(c.ch.number) // CCountryOption::t_GetChannelNum '%d'

  // t_AdjustChannelLabelPosition (orientation 0)
  const numW = measure(num, FONT.big)
  let name = c.ch.name
  let nameW = measure(name, FONT.big)
  const gap13 = numW > 0 && nameW > 0 ? GAP_13 : 0
  const nameX = ROW.x + numW + gap13
  let progAvail: number
  if (numW + nameW < NUM_NAME_MAX - GAP_13) {
    progAvail = NUM_NAME_PROG_MAX - (numW + nameW) - GAP_13 - PART.w - 2 * GAP_8
  } else {
    name = fit(name, FONT.big, NUM_NAME_MAX - numW - GAP_13)
    nameW = measure(name, FONT.big)
    progAvail = NUM_NAME_PROG_MAX - NUM_NAME_MAX - 2 * GAP_8 - PART.w
  }
  const partX = nameX + nameW + GAP_8
  const progX = partX + PART.w + GAP_8
  const prog = fit(p.title, FONT.prog, progAvail)

  // UpdateItem 7 / 0xc / 0xd / 0x2f
  const term = termStr(p)
  const termW = measure(term, FONT.small)
  const afterTerm = TIME.x + termW + GAP_8
  const pct = progressPct(p, now)
  const fill = Math.floor((BAR.w * pct) / 100)

  // t_ShowWidget(0x12): icon bar first, the text info bar after it
  const icons = live ? iconList(c.ch) : []
  let ix = LIST.x
  const iconEls = icons.map(src => {
    const w = (src.includes('1080i') ? 50 : src.includes('icon_hd') || src.includes('icon_sd') ? 30 : 40) * IMG_SCALE
    const el = <Bmp key={src} src={src} x={ix} y={LIST.y + LIST.iconTop} />
    ix += w + LIST.iconGap
    return el
  })
  const iconsW = icons.length ? ix - LIST.iconGap - LIST.x : 0
  // CViewerInfo::t_ReadTvInfoList 0x024db080: rating, languages, genre; the mocked EPG carries the
  // DVB content genre only (its texts are the firmware's g_CommonWStringEng genre names).
  const listX = iconsW ? LIST.x + iconsW + 2 * LIST.iconGap : LIST.x

  return (
    <>
      <Label x={ROW.x} y={ROW.y} h={ROW.h} size={FONT.big} color={COLOR.text}>{num}</Label>
      <Label x={nameX} y={ROW.y} h={ROW.h} size={FONT.big} color={COLOR.name}>{name}</Label>
      <div style={{ position: 'absolute', left: partX, top: PART.y, width: PART.w, height: PART.h, background: COLOR.line }} />
      <Label x={progX} y={ROW.y} h={PROG_H} size={FONT.prog} color={COLOR.text}>{prog}</Label>
      <Label x={TIME.x} y={TIME.y} h={TIME.h} size={FONT.small} color={COLOR.term}>{term}</Label>
      {onAir ? (
        <div className="f13-tvv-bar f13-info-bar" style={{ left: afterTerm, top: BAR.y, width: BAR.w, height: BAR_H, borderImageSource: `url("${img('TVViewer/pvr_progress2_bg.bmp')}")` }}>
          {fill >= 2 * BAR.stretch && (
            <div className="f13-tvv-bar" style={{ left: -7.5, top: 0, width: fill, height: BAR_H, borderImageSource: `url("${img('TVViewer/pvr_progress2.bmp')}")` }} />
          )}
        </div>
      ) : (
        <Label x={afterTerm} y={DAY_Y} h={TIME.h} size={FONT.small} color={COLOR.text}>{programDayStr(p, now)}</Label>
      )}
      {iconEls}
      <Label x={listX} y={LIST.y} h={LIST.h} size={FONT.small} color={COLOR.list}>{p.genre}</Label>
    </>
  )
}

export function InfoBanner() {
  useFontsReady()
  const fg = useForeground()
  const source = useTv(s => s.source)
  const channels = useTv(s => s.channels)
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'hiding'>('hidden')
  const [layers, setLayers] = useState<Layer[]>([])
  const cur = layers.length ? layers[layers.length - 1].c : null
  const [now, setNow] = useState(() => new Date())
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [timerSeq, bumpTimer] = useReducer((x: number) => x + 1, 0)

  visible = phase === 'shown'

  const content = (index: number, offset: number): Content | null => {
    const s = getTv()
    const ch = s.channels[index]
    return ch ? { ch, index, offset, tuned: index === s.channel } : null
  }

  const open = () => {
    const s = getTv()
    if (s.source !== 'TV' || !s.channels.length) return false
    const c = content(s.channel, 0)
    if (!c) return false
    emit('hideBanner')
    setNow(new Date())
    setLayers([{ key: ++seq.current, c, cls: '' }])
    setPhase('shown')
    bumpTimer()
    return true
  }
  const close = () => setPhase(p => (p === 'shown' ? 'hiding' : p))

  // requests: INFO key, Channel List OK on the playing channel (bus 'info'), channel banner (hideInfo)
  useEffect(() => {
    const f = (r: Req) => {
      if (r === 'hide') close()
      else if (r === 'toggle' && visible) close() // INFO again closes it (inferred: key 0x1f is reserved by CViewerInfo::CheckReservedKey)
      else open()
    }
    reqSubs.add(f)
    const offInfo = on('info', () => open())
    const offHide = on('hideInfo', () => close())
    return () => {
      reqSubs.delete(f)
      offInfo()
      offHide()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // hide timer
  useEffect(() => {
    clearTimeout(timer.current)
    if (phase !== 'shown') return
    timer.current = setTimeout(close, HIDE_MS)
    return () => clearTimeout(timer.current)
  }, [phase, timerSeq])

  // after the hide animation
  useEffect(() => {
    if (phase !== 'hiding') return
    const t = setTimeout(() => {
      setPhase('hidden')
      setLayers([])
    }, HIDE_ANI_MS)
    return () => clearTimeout(t)
  }, [phase])

  // an application in the foreground, another input or a new lineup closes it
  useEffect(() => {
    if (fg || source !== 'TV') close()
  }, [fg, source])
  useEffect(() => {
    if (cur && channels[cur.index] !== cur.ch) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels])

  // the clock and the progress bar follow the time while shown
  useEffect(() => {
    if (phase === 'hidden') return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [phase])

  // drop finished navigation layers
  useEffect(() => {
    if (layers.length < 2) return
    const t = setTimeout(() => setLayers(l => l.slice(-1).map(x => ({ ...x, cls: '' }))), NAVI_MS)
    return () => clearTimeout(t)
  }, [layers])

  const navigate = (c: Content, dir: 'up' | 'down' | 'side') => {
    playUi(SOUND_NAVI)
    setLayers(l => {
      const last = l[l.length - 1]
      return [
        { ...last, key: last.key, cls: `f13-info-out-${dir}` },
        { key: ++seq.current, c, cls: `f13-info-in-${dir}` },
      ]
    })
    bumpTimer()
  }

  useRemote((key: RemoteKey) => {
    if (!cur) return false
    const s = getTv()
    switch (key) {
      case 'Back':
      case 'Exit':
        close() // CBInfoHelpInput: 0x58 / 0x2d -> HideBanner(0x1d)
        return true
      case 'Up':
      case 'Down': {
        // CViewerManagerDVB::ProcessChannelNavi(2/3) 0x024a434c: the next/previous channel of the
        // navigation mode, its programme on air; nothing is tuned (inferred: Up = next channel).
        const list = navList(s)
        if (list.length < 2) return true
        let at = list.indexOf(cur.index)
        if (at < 0) at = 0
        const d = key === 'Up' ? 1 : -1
        const c = content(list[(at + d + list.length) % list.length], 0)
        if (c) navigate(c, key === 'Up' ? 'up' : 'down')
        return true
      }
      case 'Left':
        // ProcessProgramReceived(7): previous programme, only while showing a later one
        if (cur.offset > 0) navigate({ ...cur, offset: cur.offset - 1 }, 'side')
        return true
      case 'Right': {
        // ProcessProgramReceived(6): next programme while the EPG has one
        const n = new Date()
        const next = programmeFor(cur.ch, cur.offset + 1, n)
        if (next.start.getTime() < n.getTime() + EPG_DAYS * 86400000) navigate({ ...cur, offset: cur.offset + 1 }, 'side')
        return true
      }
      case 'Enter':
        // CBInfoHelpInput: OK with the 'Information' button shown -> ShowChannelETT (the
        // CDetailInformationWW detail window), not built here.
        return true
      default:
        return false
    }
  }, phase === 'shown')

  if (phase === 'hidden' || !cur) return null

  const live = cur.tuned && cur.offset === 0
  const type = chTypeStr(cur.ch)
  const mode = chModeLabel()
  const audio = live ? audioStr(cur.ch) : ''
  const typeW = measure(type, FONT.small)
  const modeW = measure(mode, FONT.small)
  const modeX = TOP.x + typeW + (typeW > 0 ? GAP_8 : 0)
  const audioX = TOP.x + typeW + modeW + GAP_8 * ((typeW > 0 ? 1 : 0) + (modeW > 0 ? 1 : 0))
  const date = dateTimeStr(now)
  const detailText = 'Information' // TVViewer string 180 (t_ReadRedInfo 0x0246e290, icon_enter id 388)
  const detailTextW = measure(detailText, FONT.small)
  const updown = navList(getTv()).length > 1 // t_ReadUpDownChannelEnable (inferred: more than one channel)

  return (
    <div className={`f13-info ${phase === 'hiding' ? 'f13-info-hide' : 'f13-info-show'}`} style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: WND_H }}>
      <img src={img('TVViewer/pvr_bg_l_450.bmp')} alt="" draggable={false}
        style={{ position: 'absolute', left: 0, top: BG_Y, width: 1280 * IMG_SCALE, height: 250 * IMG_SCALE, opacity: BG_ALPHA }} />
      <Label x={TOP.x} y={TOP.y} h={TOP.h} size={FONT.small} color={COLOR.type}>{type}</Label>
      <Label x={modeX} y={TOP.y} h={TOP.h} size={FONT.small} color={COLOR.type}>{mode}</Label>
      {audio && <Label x={audioX} y={TOP.y} h={TOP.h} size={FONT.small} color={COLOR.type}>{audio}</Label>}
      <Label x={DATE.right - 1000} w={1000} y={DATE.y} h={DATE.h} size={FONT.small} color={COLOR.date} align="right">{date}</Label>
      <Label x={DETAIL.x} w={DETAIL.w} y={DETAIL.y} h={DETAIL.h} size={FONT.small} color={COLOR.text} align="right">{detailText}</Label>
      <Bmp src="TVViewer/icon_enter.bmp" x={DETAIL.x + DETAIL.w - detailTextW - DETAIL.icon - DETAIL.iconGap + (DETAIL.icon - 26 * IMG_SCALE) / 2} y={DETAIL.y + (DETAIL.h - 26 * IMG_SCALE) / 2} />
      {updown && <Bmp src="TVViewer/top_arrow.bmp" x={UP.x} y={UP.y} />}
      {updown && <Bmp src="TVViewer/bottom_arrow.bmp" x={DOWN.x} y={DOWN.y} />}
      {cur.offset > 0 && <Bmp src="TVViewer/left_arrow.bmp" x={PREV.x + (PREV.w - 24 * IMG_SCALE) / 2} y={PREV.y + (PREV.h - 34 * IMG_SCALE) / 2} />}
      <Bmp src="TVViewer/right_arrow.bmp" x={NEXT.x + (NEXT.w - 24 * IMG_SCALE) / 2} y={NEXT.y + (NEXT.h - 34 * IMG_SCALE) / 2} />
      {layers.map(l => (
        <div key={l.key} className={l.cls} style={{ position: 'absolute', inset: 0 }}>
          <SubWindow c={l.c} now={now} />
        </div>
      ))}
    </div>
  )
}
