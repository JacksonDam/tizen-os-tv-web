import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { programmeAt } from '../../../../tv/channels'
import { registerHotkey, useForeground } from '../../../shell'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { getTv, tuneChannel, useTv } from '../../../tv/store'
import { argb, img, IMG_SCALE } from '../common'
import { chModeLabel, navList } from '../navmode'
import { emit, on } from './bus'
import { Jog } from './jog'

// The channel banner (Ace factory -> CViewerChannelBoxSmart, 0x025083ec; drawn by
// CViewerChannelListRender(Base), ConstructDrawings 0x025281a8 / t_DrawChannelBanner 0x025280a8):
// shown on every channel change and by CH +/-, PRE-CH and direct number entry. No panel: shadowed
// text right-aligned against the channel number bitmaps, and the channel jog at the right edge.
// All values in 1920 stage px (CViewerOSDInfo evaluated at 1920/960, see spec/tvview.md).

const WND = { x: 1210, y: 324, w: 710, h: 426 }        // CHANNEL_LIST_BANNER_X/Y/WIDTH/HEIGHT
const ITEM = { x: 0, y: 104, w: 576, h: 226 }          // CHANNEL_LIST_FOCUSED_ITEM_*
const JOG = { x: 582, y: 0, size: 426, display: 128 }   // CHANNEL_LIST_JOG_X/Y/WIDTH, _DISPLAY_WIDTH
const NUM = { baseX: 576, y: 40 }                       // CHANNEL_LIST_CHANNEL_NUMBER_BASE_X/Y
const SEP = { x: 424, y: 52, w: 4, h: 62, numGap: 4, nameGap: 12, modeGap: 12 } // SEPARATOR_LINE_*, *_GAP
const NAME = { x: 0, y: 40, h: 40 }                     // CHANNEL_LIST_CHANNEL_NAME_* (width = separator - gap)
const TYPE = { x: 212, y: 0, w: 360, h: 40 }            // CHANNEL_LIST_CHANNEL_TYPE_*
const MODE = { y: 80, h: 40 }                           // CHANNEL_LIST_CHANNEL_MODE_*
const PROG = { x: 0, y: 116, w: 572, h: 48 }            // CHANNEL_LIST_PROGRAM_NAME_*
const BAR = { x: 408, y: 164, w: 164, stretch: 8 }     // CHANNEL_LIST_PROGRESS_BAR_*
const FONT_3 = 32                                       // CViewerOSDInfo::VIEWER_FONT_SIZE_3
const FONT_7 = 40                                       // VIEWER_FONT_SIZE_7
const COLOR = {
  type: argb(0xffff4e00),      // SMART_CHANNEL_TYPE_COLOR
  name: argb(0xff6bc7ed),      // SMART_CHANNEL_NAME_COLOR
  prog: argb(0xffffffff),      // SMART_CHANNEL_PROG_COLOR
  text: argb(0xffffffff),      // VIEWER_TEXT_COLOR (mode)
  sep: argb(0x4cffffff),       // CHANNEL_LIST_SEPARATOR_LINE_COLOR
  shadow: argb(0xbf000000),    // SMART_SHADOW_FONT_COLOR, offset CHANNEL_LIST_SHADOW_TEXT (0, 2)
}
const HIDE_MS = 3000           // CViewerManager::StartBannerTimer(0)
const NUM_ANI_GUARD_MS = 500   // PCAlarm at +0x3048: number animation only after 500 ms without a change
const DIRECT_DIGITS = 3        // CChannelAutomataDVB max digits (0x24) for a 3-digit LCN country (inferred)

// Channel number bitmaps (CResourceManager image id = char + 100: '0' -> 148 channel_num_l_00...,
// '-' -> 158 channel_num_l_hyphen, '*' -> 160 channel_num_star), drawn right to left from NUM.baseX.
const DIGIT_W = 31 * IMG_SCALE
const HYPHEN_W = 21 * IMG_SCALE
function charImage(c: string): { src: string; w: number } | null {
  if (c >= '0' && c <= '9') return { src: `TVViewer/channel_num_l_0${c}.bmp`, w: DIGIT_W }
  if (c === '-') return { src: 'TVViewer/channel_num_l_hyphen.bmp', w: HYPHEN_W }
  if (c === '*') return { src: 'TVViewer/channel_num_star.bmp', w: 32 * IMG_SCALE }
  return null
}
function layoutNumber(str: string) {
  let x = NUM.baseX
  const out: { src: string; x: number }[] = []
  for (let i = str.length - 1; i >= 0; i--) {
    const im = charImage(str[i])
    if (!im) continue
    x -= im.w
    out.push({ src: im.src, x })
  }
  return { glyphs: out, left: x }
}

// ---- remote keys while watching (CViewerApp) ----

// Direction of the pending channel change: 0 = CH +, 1 = CH -, -1 = other (t_Show's +0x1bf4).
let pendingDir = -1
let direct = ''                 // digits typed so far (CChannelAutomata)
let directTimer: ReturnType<typeof setTimeout> | undefined
const directSubs = new Set<() => void>()
function setDirect(v: string) {
  direct = v
  directSubs.forEach(f => f())
}

