import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRemote, type RemoteKey } from '../../../../input/remote'
import { programmesBetween, type Channel, type GuideProgramme } from '../../../../tv/channels'
import { VIDEO } from '../../../assets'
import type { AppProps } from '../../../shell'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { currentVideo, getTv, setSetting, switchSource, tuneChannel, useTv } from '../../../tv/store'
import { argb, img } from '../common'
import { chMode, navList, type ChMode } from '../navmode'
import { CategoryPopup, categoryItems } from './CategoryPopup'
import { QuickNavi } from './QuickNavi'
import { DetailInfo } from './DetailInfo'
import { C, L } from './layout'
import { currentTimeStr, dayTexts, timeStr } from './time'
import { DOTS, fitText, textWidth, useFontsReady, wrapText } from './text'
import './guide.css'

// The Guide (exeDSP CEpgApp -> CEpgFullMain, the "full" EPG of the 2013 F-series): the focused
// programme's details and the live picture (PIG) on top, a 2-hour grid of 7 channels below, the
// colour-key help bar at the bottom. Spec: samsung-tv-qemu/extract/f13/spec/tvview-guide.md.

const HOUR = 3600 * 1000
const PAGE = L.PAGE_TIME * 1000
const SCROLL = L.SCROLL_TIME * 1000

const floorTo = (t: number, step: number) => Math.floor(t / step) * step

// EPG sound ids (CAudioUIUtil::PlayAudio callers in CEpgFullMain): 1 up / CH up, 2 down / CH down,
// 3 left, 4 right (all 1_move), 7 back (Return, Guide to close), 8 select (Info, Guide to "now").
const SND = { UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4, BACK: UI_SOUND.BACK, SELECT: UI_SOUND.SELECT } as const

type Row = { index: number; ch: Channel }
type Cell = { prog: GuideProgramme; x: number; w: number }
type Popup = null | 'category' | 'quicknav' | 'detail'

// CEpgFullRendererBase::t_DrawProgramInfo @ 027b00c8: programme cells of a row inside the page.
// x is relative to FULL_LIST_ITEM_SELECT_X; widths run to the next programme's start position
// (FULL_LIST_ITEM_PAGE_TIME_W per FULL_PAGE_TIME, minimum FULL_LIST_PROGRAM_MINIMUM_W); the last cell
// runs to FULL_LIST_ITEM_SELECT_W.
function rowCells(ch: Channel, pageStart: number): Cell[] {
  const progs = programmesBetween(ch, new Date(pageStart), new Date(pageStart + PAGE))
  const pageMin = Math.floor(pageStart / 60000)
  const pos = (t: number) => Math.floor((L.PAGE_TIME_W * (Math.floor(t / 60000) - pageMin)) / (L.PAGE_TIME / 60))
  const out: Cell[] = []
  let x = 0
  progs.forEach((prog, i) => {
    const next = progs[i + 1]
    let w: number
    if (next && next.start.getTime() < pageStart + PAGE) w = Math.max(L.PROG_MIN_W, pos(next.start.getTime()) - x)
    else w = L.SELECT_W - x
    out.push({ prog, x, w })
    x += w
  })
  return out
}

// CEpgItem::SetFocus(time) @ 027b23f4: the programme containing the time (minute resolution); none ->
// the last one (an earlier time picks the first one: inferred).
function focusIndexAt(cells: Cell[], t: number) {
  if (!cells.length) return 0
  const m = floorTo(t, 60000)
  const i = cells.findIndex(c => floorTo(c.prog.start.getTime(), 60000) <= m && m < floorTo(c.prog.end.getTime(), 60000))
  if (i >= 0) return i
  return m < cells[0].prog.start.getTime() ? 0 : cells.length - 1
}

// CEpgList::t_CalculateFirstItemIndex with "focus on open": the focused row is the third one when it can be.
function firstForFocus(focus: number, total: number) {
  if (focus > 2 && total > L.MAX_VISIBLE) return focus >= total + 3 - L.MAX_VISIBLE ? total - L.MAX_VISIBLE : focus - 2
  return 0
}

// The texts of the info area for the focused programme (CEpgFullInfoArea::SetProgramInfo @ 027b5fd4).
function genreText(g: string) {
  // m_GetDefaultGenreString: content nibble 0 -> common string 164 'Unclassified'.
  return g === 'Undefined content' ? 'Unclassified' : g
}

