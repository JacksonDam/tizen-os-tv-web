import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../apps/registry'
import { useRemote, type RemoteKey } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { currentVideo, tuneChannel, useTv } from '../../tv/store'
import { hhmm, programmeAt, programmesBetween, type Channel, type GuideProgramme } from '../../tv/channels'
import { MessageBox } from '../../components/MessageBox'
import { ChannelBanner } from '../livetv/Overlays'
import { TV } from '../../assets'
import { cancelSchedule, scheduleViewing, useSchedules } from './schedules'
import { ProgramDetail } from './ProgramDetail'
import { dayLabel } from './dayLabel'
import './guide.css'

// org.tizen.epg, the classic EU Guide (CChannelView: CChannelViewFactory picks it when the local set is
// not 1-4 (US/KOR/MEX/CAN) and the country is not 0x17/0x22). Native EFL FLUX; geometry from the
// annotated disassembly of /usr/apps/org.tizen.epg/bin/epg (spec3/guide.md). Full screen, opaque
// CC_EPG_BG #07131B:
//   header 35u: PIG 65u x 35u | detail info | remote key guide
//   band 16u:   channel filter
//   grid 84u:   channel column 65u | time line bar 10u + programme rows 10u, 43u per 30 min

const RES = `${TV}/epg`
const CH_W = 520                 // 65u channel column = PIG width (CMainView::t_CreateFilterChannelLayout)
const PROG_W = 1400              // 175u programme area (SettingUI +0x48)
const ROW_H = 80                 // 10u channel button / programme row (CChannelsList::m_CreateChannelButton)
const ROWS = 7                   // (84u grid - 10u time bar) / 10u rows (inferred: ShapeInit allows 8)
const PX_PER_MS = 344 / (30 * 60000)            // 43u per 30 min (ModelInitializer::ShapeInit)
const SPAN_MS = PROG_W / PX_PER_MS              // ~122 min visible
const STEP_MS = 30 * 60000
const MAX_AHEAD_MS = 7 * 24 * 3600000           // 7 days of guide data (inferred)
type Row = { ch: Channel; index: number }   // index into the stored lineup
type Filter = 'all' | 'tv' | 'radio' | 'data'
type Focus = { area: 'grid'; row: number; time: number } | { area: 'channel'; row: number } | { area: 'filter' }
type Popup =
  | { kind: 'options'; row: number; prog: GuideProgramme; focus: number }
  | { kind: 'detail'; row: number; prog: GuideProgramme }
  | { kind: 'filter'; focus: number }
  | null

// Channel filter (CChannelAndAntennaFilterPopupView): All Channels and the channel types present.
const FILTERS: { id: Filter; label: string; kind?: Channel['kind'] }[] = [
  { id: 'all', label: 'All Channels' },
  { id: 'tv', label: 'TV', kind: 'tv' },
  { id: 'radio', label: 'Radio', kind: 'radio' },
  { id: 'data', label: 'Data/Other', kind: 'data' },
]

const floor30 = (t: number) => {
  const d = new Date(t)
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0)
  return d.getTime()
}

const GUIDE_KEYS = new Set<RemoteKey>(['Up', 'Down', 'Left', 'Right', 'Enter', 'Back', 'Exit', 'Guide', 'Info', 'ChannelUp', 'ChannelDown'])

// The Guide keeps its filter between openings (the app is paused, not terminated).
const mem: { filter: Filter } = { filter: 'all' }