function step(delta: 1 | -1) {
  const s = getTv()
  const list = navList(s)
  if (!list.length) return
  let at = list.indexOf(s.channel)
  if (at < 0) at = delta > 0 ? -1 : 0
  const next = list[(((at + delta) % list.length) + list.length) % list.length]
  pendingDir = delta > 0 ? 0 : 1
  tuneChannel(next)
}

function finishDirect() {
  clearTimeout(directTimer)
  const typed = direct.replace(/-/g, '')
  setDirect('')
  const s = getTv()
  const n = parseInt(typed, 10)
  const i = s.channels.findIndex(c => c.number === n)
  pendingDir = -1
  // CViewerChannel::t_DirectTuneToCurrentCh 0x0251e350: tune; an unknown number just shows the
  // current channel again (t_StopTimerAndShowChannel).
  if (i >= 0 && !(i === s.channel && s.source === 'TV')) tuneChannel(i)
  else emit('banner')
}

function directKey(d: number) {
  if (getTv().source !== 'TV' && !direct) {
    // digits on an external input tune the TV (t_DirectTuneToCurrentCh -> SetSource TV) (inferred)
  }
  const typed = direct.replace(/-/g, '') + String(d)
  // CChannelAutomataDVB::GetChannelStr: the digits typed, then '-' for the positions left
  setDirect(typed + '-'.repeat(Math.max(0, DIRECT_DIGITS - typed.length)))
  clearTimeout(directTimer)
  if (typed.length >= DIRECT_DIGITS) {
    // FlagTuningNow: all positions typed -> tune at once
    setTimeout(finishDirect, 0)
  } else {
    directTimer = setTimeout(finishDirect, HIDE_MS) // the banner timer's alarm tunes (t_OnAlarm)
  }
}

registerHotkey('ChannelUp', () => step(1))
registerHotkey('ChannelDown', () => step(-1))
registerHotkey('PreCh', () => {
  const s = getTv()
  pendingDir = -1
  tuneChannel(s.prevChannel)
})
for (let d = 0; d <= 9; d++) registerHotkey(`Digit${d}` as `Digit${0}`, () => directKey(d))

// ---- the banner ----

type View = {
  shown: boolean
  index: number          // channel shown
  dir: number
  seq: number            // bumps on every show (restarts the hide timer)
  numAnim: number        // bumps when the number change animates
  prevNum: string
}

function useDirect() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    directSubs.add(force)
    return () => {
      directSubs.delete(force)
    }
  }, [])
  return direct
}

const textBase: CSSProperties = {
  position: 'absolute',
  fontFamily: "'SamsungSVD', sans-serif",
  fontWeight: 500, // CViewerCommon::GetFont -> CResourceManager font 0 -> shadow_eu.ttf (SVD Medium)
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textShadow: `0 2px 0 ${COLOR.shadow}`,
}