// "DTV Air | 1 | Aurora One HD": CEpgFullInfoArea::SetChannelNameInfo @ 027b5738 joins
// GetChannelString(.., 2) (t_GetChannelType: DVB 'DTV Air'), GetChannelString(.., 0) (the number) and
// the service name with " | ".
function channelLine(ch: Channel) {
  const type = ch.delivery === 'ATV' ? 'ATV' : 'DTV Air'
  return `${type} | ${ch.number} | ${ch.name}`
}

function Text({ x, y, w, h, size, color, align = 'left', children, style }: {
  x: number; y: number; w: number; h: number; size: number; color: number
  align?: 'left' | 'center' | 'right'; children: string; style?: CSSProperties
}) {
  return (
    <div className="g13-text" style={{ left: x, top: y, width: w, height: h, lineHeight: `${h}px`, fontSize: size, color: argb(color), textAlign: align, ...style }}>
      {children}
    </div>
  )
}

// A firmware bitmap stretched to a rect (CCImageCompositeDrawing with a whole-image source).
function Stretch({ src, x, y, w, h }: { src: string; x: number; y: number; w: number; h: number }) {
  return <img className="g13-abs" src={img(src)} alt="" draggable={false} style={{ left: x, top: y, width: w, height: h }} />
}

// A firmware bitmap at its OSD size (x1.5) at stage position x, y.
function Pic({ src, x, y, nw, nh, style }: { src: string; x: number; y: number; nw: number; nh: number; style?: CSSProperties }) {
  return <img className="g13-abs" src={img(src)} alt="" draggable={false} style={{ left: x, top: y, width: nw * 1.5, height: nh * 1.5, ...style }} />
}

// Help bar markers (CKeyHelpBar, right-aligned: marker 0 is the rightmost). The default help bar type
// of a DVB set with digital channels is 0xd000 (CEpgFullMain::t_GetDefaultHelpBarType @ 0279b4e8):
// t_SetHelpBarForColorKey adds yellow (0x1000, C 'Schedule Manager'), green (0x8000, B 'Channel
// Category', when there is more than one category) and red (0x4000, A 'Quick Nav') in that order.
type Marker = { key: 'Red' | 'Green' | 'Yellow'; icon: string; text: string }
function helpMarkers(categories: number): Marker[] {
  const m: Marker[] = [{ key: 'Yellow', icon: 'EPG/icon_colorkey_c.bmp', text: 'Schedule Manager' }]
  if (categories > 1) m.push({ key: 'Green', icon: 'EPG/icon_colorkey_b.bmp', text: 'Channel Category' })
  m.push({ key: 'Red', icon: 'EPG/icon_colorkey_a.bmp', text: 'Quick Nav' })
  return m
}

// x positions of the markers (CKeyHelpBar::OrderingMarker @ 018eecf8): from the right edge minus
// HELP_END_MARGIN leftwards, item = icon + HELP_IMGTXT_MARGIN + text, HELP_TXTIMG_MARGIN between items
// (shrunk to fit, not below HELP_MIN_SPAN).
function layoutMarkers(markers: Marker[]) {
  const items = markers.map(mk => ({ mk, iw: 34 * 1.5, tw: textWidth(mk.text, L.HELP_TEXT_SIZE) }))
  const total = items.reduce((s, it) => s + it.iw + it.tw + L.HELP_IMGTXT_MARGIN, 0)
  let gap: number = L.HELP_TXTIMG_MARGIN
  const free = L.WIN_W - total - L.HELP_END_MARGIN * 2 - gap * items.length
  if (free < 0) gap = Math.max(L.HELP_MIN_SPAN, gap + Math.trunc(free / items.length))
  let x: number = L.WIN_W - L.HELP_END_MARGIN
  return items.map(it => {
    const w = it.iw + it.tw + L.HELP_IMGTXT_MARGIN
    x -= w
    const at = x
    x -= gap
    return { ...it, x: at }
  })
}