export function Guide({ onExit, launch }: AppProps) {
  const channels = useTv(s => s.channels)
  const tuned = useTv(s => (s.source === 'TV' ? s.channel : -1))
  const video = useTv(currentVideo)
  const schedules = useSchedules()
  const scheduled = useMemo(() => new Set(schedules.map(s => s.id)), [schedules])
  const [now, setNow] = useState(() => Date.now())
  const earliest = floor30(now)
  const [winStart, setWinStart] = useState(earliest)
  const [filter, setFilter] = useState<Filter>(() => {
    const kind = FILTERS.find(f => f.id === mem.filter)?.kind
    return !kind || channels.some(c => c.kind === kind) ? mem.filter : 'all'
  })
  const rows: Row[] = useMemo(() => {
    const kind = FILTERS.find(f => f.id === filter)?.kind
    return channels.map((ch, index) => ({ ch, index })).filter(r => !kind || r.ch.kind === kind)
  }, [channels, filter])
  const startRow = Math.max(0, rows.findIndex(r => r.index === tuned))
  const [top, setTop] = useState(() => Math.max(0, Math.min(startRow, rows.length - ROWS)))
  const [focus, setFocus] = useState<Focus>({ area: 'grid', row: startRow, time: Date.now() })
  const [popup, setPopup] = useState<Popup>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [digits, setDigits] = useState('')
  const digitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const noChannels = channels.length === 0

  // the clock moves the now line; the window never starts before the current half hour
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (winStart < earliest) setWinStart(earliest)
  }, [earliest, winStart])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)   // ToastUtil default 3000 ms
    return () => clearTimeout(t)
  }, [toast])

  const winEnd = winStart + SPAN_MS
  const progsOf = (row: number) => {
    const r = rows[row]
    return r ? programmesBetween(r.ch, new Date(winStart - 6 * 3600000), new Date(winEnd + 6 * 3600000)) : []
  }
  const focusedProg = (): GuideProgramme | null => {
    if (focus.area !== 'grid') return null
    const r = rows[focus.row]
    return r ? programmeAt(r.ch, new Date(Math.max(focus.time, winStart))) : null
  }
  const prog = focusedProg()

  useMoveSound(
    popup?.kind === 'options' || popup?.kind === 'filter'
      ? `p${popup.focus}`
      : `${focus.area}:${'row' in focus ? focus.row : ''}:${prog?.id ?? ''}`,
  )

  // ---- moves ----
  const showRow = (row: number) => {
    if (row < top) setTop(row)
    else if (row >= top + ROWS) setTop(row - ROWS + 1)
  }
  const setRow = (row: number, area: 'grid' | 'channel') => {
    const r = Math.max(0, Math.min(rows.length - 1, row))
    showRow(r)
    if (area === 'grid') setFocus({ area, row: r, time: focus.area === 'grid' ? Math.max(focus.time, winStart) : Math.max(now, winStart) })
    else setFocus({ area, row: r })
  }
  const page = (dir: 1 | -1) => {
    // CH keys page the list by a screen (FocusManager::kPageUp/kPageDown)
    if (!rows.length) return
    const maxTop = Math.max(0, rows.length - ROWS)
    const row = 'row' in focus ? focus.row : top
    const nr = Math.max(0, Math.min(rows.length - 1, row + dir * ROWS))
    let nt = Math.max(0, Math.min(maxTop, top + dir * ROWS))
    if (nr < nt) nt = nr
    else if (nr >= nt + ROWS) nt = nr - ROWS + 1
    setTop(nt)
    if (focus.area === 'channel') setFocus({ area: 'channel', row: nr })
    else setFocus({ area: 'grid', row: nr, time: focus.area === 'grid' ? focus.time : Math.max(now, winStart) })
  }
  const moveTime = (dir: 1 | -1) => {
    if (focus.area !== 'grid' || !prog) return
    if (dir > 0) {
      const next = programmeAt(rows[focus.row].ch, prog.end)
      const t = next.start.getTime()
      if (t >= now + MAX_AHEAD_MS) return
      let ws = winStart
      while (t >= ws + SPAN_MS - 30 * 60000 / 2 && ws < t) ws += STEP_MS
      setWinStart(ws)
      setFocus({ ...focus, time: t })
    } else {
      const shownStart = Math.max(prog.start.getTime(), winStart)
      if (shownStart <= earliest || (prog.start.getTime() <= winStart && winStart <= earliest)) {
        setFocus({ area: 'channel', row: focus.row })   // first programme: Left goes to the channel column
        return
      }
      const prev = programmeAt(rows[focus.row].ch, new Date(shownStart - 1))
      const t = Math.max(prev.start.getTime(), earliest)
      let ws = winStart
      while (t < ws && ws > earliest) ws -= STEP_MS
      setWinStart(Math.max(earliest, ws))
      setFocus({ ...focus, time: t })
    }
  }

  const tune = (index: number) => {
    tuneChannel(index)   // the TV leaves the Guide for the picture and shows the channel banner
    onExit('live')
  }

  const optionItems = (p: GuideProgramme) => {
    // CContextMenuPopupView items shown for this TV (no PVR storage), in the firmware's item order: Schedule
    // Manager, Schedule Viewing or Cancel Scheduled Viewing for upcoming programmes, View Details
    // (t_IsItemShow; PVR rows hidden; which rows show per programme state is inferred)
    const items: { id: 'manager' | 'schedule' | 'cancel' | 'details'; label: string }[] = [{ id: 'manager', label: 'Schedule Manager' }]
    if (p.start.getTime() > now) {
      items.push(scheduled.has(p.id) ? { id: 'cancel', label: 'Cancel Scheduled Viewing' } : { id: 'schedule', label: 'Schedule Viewing' })
    }
    items.push({ id: 'details', label: 'View Details' })
    return items
  }

  // CInputChannelPopupView: number keys open the channel number box; 3 s after the last digit (or OK) the
  // focus jumps to that channel's row, and nothing happens when no channel has the number.
  const commitDigits = (d: string) => {
    clearTimeout(digitTimer.current)
    setDigits('')
    const row = rows.findIndex(r => r.ch.number === Number(d))
    if (row < 0) return
    showRow(row)
    setFocus({ area: 'grid', row, time: focus.area === 'grid' ? Math.max(focus.time, winStart) : Math.max(now, winStart) })
  }
  useEffect(() => () => clearTimeout(digitTimer.current), [])

  const doSchedule = (row: number, p: GuideProgramme) => {
    scheduleViewing(rows[row].ch, p)
    setToast('Viewing scheduled. An on-screen reminder will be displayed 5 minutes before the program begins.')
  }

  const enterProgramme = (long: boolean) => {
    if (focus.area !== 'grid' || !prog) return
    const onNow = prog.start.getTime() <= now && now < prog.end.getTime()
    if (onNow && !long) tune(rows[focus.row].index)       // m_OnOKKeyPressed: current -> tune and exit
    else setPopup({ kind: 'options', row: focus.row, prog, focus: 0 })   // upcoming, or OK held
  }

  // Long press OK opens the options on the current programme too ("Press & Hold: Options"): a held
  // keyboard Enter repeats, which reaches the Guide as a second Enter within the repeat interval.
  const lastEnter = useRef(0)

  useRemote((key: RemoteKey) => {
    if (noChannels) return false
    // keys the Guide does not use go on to the TV (Source, Settings, Channel List, 123, colour keys...)
    if (!GUIDE_KEYS.has(key) && !key.startsWith('Digit')) return false
    if (key === 'Exit' || key === 'Guide') {
      onExit('live')
      return true
    }
    // ---- popups ----
    if (popup?.kind === 'options') {
      const items = optionItems(popup.prog)
      if (key === 'Up') setPopup({ ...popup, focus: Math.max(0, popup.focus - 1) })
      else if (key === 'Down') setPopup({ ...popup, focus: Math.min(items.length - 1, popup.focus + 1) })
      else if (key === 'Back') {
        playFeedback('back')
        setPopup(null)
      } else if (key === 'Enter') {
        const it = items[popup.focus]
        if (it.id === 'manager') launch('schedule-manager', { from: 'guide' })
        else if (it.id === 'schedule') {
          doSchedule(popup.row, popup.prog)
          setPopup(null)
        } else if (it.id === 'cancel') {
          cancelSchedule(popup.prog.id)
          setPopup(null)
        } else setPopup({ kind: 'detail', row: popup.row, prog: popup.prog })
      }
      return true
    }
    if (popup?.kind === 'filter') {
      const list = FILTERS.filter(f => f.id === 'all' || channels.some(c => c.kind === f.kind))
      if (key === 'Up') setPopup({ ...popup, focus: Math.max(0, popup.focus - 1) })
      else if (key === 'Down') setPopup({ ...popup, focus: Math.min(list.length - 1, popup.focus + 1) })
      else if (key === 'Back') {
        playFeedback('back')
        setPopup(null)
      } else if (key === 'Enter') {
        const f = list[popup.focus].id
        mem.filter = f
        setFilter(f)
        setTop(0)
        setPopup(null)
      }
      return true
    }
    if (popup?.kind === 'detail') return false   // ProgramDetail takes its own keys

    if (key.startsWith('Digit')) {
      const d = (digits + key.slice(5)).slice(-4)
      setDigits(d)
      clearTimeout(digitTimer.current)
      digitTimer.current = setTimeout(() => commitDigits(d), 3000)
      return true
    }
    if (digits && key === 'Enter') {
      commitDigits(digits)
      return true
    }
    if (digits && key === 'Back') {
      clearTimeout(digitTimer.current)
      setDigits('')
      return true
    }

    // ---- main view ----
    switch (key) {
      case 'Back':
        playFeedback('back')   // CEpgAui::PlayBackSound, then ExitEpg
        onExit('live')
        return true
      case 'ChannelUp':
      case 'ChannelDown':
        page(key === 'ChannelUp' ? -1 : 1)
        return true
      case 'Info':
        if (prog) setPopup({ kind: 'detail', row: focus.area === 'grid' ? focus.row : 0, prog })
        return true
    }
    if (focus.area === 'filter') {
      if (key === 'Down' && rows.length) setRow(top, 'channel')
      else if (key === 'Right' && rows.length) setRow(top, 'grid')
      else if (key === 'Enter') {
        const list = FILTERS.filter(f => f.id === 'all' || channels.some(c => c.kind === f.kind))
        setPopup({ kind: 'filter', focus: Math.max(0, list.findIndex(f => f.id === filter)) })
      }
      return true
    }
    if (key === 'Up') {
      if (focus.row === 0) setFocus({ area: 'filter' })
      else setRow(focus.row - 1, focus.area)
    } else if (key === 'Down') setRow(focus.row + 1, focus.area)
    else if (focus.area === 'channel') {
      if (key === 'Right') setRow(focus.row, 'grid')
      else if (key === 'Enter') tune(rows[focus.row].index)   // CChannelsList::m_OnOKKeyPressed
    } else {
      if (key === 'Right') moveTime(1)
      else if (key === 'Left') moveTime(-1)
      else if (key === 'Enter') {
        const t = performance.now()
        const held = t - lastEnter.current < 120
        lastEnter.current = t
        enterProgramme(held)
      }
    }
    return true
  })

  // ---- view ----
  const visible = rows.slice(top, top + ROWS)
  const pigRow = channels[tuned]
  const pigProg = pigRow ? programmeAt(pigRow, new Date(now)) : null
  const detail = prog ?? (focus.area === 'channel' && rows[focus.row] ? programmeAt(rows[focus.row].ch, new Date(now)) : null)
  const detailCh = 'row' in focus ? rows[focus.row]?.ch : undefined
  const ticks: number[] = []
  for (let t = winStart; t < winEnd; t += STEP_MS) ticks.push(t)
  const nowX = (now - winStart) * PX_PER_MS
  const filterInfo = FILTERS.find(f => f.id === filter)!

  return (
    <div className="gd">
      {/* ---- header: PIG, detail info, key guide ---- */}
      <div className="gd-header">
        <div className="gd-pig">
          {video && (
            <video
              key={video}
              className="gd-pig__video"
              src={`${import.meta.env.BASE_URL}video/${video}`}
              autoPlay
              muted
              loop
              playsInline
              onLoadedMetadata={e => {
                const v = e.currentTarget
                if (v.duration > 0) v.currentTime = (Date.now() / 1000) % v.duration
              }}
            />
          )}
          {pigRow && (
            <div className="gd-pig__info">
              <div className="gd-pig__title">{pigProg?.title}</div>
              <div className="gd-pig__ch">
                <span className="gd-pig__num">{pigRow.number}</span>
                <span className="gd-pig__name">{pigRow.name}</span>
              </div>
            </div>
          )}
        </div>
        {detail && detailCh && (
          <div className="gd-detail">
            <div className="gd-detail__title-row">
              <div className="gd-detail__title">{detail.title}</div>
              {scheduled.has(detail.id) && <img className="gd-detail__remind" src={`${RES}/epg_i_icon_scheduleviewing.svg`} alt="" />}
            </div>
            <div className="gd-detail__info">
              <span>{dayLabel(detail.start.getTime(), now)} {hhmm(detail.start)} - {hhmm(detail.end)}</span>
              {detail.start.getTime() <= now && now < detail.end.getTime() && (
                <span className="gd-detail__progress">
                  <span style={{ width: `${((now - detail.start.getTime()) / (detail.end.getTime() - detail.start.getTime())) * 100}%` }} />
                </span>
              )}
              <span className="gd-detail__sep" />
              <span>{detailCh.number} {detailCh.name}</span>
              <span className="gd-detail__sep" />
              <span>{detail.genre}</span>
            </div>
            <div className="gd-detail__desc">{detail.desc}</div>
          </div>
        )}
        <KeyGuide onChannel={focus.area !== 'grid'} />
      </div>

      {/* ---- band: channel filter (10u button with 3u padding, CC_BG220) ---- */}
      <div className="gd-band">
        <div className={`gd-filter ${focus.area === 'filter' && !popup ? 'is-focused' : ''}`}>
          <img src={`${RES}/${filter === 'radio' ? 'epg_i_icon_filter_radio.svg' : filter === 'all' ? 'epg_i_icon_filter_all_channels.svg' : 'epg_i_icon_category_TV-channel.svg'}`} alt="" />
          <span>{filterInfo.label}</span>
        </div>
      </div>

      {/* ---- grid ---- */}
      <div className="gd-grid">
        <div className="gd-chhead">{dayLabel(winStart, now)}</div>
        <div className="gd-timebar">
          {ticks.map(t => (
            <div key={t} className="gd-tick" style={{ left: (t - winStart) * PX_PER_MS }}>
              <span>{hhmm(new Date(t))}</span>
            </div>
          ))}
        </div>
        <div className="gd-rows">
          {visible.map((r, i) => {
            const row = top + i
            const progs = progsOf(row).filter(p => p.end.getTime() > winStart && p.start.getTime() < winEnd)
            const chFocused = focus.area === 'channel' && focus.row === row && !popup
            return (
              <div key={r.ch.number} className="gd-row" style={{ top: i * ROW_H }}>
                <div className={`gd-ch ${chFocused ? 'is-focused' : ''} ${r.index === tuned ? 'is-tuned' : ''}`}>
                  <div className="gd-ch__logo">{r.ch.name.slice(0, 5)}</div>
                  <div className="gd-ch__num">{r.ch.number}</div>
                  <div className="gd-ch__name">{r.ch.name}</div>
                </div>
                <div className="gd-progs">
                  {progs.map(p => {
                    const s = Math.max(p.start.getTime(), winStart)
                    const e = Math.min(p.end.getTime(), winEnd)
                    const on = prog?.id === p.id && focus.area === 'grid' && focus.row === row
                    const airing = p.start.getTime() <= now && now < p.end.getTime()
                    return (
                      <div
                        key={p.id}
                        className={`gd-prog ${on ? 'is-focused' : ''} ${airing ? 'is-now' : ''}`}
                        style={{ left: (s - winStart) * PX_PER_MS, width: (e - s) * PX_PER_MS }}
                      >
                        {scheduled.has(p.id) && <img className="gd-prog__icon" src={`${RES}/${on ? 'epg_i_icon_scheduleviewing_f.svg' : 'epg_i_icon_scheduleviewing.svg'}`} alt="" />}
                        <span className="gd-prog__title">{p.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {nowX >= 0 && nowX <= PROG_W && <div className="gd-now" style={{ left: CH_W + nowX - 4 }} />}
      </div>

      {/* ---- popups ---- */}
      {popup?.kind === 'options' && (
        <OptionsMenu
          items={optionItems(popup.prog).map(i => i.label)}
          focus={popup.focus}
          anchor={cellRect(popup.row - top, popup.prog, winStart, winEnd)}
        />
      )}
      {popup?.kind === 'filter' && (
        <FilterMenu
          items={FILTERS.filter(f => f.id === 'all' || channels.some(c => c.kind === f.kind)).map(f => ({ label: f.label, selected: f.id === filter }))}
          focus={popup.focus}
        />
      )}
      {popup?.kind === 'detail' && rows[popup.row] && (
        <ProgramDetail
          ch={rows[popup.row].ch}
          prog={popup.prog}
          scheduled={scheduled.has(popup.prog.id)}
          onClose={action => {
            const p = popup
            setPopup(null)
            if (action === 'watch') tune(rows[p.row].index)
            else if (action === 'schedule') doSchedule(p.row, p.prog)
            else if (action === 'cancel') cancelSchedule(p.prog.id)
          }}
        />
      )}
      {toast && <div className="gd-toast">{toast}</div>}
      {digits && <ChannelBanner seq={1} roll="none" digits={digits} />}
      {noChannels && (
        // CMsgboxManager: no stored channels (TV_SID_CHANNEL_SCAN / TV_SID_NO_CHANNELS_FOUND_SCAN_FIRST_KR_DO)
        <MessageBox
          title="Channel Scan"
          message="No channels found. Please scan for channels first."
          buttons={['Scan Now', 'Cancel']}
          onClose={b => (b === 0 ? launch('channel-search') : onExit('live'))}
        />
      )}
    </div>
  )
}

// Position of a programme cell on screen (for the options popup next to it).
function cellRect(visRow: number, p: GuideProgramme, winStart: number, winEnd: number) {
  const s = Math.max(p.start.getTime(), winStart)
  const e = Math.min(p.end.getTime(), winEnd)
  return { x: CH_W + (s - winStart) * PX_PER_MS, y: 488 + visRow * ROW_H, w: (e - s) * PX_PER_MS, h: ROW_H }
}

// CContextMenuPopupView: a 49u option list (CC_BG4100 plate, C_TextTile_SingleLine_02 items) placed
// beside the focused cell (m_SetPosition), over a CC_Dim50 dim (t_AddPopupDim).
function OptionsMenu({ items, focus, anchor }: { items: string[]; focus: number; anchor: { x: number; y: number; w: number; h: number } }) {
  const w = 392
  const h = items.length * 80 + 16
  const x = anchor.x + anchor.w + 16 + w <= 1920 - 40 ? anchor.x + anchor.w + 16 : Math.max(40, anchor.x - w - 16)  // (inferred)
  const y = Math.max(40, Math.min(1080 - 40 - h, anchor.y))
  return (
    <div className="gd-popdim">
      <div className="gd-opt" style={{ left: x, top: y, width: w }}>
        {items.map((label, i) => (
          <div key={label} className={`gd-opt__item ${i === focus ? 'is-focused' : ''}`}>
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// Channel filter list (CChannelAndAntennaFilterPopupView), dropped from the filter button.
function FilterMenu({ items, focus }: { items: { label: string; selected: boolean }[]; focus: number }) {
  return (
    <div className="gd-popdim">
      <div className="gd-opt gd-opt--filter" style={{ left: 32, top: 384, width: 392 }}>
        {items.map((it, i) => (
          <div key={it.label} className={`gd-opt__item ${i === focus ? 'is-focused' : ''} ${it.selected ? 'is-selected' : ''}`}>
            {it.label}
            {it.selected && <img className="gd-opt__check" src={`${TV}/VD_ICONS/i_icon_info_check.svg`} alt="" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// CDarkThemeKeyGuide: the TV's remote (17u x 35u) with pink callout lines (epg_ris_line_*_focused_*.svg)
// to the keys and a 32u text column (T16 SamsungOneUI_400 CC_Basic1100). Programme focus: five callouts;
// channel focus: two. Text order top to bottom follows the line ends (inferred mapping).
const KEYS_PROGRAM = ['More Options', 'Press & Hold: Fast Search', 'Press & Hold: Options', 'On Now', 'Page Up/Down']
const KEYS_CHANNEL = ['More Options', '', '', '', 'Page Up/Down']
const KEY_Y = [24.6, 57, 115.4, 183.4, 216.6]   // line ends in the 136x240 line art

function KeyGuide({ onChannel }: { onChannel: boolean }) {
  const texts = onChannel ? KEYS_CHANNEL : KEYS_PROGRAM
  return (
    <div className="gd-keys">
      <img className="gd-keys__remote" src={`${RES}/epg_ris_remote_b_tm2560.svg`} alt="" />
      <img className="gd-keys__lines" src={`${RES}/${onChannel ? 'epg_ris_line_ch_focused_default.svg' : 'epg_ris_line_program_focused_default.svg'}`} alt="" />
      <div className="gd-keys__texts">
        {texts.map((t, i) =>
          t ? (
            <div key={i} className="gd-keys__text" style={{ top: 20 + KEY_Y[i] }}>
              {t}
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}