export function ChannelBanner() {
  const tuneSeq = useTv(s => s.tuneSeq)
  const source = useTv(s => s.source)
  const channels = useTv(s => s.channels)
  const fg = useForeground()
  const typed = useDirect()
  const [v, setV] = useState<View>({ shown: false, index: 0, dir: -1, seq: 0, numAnim: 0, prevNum: '' })
  const lastChange = useRef(0)
  const first = useRef(true)
  const [, tick] = useReducer((x: number) => x + 1, 0)

  const show = (dir: number) => {
    const s = getTv()
    if (s.source !== 'TV' || !s.channels.length) return
    emit('hideInfo')
    const now = performance.now()
    setV(p => {
      const animate = p.shown && p.index !== s.channel && now - lastChange.current >= NUM_ANI_GUARD_MS
      const prev = s.channels[p.index]
      return {
        shown: true,
        index: s.channel,
        dir,
        seq: p.seq + 1,
        numAnim: animate ? p.numAnim + 1 : p.numAnim,
        prevNum: animate && prev ? String(prev.number) : p.prevNum,
      }
    })
    lastChange.current = now
    // t_Show plays the VolCh sound for CH +/- (direction 0 or 1)
    if (dir === 0 || dir === 1) playUi(UI_SOUND.VOLCH)
  }

  // every channel change made while watching shows the banner
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const dir = pendingDir
    pendingDir = -1
    if (getTv().source === 'TV' && !fg) show(dir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuneSeq])

  useEffect(() => on('banner', () => show(-1)), [])
  useEffect(() => on('hideBanner', () => setV(p => ({ ...p, shown: false }))), [])

  // direct entry shows the banner with the digits typed
  useEffect(() => {
    if (typed) {
      emit('hideInfo')
      setV(p => ({ ...p, shown: true, seq: p.seq + 1 }))
    }
  }, [typed])

  // hide 3 s after the last show; an application or another input hides it at once
  useEffect(() => {
    if (!v.shown) return
    const t = setTimeout(() => setV(p => ({ ...p, shown: false })), HIDE_MS)
    return () => clearTimeout(t)
  }, [v.shown, v.seq])
  useEffect(() => {
    if (fg || source !== 'TV') setV(p => (p.shown ? { ...p, shown: false } : p))
  }, [fg, source])

  // the progress bar follows the clock while shown
  useEffect(() => {
    if (!v.shown) return
    const t = setInterval(tick, 10000)
    return () => clearInterval(t)
  }, [v.shown])

  const ch = channels[v.index]
  const list = navList(getTv())
  const pos = Math.max(0, list.indexOf(v.index))

  let body = null
  if (v.shown && ch) {
    const numStr = typed || String(ch.number)
    const num = layoutNumber(numStr)
    // separator: fixed at SEP.x for up to three characters, else left of the number
    const sepX = numStr.length < 4 ? SEP.x : num.left - SEP.w - SEP.numGap
    const nameW = sepX - SEP.nameGap
    const prog = typed ? null : programmeAt(ch)
    const now = Date.now()
    const pct = prog ? Math.min(100, Math.max(0, ((now - prog.start.getTime()) / (prog.end.getTime() - prog.start.getTime())) * 100)) : 0
    const fill = Math.floor((BAR.w * pct) / 100)
    const prevGlyphs = v.prevNum ? layoutNumber(v.prevNum).glyphs : []
    const fadeOld = v.prevNum.length <= numStr.length // m_PlayAlphaAnimation unless the number got shorter
    body = (
      <div style={{ position: 'absolute', left: ITEM.x, top: ITEM.y, width: ITEM.w, height: ITEM.h }}>
        {!typed && (
          <>
            {/* channel type: CCountryOption::t_GetChannelType, DVB-T -> common string 72 */}
            <div style={{ ...textBase, left: TYPE.x, top: TYPE.y, width: TYPE.w, height: TYPE.h, lineHeight: `${TYPE.h}px`, textAlign: 'right', fontSize: FONT_3, color: COLOR.type }}>
              DTV Air
            </div>
            <div style={{ ...textBase, left: NAME.x, top: NAME.y, width: nameW, height: NAME.h, lineHeight: `${NAME.h}px`, textAlign: 'right', fontSize: FONT_3, color: COLOR.name }}>
              {ch.name}
            </div>
            {/* channel mode: right-aligned before the separator, top-aligned (2, 3) */}
            <div style={{ ...textBase, left: 0, top: MODE.y, width: sepX - SEP.modeGap, height: MODE.h, textAlign: 'right', fontSize: FONT_3, lineHeight: 1.2, color: COLOR.text, overflow: 'visible' }}>
              {chModeLabel()}
            </div>
            <div style={{ position: 'absolute', left: sepX, top: SEP.y, width: SEP.w, height: SEP.h, background: COLOR.sep }} />
            {prog && (
              <div style={{ ...textBase, left: PROG.x, top: PROG.y, width: PROG.w, height: PROG.h, lineHeight: `${PROG.h}px`, textAlign: 'right', fontSize: FONT_7, color: COLOR.prog }}>
                {prog.title || 'No title'}
              </div>
            )}
            {prog && (
              <>
                <div className="f13-tvv-bar" style={{ left: BAR.x, top: BAR.y, width: BAR.w, borderImageSource: `url(${img('TVViewer/epg_progress_bg.bmp')})` }} />
                {fill >= BAR.stretch * 2 && (
                  <div className="f13-tvv-bar" style={{ left: BAR.x, top: BAR.y, width: fill, borderImageSource: `url(${img('TVViewer/epg_progress.bmp')})` }} />
                )}
              </>
            )}
          </>
        )}
        {fadeOld && v.numAnim > 0 && !typed &&
          prevGlyphs.map((g, i) => (
            <img key={`o${v.numAnim}-${i}`} className="f13-tvv-num-out" src={img(g.src)} alt="" style={{ position: 'absolute', left: g.x / IMG_SCALE, top: NUM.y / IMG_SCALE, zoom: IMG_SCALE }} />
          ))}
        {num.glyphs.map((g, i) => (
          <img
            key={`n${v.numAnim}-${i}`}
            className={v.numAnim > 0 && !typed ? 'f13-tvv-num-in' : undefined}
            src={img(g.src)}
            alt=""
            style={{ position: 'absolute', left: g.x / IMG_SCALE, top: NUM.y / IMG_SCALE, zoom: IMG_SCALE }}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', left: WND.x, top: WND.y, width: WND.w, height: WND.h, overflow: 'hidden', zIndex: 40, pointerEvents: 'none' }}>
      {body}
      <Jog
        kind="channel"
        x={JOG.x}
        hiddenX={JOG.x + JOG.display}
        y={JOG.y}
        size={JOG.size}
        shown={v.shown}
        pos={pos}
        count={list.length}
        up={v.dir === 0}
        highlightAtMin
      />
    </div>
  )
}