export function GuideApp({ close }: AppProps) {
  useFontsReady()
  const channels = useTv(s => s.channels)
  const tvChannel = useTv(s => s.channel)
  const video = useTv(currentVideo)
  const mode = useTv(() => chMode())

  // rows = channels of the current navigation mode (EpgUtilBase::GetChannelNavigationCondition)
  const rows: Row[] = useMemo(() => navList(getTv(), mode).map(i => ({ index: i, ch: channels[i] })), [channels, mode])
  const startRow = Math.max(0, rows.findIndex(r => r.index === tvChannel))

  const [now, setNow] = useState(() => Date.now())
  const [pageStart, setPageStart] = useState(() => floorTo(Date.now(), SCROLL))
  const [focus, setFocus] = useState(startRow)
  const [first, setFirst] = useState(() => firstForFocus(startRow, rows.length))
  const [focusTime, setFocusTime] = useState(() => Date.now())
  const [popup, setPopup] = useState<Popup>(null)
  const homeRow = useRef(startRow)

  // EpgUtilBase::SetTvSource: the Guide switches the input to TV.
  useEffect(() => {
    if (getTv().source !== 'TV') switchSource('TV')
  }, [])

  // CEpgFullMain::t_CurrentTimeAlarmCallback: the clock and "on now" state refresh every 2000 ms.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  // keep the focus inside the list when the category changes
  useEffect(() => {
    if (focus >= rows.length) {
      const f = Math.max(0, rows.length - 1)
      setFocus(f)
      setFirst(firstForFocus(f, rows.length))
    }
  }, [rows.length, focus])

  const visible = rows.slice(first, first + L.MAX_VISIBLE)
  const cellsByRow = useMemo(() => visible.map(r => rowCells(r.ch, pageStart)), [visible, pageStart])
  const focusCells = focus - first >= 0 && focus - first < visible.length ? cellsByRow[focus - first] : rowCells(rows[focus]?.ch ?? channels[0], pageStart)
  const focusIdx = focusIndexAt(focusCells, focusTime)
  const focusCell = focusCells[focusIdx]
  const focusRow = rows[focus]
  const prog = focusCell?.prog

  const categories = categoryItems(channels)
  const markers = layoutMarkers(helpMarkers(categories.length))

  const nowHour = floorTo(now, SCROLL)
  const isCurrent = !!prog && prog.start.getTime() <= now && now < prog.end.getTime()

  function moveRow(next: number, newFirst: number) {
    setFocusTime(prog ? prog.start.getTime() : focusTime)
    setFocus(next)
    setFirst(newFirst)
  }

  // CEpgFullMain::t_ProcessUpDownKey @ 0279ed68 / CEpgList::SetScrollIndex @ 027ad80c
  function upDown(key: 'Up' | 'Down' | 'ChannelUp' | 'ChannelDown') {
    const total = rows.length
    if (total < 2) return
    playUi(key === 'Up' || key === 'ChannelUp' ? SND.UP : SND.DOWN)
    const page = L.MAX_VISIBLE
    if (key === 'Up' || key === 'Down') {
      let f = focus + (key === 'Up' ? -1 : 1)
      if (f < 0) f = total - 1
      if (f >= total) f = 0
      let nf = first
      if (f < nf) nf = f
      if (f >= nf + page) nf = f - page + 1
      if (total <= page) nf = 0
      moveRow(f, Math.max(0, Math.min(nf, Math.max(0, total - page))))
      return
    }
    if (total <= page) return
    const offset = focus - first
    let nf: number
    if (key === 'ChannelDown') nf = first === total - page ? 0 : Math.min(first + page, total - page)
    else nf = first === 0 ? total - page : Math.max(0, first - page)
    moveRow(Math.min(total - 1, nf + offset), nf)
  }

  // CEpgFullMain::t_ProcessLeftRightKey @ 0279e3c8
  function leftRight(key: 'Left' | 'Right') {
    if (!focusCell) return
    const s = focusCell.prog.start.getTime()
    const e = focusCell.prog.end.getTime()
    if (key === 'Left') {
      if (focusIdx === 0) {
        if (pageStart <= nowHour) return // no scrolling into the past (no sound)
        const np = pageStart - SCROLL
        setFocusTime(s < pageStart ? s + 10000 : s - 10000)
        setPageStart(np)
      } else setFocusTime(focusCells[focusIdx - 1].prog.start.getTime())
      playUi(SND.LEFT)
      return
    }
    if (focusIdx === focusCells.length - 1) {
      const np = pageStart + SCROLL
      setFocusTime(np + SCROLL < e ? e - 10000 : e + 10000)
      setPageStart(np)
    } else setFocusTime(focusCells[focusIdx + 1].prog.start.getTime())
    playUi(SND.RIGHT)
  }

  // CEpgFullMain::m_IsFocusedInCurrentProgram @ 027999c4
  const focusedInCurrent = focus === homeRow.current && focusIdx === 0 && pageStart === nowHour

  function backToNow() {
    playUi(SND.SELECT)
    setPageStart(nowHour)
    setFocusTime(Date.now())
    const f = Math.min(homeRow.current, rows.length - 1)
    setFocus(f)
    setFirst(firstForFocus(f, rows.length))
  }

  useRemote((key: RemoteKey) => {
    if (popup) return false
    switch (key) {
      case 'Up':
      case 'Down':
      case 'ChannelUp':
      case 'ChannelDown':
        upDown(key)
        return true
      case 'Left':
      case 'Right':
        leftRight(key)
        return true
      case 'Enter':
        // t_OnItemPress @ 0279dd3c: an on-air programme (help 'Watch'): tune to it and return to TV
        // (inferred: the firmware passes it to CScheduleInformation mode 5); a future one opens the
        // detail window (t_ShowDetailInformation).
        if (!prog || !focusRow) return true
        if (isCurrent) {
          tuneChannel(focusRow.index)
          close()
        } else if (prog.start.getTime() > now) setPopup('detail')
        return true
      case 'Info':
        // case 0x1f: sound 8, t_ShowInfoBox -> t_ShowDetailInformation
        if (!prog) return true
        playUi(SND.SELECT)
        setPopup('detail')
        return true
      case 'Guide':
        // m_ProcessGuideKeyPress @ 0279cf8c
        if (!focusedInCurrent) backToNow()
        else {
          playUi(SND.BACK)
          close()
        }
        return true
      case 'Back':
        playUi(SND.BACK)
        close()
        return true
      case 'Exit':
        close()
        return true
      case 'Red':
        // t_ProcessRedKeyPress: Quick Nav when the focused row has programmes
        if (focusCells.length) setPopup('quicknav')
        return true
      case 'Green':
        // t_ProcessGreenKeyPress -> t_PopupWindowCreate(0x14): Channel Category popup over its marker
        if (categories.length > 1) setPopup('category')
        return true
      case 'Yellow':
        // t_GoToScheduleManager: the Schedule Manager application is not part of this exhibit.
        return true
      case 'Home':
      case 'Settings':
      case 'Source':
      case 'ChannelList':
        return false // other applications take over (task manager)
      default:
        // keys the EPG does not handle are swallowed while it is in front (inferred)
        return true
    }
  })

  // ---- drawing ----
  const [day0, day1] = dayTexts(now, pageStart, prog ? prog.start.getTime() : now)
  const canGoBack = pageStart > nowHour
  const hasVideo = !!video

  const progressShown = isCurrent
  const timeText = prog ? `${timeStr(prog.start.getTime())} - ${timeStr(prog.end.getTime())}` : ''
  const timeW = timeText ? textWidth(timeText, L.INFO_SIZE) : 0
  const bar1X = L.TIME_X + timeW + L.SEP_GAP
  const progressX = bar1X + L.SEP_GAP + L.ICON_OFFSET_X
  const pct = prog && progressShown ? Math.floor(((now - prog.start.getTime()) * 100) / (prog.end.getTime() - prog.start.getTime())) : 0
  let genreX = L.TIME_X + timeW + L.SEP_GAP * 2
  if (progressShown) genreX += L.PROGRESS_W - 6 + L.SEP_GAP * 2
  const ettLines = prog ? wrapText(prog.desc || 'No detailed information.', L.ETT_SIZE, L.ETT_W, L.ETT_ROWS) : []

  return (
    <div className="g13">
      <Stretch src="EPG/bg_epg_gray.bmp" x={0} y={0} w={L.WIN_W} h={L.WIN_H} />

      {/* PIG: the live picture scaled into FULL_PIG_SCREEN_SIZE (g_pAppWindow video window) */}
      <div className="g13-abs g13-pig" style={{ left: L.PIG_X, top: L.PIG_Y, width: L.PIG_W, height: L.PIG_H }}>
        {hasVideo && <video key={video} src={`${VIDEO}${video}`} autoPlay muted loop playsInline />}
      </div>
      <div className="g13-abs" style={{ left: L.PIG_X, top: L.PIG_TITLE_BG_Y, width: L.PIG_W, height: L.PIG_Y + L.PIG_H - L.PIG_TITLE_BG_Y, background: argb(C.PIG_TITLE_BG) }} />
      {channels[tvChannel] && (
        <Text x={L.PIG_NAME_X} y={L.PIG_NAME_Y} w={L.PIG_NAME_W} h={L.TEXT_H} size={L.PIG_NAME_SIZE} color={C.PIG_NAME}>
          {fitText(`${channels[tvChannel].number} ${channels[tvChannel].name}`, L.PIG_NAME_SIZE, L.PIG_NAME_W)}
        </Text>
      )}

      <Text x={L.TITLE_X} y={L.TITLE_Y} w={L.TITLE_W} h={L.TITLE_H} size={L.TITLE_SIZE} color={C.TITLE}>Guide</Text>
      <Text x={L.CUR_TIME_X} y={L.CUR_TIME_Y} w={L.CUR_TIME_W} h={L.CUR_TIME_H} size={L.CUR_TIME_SIZE} color={C.CUR_TIME} align="right">
        {currentTimeStr(now)}
      </Text>
      <div className="g13-abs" style={{ left: L.SEP_X, top: L.PIG_Y, width: L.GRID_LINE / 2, height: L.SEP_H, background: argb(C.SEPARATOR) }} />

      {/* focused programme */}
      <Text x={L.PROG_TITLE_X} y={L.PROG_TITLE_Y} w={L.PROG_TITLE_W} h={L.TEXT_H} size={L.PROG_TITLE_SIZE} color={C.PROG_TITLE}>
        {fitText(prog ? prog.title : 'No Information', L.PROG_TITLE_SIZE, L.PROG_TITLE_W)}
      </Text>
      {focusRow && (
        <Text x={L.CH_NAME_X} y={L.CH_NAME_Y} w={L.CH_NAME_W} h={L.TEXT_H} size={L.INFO_SIZE} color={C.CH_NAME}>
          {fitText(channelLine(focusRow.ch), L.INFO_SIZE, L.CH_NAME_W)}
        </Text>
      )}
      {prog && (
        <>
          <Text x={L.TIME_X} y={L.TIME_Y} w={L.TIME_W} h={L.TEXT_H} size={L.INFO_SIZE} color={C.TIME}>{timeText}</Text>
          {progressShown && (
            <>
              <Text x={bar1X} y={L.TIME_Y} w={40} h={L.TEXT_H} size={L.INFO_SIZE} color={C.TIME}>|</Text>
              <Progress x={progressX} pct={pct} />
            </>
          )}
          <Text x={genreX - L.SEP_GAP} y={L.TIME_Y} w={40} h={L.TEXT_H} size={L.GENRE_SIZE} color={C.GENRE}>|</Text>
          <Text x={genreX} y={L.TIME_Y} w={L.GENRE_W} h={L.TEXT_H} size={L.GENRE_SIZE} color={C.GENRE}>
            {fitText(genreText(prog.genre), L.GENRE_SIZE, L.GENRE_W)}
          </Text>
          <div className="g13-abs g13-ett" style={{ left: L.ETT_X, top: L.ETT_Y, width: L.ETT_W, fontSize: L.ETT_SIZE, lineHeight: `${L.ETT_SIZE + L.ETT_ROWGAP + 4}px`, color: argb(C.ETT) }}>
            {ettLines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </>
      )}

      {/* day labels */}
      <Pic src="EPG/epg_time_arrow.bmp" x={L.DAY_ARROW_X} y={L.DAY_ARROW_Y} nw={9} nh={12} />
      <Text x={L.DAY_TEXT_X} y={L.DAY_TEXT_Y} w={L.DAY_TEXT_W} h={L.DAY_TEXT_H} size={L.DAY_TEXT_SIZE} color={C.DAY_TEXT}>{day0}</Text>
      {day1 && (
        <>
          <Pic src="EPG/epg_time_arrow.bmp" x={L.DAY_ARROW_X + L.DAY_GAP} y={L.DAY_ARROW_Y} nw={9} nh={12} />
          <Text x={L.DAY_TEXT_X + L.DAY_GAP} y={L.DAY_TEXT_Y} w={L.DAY_TEXT_W} h={L.DAY_TEXT_H} size={L.DAY_TEXT_SIZE} color={C.DAY_TEXT}>{day1}</Text>
        </>
      )}

      {/* time bar */}
      <Stretch src="EPG/Timeline_bg.bmp" x={0} y={L.BAR_Y} w={L.WIN_W} h={L.BAR_H} />
      {[0, 1, 2, 3, 4].map(i => (
        <Pic key={i} src="EPG/Timeline_bg_line.bmp" x={L.SELECT_X - L.GRID_LINE + (L.GRID_LINE + L.BAR_START_W) * i} y={L.BAR_Y} nw={3} nh={33} />
      ))}
      <Pic src="EPG/timeline_front_shadoweffect.bmp" x={0} y={L.BAR_Y} nw={1280} nh={32} />
      <Text x={0} y={L.BAR_Y} w={L.BAR_CATEGORY_W} h={L.BAR_H} size={L.BAR_TEXT_SIZE} color={C.BAR_TEXT} align="center">
        {categoryText(mode)}
      </Text>
      {[0, 1, 2, 3].map(i => (
        <Text key={i} x={L.BAR_START_X1 + L.BAR_STEP * i} y={L.BAR_Y} w={L.BAR_START_W} h={L.BAR_H} size={L.BAR_TEXT_SIZE} color={C.BAR_TEXT}>
          {timeStr(pageStart + i * 30 * 60000)}
        </Text>
      ))}
      {canGoBack && <Pic src="EPG/act_arrow_left_nor.bmp" x={L.ARROW_LEFT_X} y={L.ARROW_Y} nw={29} nh={42} style={{ width: L.ARROW_W }} />}
      <Pic src="EPG/act_arrow_right_nor.bmp" x={L.ARROW_RIGHT_X} y={L.ARROW_Y} nw={29} nh={42} style={{ width: L.ARROW_W }} />

      {/* list */}
      <div className="g13-abs" style={{ left: 0, top: L.LIST_Y, width: L.WIN_W, height: L.HELP_Y - L.LIST_Y, overflow: 'hidden' }}>
        {visible.map((r, vi) => (
          <ListRow key={r.index} row={r} vi={vi} cells={cellsByRow[vi]} focused={r === focusRow} focusIdx={focusIdx} />
        ))}
        {focusRow && focusCell && focus - first >= 0 && focus - first < visible.length && (
          <Focus
            x={L.SELECT_X + focusCell.x}
            w={focusCell.x + focusCell.w < L.WIN_W - L.SELECT_X - 10 ? focusCell.w : Math.max(0, focusCell.w - 10)}
            rowY={(focus - first) * L.ITEM_H}
          />
        )}
        {first > 0 && <Pic src="EPG/act_arrow_up_nor.bmp" x={L.UP_ARROW_X} y={L.UP_ARROW_Y} nw={42} nh={29} />}
        {first + L.MAX_VISIBLE < rows.length && <Pic src="EPG/act_arrow_down_nor.bmp" x={L.UP_ARROW_X} y={L.DOWN_ARROW_Y} nw={42} nh={29} />}
      </div>
      <img className="g13-abs" src={img('EPG/bg_gradient_left.bmp')} alt="" style={{ left: 0, top: L.GRAD_Y, width: L.GRAD_W, height: L.GRAD_H }} />
      <img className="g13-abs" src={img('EPG/bg_gradient_right.bmp')} alt="" style={{ left: L.GRAD_RIGHT_X, top: L.GRAD_Y, width: L.GRAD_W, height: L.GRAD_H }} />

      {/* help bar */}
      <div className="g13-abs g13-help" style={{ left: 0, top: L.HELP_Y, width: L.WIN_W, height: L.HELP_H }}>
        <Pic src="EPG/HelpBarBG_new.bmp" x={0} y={0} nw={1280} nh={55} />
        {markers.map(m => (
          <div key={m.mk.key} className="g13-abs" style={{ left: m.x, top: 0, height: L.HELP_H }}>
            <Pic src={m.mk.icon} x={0} y={(L.HELP_H - m.iw) / 2} nw={34} nh={34} />
            <Text x={m.iw + L.HELP_IMGTXT_MARGIN} y={0} w={Math.ceil(m.tw) + 4} h={L.HELP_H} size={L.HELP_TEXT_SIZE} color={C.HELP_TEXT}>{m.mk.text}</Text>
          </div>
        ))}
      </div>

      {popup === 'category' && (
        <CategoryPopup
          items={categories}
          current={mode}
          anchorX={markers.find(m => m.mk.key === 'Green')?.x ?? 0}
          onClose={() => setPopup(null)}
          onSelect={(m: ChMode) => {
            setSetting('tv.chMode', m)
            setPopup(null)
          }}
        />
      )}
      {popup === 'quicknav' && (
        <QuickNavi
          canGoBack={canGoBack}
          onClose={() => setPopup(null)}
          onMove={dir => {
            if (dir === 'Left' || dir === 'Right') {
              // t_ProcessLeftRightKey key 0/1: -/+24 hours for DVB (FlagEnableForDVB)
              const d = 24 * HOUR
              if (dir === 'Left') {
                if (pageStart <= nowHour) return
                const np = Math.max(nowHour, pageStart - d)
                setPageStart(np)
                setFocusTime((focusCell?.prog.start.getTime() ?? np) - (pageStart - np))
                playUi(SND.LEFT)
              } else {
                setPageStart(pageStart + d)
                setFocusTime((focusCell?.prog.start.getTime() ?? pageStart) + d)
                playUi(SND.RIGHT)
              }
            } else upDown(dir === 'Up' ? 'ChannelUp' : 'ChannelDown')
          }}
        />
      )}
      {popup === 'detail' && prog && focusRow && (
        <DetailInfo ch={focusRow.ch} prog={prog} onClose={() => setPopup(null)} />
      )}
    </div>
  )
}

// The category text at the left of the time bar: EpgUtilBase::MakeNavigationChModeText @ 027badf4
// (navigation by service type: 72 'TV', 50 'Radio', 12 'Data/Other', 3 'Analogue'; default 1
// 'All Channels'; favourites use the favourites name).
function categoryText(mode: ChMode) {
  switch (mode) {
    case 'tv':
      return 'TV'
    case 'radio':
      return 'Radio'
    case 'data':
      return 'Data/Other'
    case 'analogue':
      return 'Analogue'
    case 'all':
      return 'All Channels'
    default:
      return `Favourites ${mode.slice(3)}`
  }
}

// CEpgFullInfoArea::m_CreateProgressBar @ 027b67dc: epg_progress_bg behind a CCSliderControl
// (FULL_INFO_PROGRESS_W x _H) filled with epg_progress (9-slice) up to the elapsed percentage.
function Progress({ x, pct }: { x: number; pct: number }) {
  const fillW = Math.floor((pct * (L.PROGRESS_W - L.PROGRESS_BLANK)) / 100)
  return (
    <>
      <Pic src="EPG/epg_progress_bg.bmp" x={x} y={L.PROGRESS_Y} nw={136} nh={11} />
      {fillW >= L.PROGRESS_BLANK && (
        <div className="g13-abs g13-progress" style={{ left: x + 1, top: L.PROGRESS_Y, width: fillW, height: 11 * 1.5, borderImageSource: `url(${img('EPG/epg_progress.bmp')})` }} />
      )}
    </>
  )
}

// The focus highlight (CEpgFullRendererBase::t_DrawFocusedArea @ 027afd58): EPG high_channellist as a
// 9-slice (EPG_IMAGE_MARGIN corners) of (cell width + FULL_LIST_FOCUS_OFFSET_MARGIN) x FULL_LIST_FOCUS_H,
// at (cell x + FULL_LIST_FOCUS_LINE_OFFSET_X, row y + FULL_LIST_FOCUS_LINE_OFFSET_Y + FULL_LIST_FOCUS_Y)
// in the list's root group (above the FULL_WIN_LIST_MARGIN_Y item margin).
function Focus({ x, w, rowY }: { x: number; w: number; rowY: number }) {
  const width = w > L.PROG_MIN_W ? w + L.FOCUS_MARGIN : L.FOCUS_LINE_MIN_W
  return (
    <div
      className="g13-abs g13-focus"
      style={{
        left: x + L.FOCUS_OFFSET_X,
        top: rowY + L.FOCUS_OFFSET_Y + L.FOCUS_Y,
        width,
        height: L.FOCUS_H,
        borderImageSource: `url(${img('EPG/high_channellist.bmp')})`,
      }}
    />
  )
}

// One channel row (CEpgFullRendererBase::Draw @ 027b1cb0): channel info background and number/name,
// then the programme cells. Row backgrounds (t_SetListBgImage @ 027aea60): the first visible row uses
// the *_top strokes, then *_light / *_dark alternate (CEpgList::t_DrawItem row types 0, 2, 1).
function ListRow({ row, vi, cells, focused, focusIdx }: { row: Row; vi: number; cells: Cell[]; focused: boolean; focusIdx: number }) {
  const y = L.LIST_MARGIN_Y + vi * L.ITEM_H
  const kind = vi === 0 ? 'top' : vi % 2 === 1 ? 'light' : 'dark'
  const ch = row.ch
  return (
    <div className="g13-abs" style={{ left: 0, top: y, width: L.WIN_W, height: L.ITEM_H }}>
      <Stretch src={`EPG/timeline_strok_left_${kind}.bmp`} x={0} y={L.GRID_LINE / 2} w={L.CH_INFO_W} h={L.ITEM_H - L.GRID_LINE} />
      <Text x={L.CH_NUM_X} y={0} w={L.CH_NUM_W} h={L.ITEM_H} size={L.CH_FONT} color={focused ? C.FOCUSED : C.CH_NUM}>{String(ch.number)}</Text>
      <Text x={L.CH_NAME_LIST_X} y={0} w={L.CH_NAME_LIST_W} h={L.ITEM_H} size={L.CH_FONT} color={focused ? C.FOCUSED : C.CH_NAME_LIST}>
        {fitText(ch.name, L.CH_FONT, L.CH_NAME_LIST_W)}
      </Text>
      {cells.map((c, i) => {
        const x = L.SELECT_X + c.x
        const cellW = Math.max(L.PROG_MIN_W, c.w - L.GRID_LINE)
        const dotsW = textWidth(DOTS, L.CH_FONT) + L.PROG_ABBR_W
        let label = ''
        let lx = x + L.PROG_BLANK_W + L.PROG_LEFT_MARGIN
        let lw = c.w - L.PROG_BLANK_W - (L.PROG_LEFT_MARGIN + L.PROG_RIGHT_MARGIN)
        if (c.w < dotsW + L.PROG_BLANK_W) {
          if (dotsW < c.w) {
            // centred "..." (narrow cell)
            label = DOTS
            lw = textWidth(DOTS, L.CH_FONT)
            lx = x + (c.w - dotsW) / 2 + L.PROG_LEFT_MARGIN
          }
        } else label = fitText(c.prog.title, L.CH_FONT, lw)
        // cells reaching past FULL_WIN_W - FULL_LIST_FOCUS_RIGHT_MARGIN lose FULL_LIST_PROGRAM_ITEM_RIGHT_MARGIN
        if (c.x + c.w > L.WIN_W - L.SELECT_X - 10 && label !== DOTS) label = fitText(c.prog.title, L.CH_FONT, lw - 26)
        const isFocus = focused && i === focusIdx
        return (
          <div key={c.prog.id}>
            <Stretch src={`EPG/timeline_strok_right_${kind}.bmp`} x={x} y={L.GRID_LINE / 2} w={cellW} h={L.ITEM_H - L.GRID_LINE} />
            {label && (
              <Text x={lx} y={0} w={Math.max(0, lw) + 2} h={L.ITEM_H} size={L.CH_FONT} color={isFocus ? C.FOCUSED : C.PROG}>{label}</Text>
            )}
          </div>
        )
      })}
      {/* the time-line shadow at the page's left edge (EPG image 131 timeline_shadow_h) */}
      <Stretch src="EPG/timeline_shadow_h.bmp" x={L.SELECT_X} y={0} w={L.SHADOW_W} h={L.ITEM_H} />
    </div>
  )
}
