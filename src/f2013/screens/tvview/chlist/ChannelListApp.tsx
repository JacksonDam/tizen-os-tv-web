import { useEffect, useMemo, useRef, useState } from 'react'
import { useRemote, type RemoteKey } from '../../../../input/remote'
import { programmeAt, type Channel } from '../../../../tv/channels'
import { openApp, type AppProps } from '../../../shell'
import { UI_SOUND, playUi } from '../../../tv/sound'
import { getSetting, getTv, setSetting, tuneChannel, useTv } from '../../../tv/store'
import { argb } from '../common'
import { emit, showBanner } from '../overlays/bus'
import { EdgeWindow, type EdgeKind } from './EdgeWindow'
import { C, DISABLE_ALPHA, HIDE_MS, L, SHOW_MS, SLIDE_PX, TIMEOUT_MS, WINDOW_BG_ALPHA } from './layout'
import { MODE_NAME, S, edgeInitialFocus, modeItems, rowsFor, sortingItems, type ChMode, type SortMode } from './model'
import { initialPos, page, step, type ListPos } from './nav'
import { AniText, ChannelNumber, Composite, Pic } from './parts'

// Channel List (exeDSP CChannelListApp, app 0x1f): CH LIST opens it over the TV picture at the right
// edge (CChannelListWindow, 748 x 1080 at x 1172). The title shows the channel mode with "Sorting"
// (left key) and "Mode" (right key) on its sides; each opens an edge window (CChannelListEdgeWindow)
// that swings out over the list. CChannelListUtil::GetViewMode() returns 0 on this firmware, so the
// list is always the text view (CChannelListTextViewRenderer, 90 px rows); the thumbnail view and
// its "View Mode" item are compiled out.

const ROWS = Math.floor((L.MAIN_LIST_H - L.MAIN_LIST_MARGIN_TOP - L.MAIN_LIST_MARGIN_BOTTOM) / L.MAIN_LIST_ITEM_H_TEXT) // 10

const sortKey = (mode: ChMode) => `chlist.sort.${mode}`

type Edge = { kind: EdgeKind; focus: number; leaving: boolean } | null

// openApp('chlist', { returnTo: { id, params } }) from another application (e.g. the Menu's
// Broadcasting > Channel List): RETURN and the time-out go back there, as ReturnToPreviousApp does
// for CChannelListUtil::m_fromAppId 0x21/0x23/0x2e; opened from the TV, they exit to the picture.
type Params = { returnTo?: { id: string; params?: unknown } } | undefined

export function ChannelListApp({ close, params }: AppProps) {
  const returnTo = (params as Params)?.returnTo
  const channels = useTv(s => s.channels)
  const current = useTv(s => (s.source === 'TV' ? s.channel : -1))
  const [mode, setMode] = useState<ChMode>(() => getSetting<ChMode>('tv.chMode', 'all'))
  const [sort, setSort] = useState<SortMode>(() => getSetting<SortMode>(sortKey(getSetting<ChMode>('tv.chMode', 'all')), 'number'))
  const rows = useMemo(() => rowsFor(channels, mode, sort), [channels, mode, sort])
  const empty = rows.length === 0
  // CChannelListWindow::m_CreateAndSetDataSource: the list opens on the current channel
  // (m_GetCurrentChannelItemIndex), else on the first row.
  const [pos, setPos] = useState<ListPos>(() => initialPos(Math.max(0, rows.indexOf(current)), rows.length, ROWS))
  const [edge, setEdge] = useState<Edge>(null)
  const [phase, setPhase] = useState<'start' | 'in' | 'out'>('start')
  const [now, setNow] = useState(() => new Date())
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const leaving = phase === 'out'

  // Slide/fade in (CChannelListWindow::m_AnimationShow) on the next frame.
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('in')))
    return () => cancelAnimationFrame(r)
  }, [])
  // Programme names and progress follow the clock.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  // CChannelListUtil::ExitChannelList / ReturnToPreviousApp (opened from the TV, so both exit):
  // the window slides out (m_AnimationHide, 350 ms) and the application stops.
  const exitList = () => {
    if (leaving) return
    setPhase('out')
    setTimeout(close, HIDE_MS)
  }
  const returnToPrevious = () => {
    if (returnTo && openApp(returnTo.id, returnTo.params)) return
    exitList()
  }
  const backRef = useRef(returnToPrevious)
  backRef.current = returnToPrevious
  // 60 s without a key: m_OnTimeOutExitAlarmCallback -> ReturnToPreviousApp.
  const resetTimeout = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => backRef.current(), TIMEOUT_MS)
  }
  useEffect(() => {
    resetTimeout()
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // UpdateList after a new mode or sort order (CChannelListManager::m_UpdateMainWindow): the list is
  // rebuilt on the current channel; if the current channel is not in the new list, the first row is
  // focused and tuned (m_CreateAndSetDataSource sends 0x1bb7 -> HandleEvent -> TuneChannel).
  const rebuild = (m: ChMode, so: SortMode) => {
    const r = rowsFor(getTv().channels, m, so)
    const tv = getTv()
    const cur = tv.source === 'TV' ? r.indexOf(tv.channel) : -1
    if (cur < 0 && r.length) tuneChannel(r[0])
    setPos(initialPos(Math.max(0, cur), r.length, ROWS))
  }

  const openEdge = (kind: EdgeKind) => {
    const items = kind === 'sorting' ? sortingItems(mode, sort, empty) : modeItems(channels, mode)
    setEdge({ kind, focus: edgeInitialFocus(items), leaving: false })
  }
  // RETURN in an edge window: m_ReturnToChannelListWindow -> the edge window swings back (350 ms),
  // then the list is enabled again (m_DestroyEdgeWindow -> EnableChannelListWindow(1)).
  const closeEdge = () => {
    setEdge(e => (e ? { ...e, leaving: true } : e))
  }

  const edgeItems = edge ? (edge.kind === 'sorting' ? sortingItems(mode, sort, empty) : modeItems(channels, mode)) : []

  const pressEdgeItem = () => {
    if (!edge || edge.leaving) return
    const it = edgeItems[edge.focus]
    if (!it) return
    // CChannelListEdgeWindow::m_OnItemPress plays the select sound for every item.
    playUi(UI_SOUND.SELECT)
    if (!it.enabled) return // the firmware shows "This function isn't available." (message box, not built)
    if (edge.kind === 'sorting') {
      // m_SortingItemPress: SetSortMode(0 Number / 1 Name) for the current mode, then UpdateList.
      const so: SortMode = it.key === 'name' ? 'name' : 'number'
      setSetting(sortKey(mode), so)
      setSort(so)
      setEdge(null)
      rebuild(mode, so)
      return
    }
    if (it.key === 'editfav') {
      // m_ModeItemPress: Edit Favourites hands over to the Menu's Edit Favourites screen
      // (0x1b40 -> CTaskManager::RunApp(0x1f, 0x50001, 0x4da)).
      // Without a Menu application registered, nothing happens.
      openApp('menu', { from: 'chlist', item: 'Edit Favourites', firmwareItem: 0x4da })
      return
    }
    // SetNavigationMode(mode, sub) changes the TV's channel mode, then UpdateList.
    const m = it.key as ChMode
    setSetting('tv.chMode', m)
    const so = getSetting<SortMode>(sortKey(m), 'number')
    setMode(m)
    setSort(so)
    setEdge(null)
    rebuild(m, so)
  }

  // Enter on a row (CChannelListWindow::m_OnItemPress): another channel is tuned and the list stops
  // with the TV viewer's channel banner (event 0x1bb6/1 -> 0x17cf); the current channel stops the list
  // and generates KEY_INFO (0x1bb6/2), which shows the INFO banner.
  const pressRow = () => {
    if (empty) return
    const idx = rows[pos.focus]
    const tv = getTv()
    if (tv.source === 'TV' && tv.channel === idx) {
      close()
      emit('info')
      return
    }
    tuneChannel(idx)
    close()
    showBanner()
  }

  const onKey = (key: RemoteKey): boolean => {
    if (leaving) return key !== 'VolumeUp' && key !== 'VolumeDown' && key !== 'Mute' && key !== 'Power'
    // CChannelListApp::m_HookEvent: CH LIST closes the list from any window.
    if (key === 'ChannelList') {
      exitList()
      return true
    }
    if (key === 'Exit') {
      exitList() // KEY_EXIT (0x2d): ExitChannelList
      return true
    }
    resetTimeout()
    if (edge) {
      if (edge.leaving) return true
      const n = edgeItems.length
      switch (key) {
        case 'Up':
        case 'Down': {
          if (n > 1) {
            setEdge({ ...edge, focus: (edge.focus + (key === 'Down' ? 1 : -1) + n) % n })
            playUi(16) // CSingleLineListWidget::m_OnInputCallback: PlayAudio(0x10) on a move
          }
          return true
        }
        case 'ChannelUp':
        case 'ChannelDown':
          return true // one page of edge items: nothing to page
        case 'Enter':
          pressEdgeItem()
          return true
        case 'Back':
          closeEdge()
          return true
        case 'Left':
          if (edge.kind === 'mode') closeEdge()
          return true
        case 'Right':
          if (edge.kind === 'sorting') closeEdge()
          return true
        case 'Red':
        case 'Yellow':
        case 'Blue':
        case 'PlayPause':
          return true
        default:
          return false
      }
    }
    switch (key) {
      case 'Up':
      case 'Down':
        if (rows.length > 1) {
          setPos(p => step(p, key === 'Down' ? 1 : -1, rows.length, ROWS))
          playUi(16)
        }
        return true
      // CChannelListWindow::m_OnKeyPress: KEY_CHUP (0x12) PrevPage, KEY_CHDOWN (0x10) NextPage.
      case 'ChannelUp':
        setPos(p => page(p, -1, rows.length, ROWS))
        return true
      case 'ChannelDown':
        setPos(p => page(p, 1, rows.length, ROWS))
        return true
      case 'Enter':
        if (!empty) playUi(UI_SOUND.SELECT) // m_OnInputCallback: PlayAudio(8) on OK
        pressRow()
        return true
      // KEY_JOYSTICK_LEFT (4) -> Sorting edge window, KEY_JOYSTICK_RIGHT (5) -> Mode edge window.
      case 'Left':
        openEdge('sorting')
        return true
      case 'Right':
        openEdge('mode')
        return true
      case 'Back':
        returnToPrevious() // KEY_RETURN (0x58): ReturnToPreviousApp
        return true
      // Registered by m_RegisterKey but unused by the list: swallowed.
      case 'Red':
      case 'Yellow':
      case 'Blue':
      case 'PlayPause':
        return true
      default:
        return false
    }
  }
  useRemote(onKey)

  const enabled = !edge // EnableChannelListWindow(0) while an edge window is open
  const dim = enabled ? 1 : DISABLE_ALPHA
  const shown = phase === 'in'

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: L.MAIN_WINDOW_X,
          top: 0,
          width: L.MAIN_WINDOW_W,
          height: 1080,
          opacity: shown ? 1 : 0,
          transform: `translateX(${shown ? 0 : SLIDE_PX}px)`,
          // position: start type 0, end type 2 (decelerating); alpha: types 1/1 (inferred curves)
          transition: phase === 'start' ? 'none' : `transform ${leaving ? HIDE_MS : SHOW_MS}ms cubic-bezier(0.2,0.6,0.3,1), opacity ${leaving ? HIDE_MS : SHOW_MS}ms ease-in-out`,
        }}
      >
        {/* m_CreateAndShowBG: channellist_bg (alpha 205), ch_top_line under the title, tools_bg_shadow */}
        <Pic src="ChannelList/channellist_bg.bmp" x={L.WINDOW_BG_X} y={0} style={{ opacity: WINDOW_BG_ALPHA }} />
        <Pic src="ChannelList/ch_top_line.bmp" x={L.TITLE_X} y={L.TITLE_H} style={{ opacity: dim }} />
        <Pic src="ChannelList/tools_bg_shadow.bmp" x={0} y={0} />
        <Title mode={mode} dim={dim} />
        <List
          channels={channels}
          rows={rows}
          pos={pos}
          current={current}
          enabled={enabled}
          now={now}
        />
      </div>
      {edge && (
        <EdgeWindow
          kind={edge.kind}
          items={edgeItems}
          focus={edge.focus}
          leaving={edge.leaving}
          onGone={() => setEdge(null)}
        />
      )}
    </div>
  )
}

// m_CreateAndShowTitle / m_UpdateTitleBar: the mode name (CCTextAniDrawing, 54 px, white, centred)
// between the two side buttons, "Sorting" with title_arrow_left_n and "Mode" with
// title_arrow_right_n (32 px, CHLIST_FONT_COLOR_MEDIUM_GREY).
function Title({ mode, dim }: { mode: ChMode; dim: number }) {
  return (
    <>
      <AniText
        text={MODE_NAME[mode]}
        x={L.TITLE_MAIN_X}
        y={0}
        w={L.TITLE_MAIN_W}
        h={L.TITLE_H}
        size={L.TITLE_MAIN_FONT_SIZE}
        color={C.WHITE}
        align="center"
        opacity={dim}
      />
      <div style={{ position: 'absolute', left: L.TITLE_SIDE_LEFT_X, top: 0, width: L.TITLE_SIDE_W, height: L.TITLE_H, opacity: dim }}>
        <Pic src="ChannelList/title_arrow_left_n.bmp" x={L.TITLE_ARROW_LEFT_X} y={L.TITLE_ARROW_Y} />
        <AniText text={S.SORTING} x={L.TITLE_TEXT_LEFT_X} y={0} w={L.TITLE_TEXT_W} h={L.TITLE_H} size={L.TITLE_SUB_FONT_SIZE} color={C.MEDIUM_GREY} />
      </div>
      <div style={{ position: 'absolute', left: L.TITLE_SIDE_RIGHT_X, top: 0, width: L.TITLE_SIDE_W, height: L.TITLE_H, opacity: dim }}>
        <AniText text={S.MODE} x={L.TITLE_TEXT_RIGHT_X} y={0} w={L.TITLE_TEXT_W} h={L.TITLE_H} size={L.TITLE_SUB_FONT_SIZE} color={C.MEDIUM_GREY} align="right" />
        <Pic src="ChannelList/title_arrow_right_n.bmp" x={L.TITLE_ARROW_RIGHT_X} y={L.TITLE_ARROW_Y} />
      </div>
    </>
  )
}

function List({ channels, rows, pos, current, enabled, now }: {
  channels: Channel[]
  rows: number[]
  pos: ListPos
  current: number
  enabled: boolean
  now: Date
}) {
  const ox = L.MAIN_LIST_X + L.MAIN_LIST_MARGIN_LEFT
  const oy = L.MAIN_LIST_Y + L.MAIN_LIST_MARGIN_TOP
  const visible = rows.slice(pos.top, pos.top + ROWS)
  const n = rows.length
  return (
    <>
      {n === 0 && (
        // CChannelListEmptyRenderer: one row with "The current channel list is empty."
        <AniText
          text={S.EMPTY}
          x={ox}
          y={oy}
          w={L.MAIN_LIST_ITEM_W}
          h={L.MAIN_LIST_ITEM_H_TEXT}
          size={L.ITEM_CHANNEL_NAME_FONT_SIZE}
          color={C.WHITE}
          align="center"
          opacity={enabled ? 1 : DISABLE_ALPHA}
        />
      )}
      {n > 0 && enabled && (
        // SetFocusCompositeImage(list_highlight, 764 x 144) centred on the focused 708 x 90 row.
        <Composite
          src="Common/list_highlight.bmp"
          iw={82}
          ih={85}
          x={ox + (L.MAIN_LIST_ITEM_W - L.MAIN_LIST_FOCUS_COMPOSITE_W) / 2}
          y={oy + (pos.focus - pos.top) * L.MAIN_LIST_ITEM_H_TEXT + (L.MAIN_LIST_ITEM_H_TEXT - L.MAIN_LIST_FOCUS_COMPOSITE_H_TEXT) / 2}
          w={L.MAIN_LIST_FOCUS_COMPOSITE_W}
          h={L.MAIN_LIST_FOCUS_COMPOSITE_H_TEXT}
        />
      )}
      {visible.map((idx, i) => (
        <Row
          key={idx}
          ch={channels[idx]}
          x={ox}
          y={oy + i * L.MAIN_LIST_ITEM_H_TEXT}
          focused={enabled && pos.top + i === pos.focus}
          isCurrent={idx === current}
          enabled={enabled}
          now={now}
        />
      ))}
      {/* SetScrollUpDownArrowProperty with the default AppCM arrows, shown while the list can scroll
          that way (m_UpdateScrollUpDownArrow). */}
      {pos.top > 0 && <Pic src="AppCM/act_arrow_up_nor.bmp" x={L.MAIN_LIST_X + L.MAIN_LIST_ARROW_X} y={L.MAIN_LIST_Y + L.MAIN_LIST_ARROW_UP_Y} />}
      {pos.top + ROWS < n && <Pic src="AppCM/act_arrow_down_nor.bmp" x={L.MAIN_LIST_X + L.MAIN_LIST_ARROW_X} y={L.MAIN_LIST_Y + L.MAIN_LIST_ARROW_DOWN_Y} />}
    </>
  )
}

// One text-view row (CChannelListTextViewRenderer::Draw, 0x029b8c38).
function Row({ ch, x, y, focused, isCurrent, enabled, now }: {
  ch: Channel
  x: number
  y: number
  focused: boolean
  isCurrent: boolean
  enabled: boolean
  now: Date
}) {
  const alpha = enabled ? 1 : DISABLE_ALPHA
  // CChannelListUtil::GetProgramName: the EPG title, "No Information" without a programme.
  const prog = programmeAt(ch, now)
  const title = prog ? prog.title || S.NO_PROGRAMME_NAME : S.NO_INFORMATION
  // m_GetProgressBarWidth: elapsed share of PROGRESS_W; m_DrawProgressBar draws it on the focused
  // row only, with at least the bitmap's width (epg_progress is 14 OSD px wide).
  let progress = -1
  if (prog) {
    const t = now.getTime()
    const s = prog.start.getTime()
    const e = prog.end.getTime()
    if (t < s) progress = 0
    else progress = t > e ? L.ITEM_TEXT_PROGRESS_W : Math.floor((L.ITEM_TEXT_PROGRESS_W * (t - s)) / (e - s))
  }
  const showBar = focused && progress >= 0
  // m_DrawProgramName: white, CHLIST_FONT_COLOR_LIME on the channel being watched, yellow when focused.
  const progColor = focused ? C.YELLOW : isCurrent ? C.LIME : C.WHITE
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: L.MAIN_LIST_ITEM_W, height: L.MAIN_LIST_ITEM_H_TEXT }}>
      <ChannelNumber value={String(ch.number)} x={L.ITEM_TEXT_CHANNEL_NUMBER_X} y={L.ITEM_TEXT_CHANNEL_NUMBER_Y} gap={L.ITEM_TEXT_CHANNEL_NUMBER_GAP} opacity={alpha} />
      <div
        style={{
          position: 'absolute',
          left: L.ITEM_TEXT_CHANNEL_BAR_X,
          top: L.ITEM_TEXT_CHANNEL_BAR_Y,
          width: L.ITEM_TEXT_CHANNEL_BAR_W,
          height: L.ITEM_TEXT_CHANNEL_BAR_H,
          background: argb(C.ITEM_CHANNEL_BAR),
          opacity: alpha,
        }}
      />
      {/* No icon applies to the mocked lineup (IsThisIconAvailable: analogue, favourite, scrambled,
          locked, recording...), so the channel name keeps the wide box. */}
      <AniText
        text={ch.name}
        x={L.ITEM_TEXT_CHANNEL_NAME_X}
        y={L.ITEM_TEXT_CHANNEL_NAME_Y}
        w={L.ITEM_TEXT_CHANNEL_NAME_W}
        h={L.ITEM_TEXT_DRAWING_BOX_H_WIDE}
        size={L.ITEM_PROGRAM_NAME_FONT_SIZE}
        color={C.SKY_BLUE}
        scroll={focused}
        opacity={alpha}
      />
      <AniText
        text={title}
        x={L.ITEM_TEXT_PROGRAM_NAME_X}
        y={L.ITEM_TEXT_PROGRAM_NAME_Y}
        w={L.ITEM_TEXT_PROGRAM_NAME_W}
        h={showBar ? L.ITEM_TEXT_PROGRAM_NAME_H_SMALL : L.ITEM_TEXT_PROGRAM_NAME_H_WIDE}
        size={L.ITEM_PROGRAM_NAME_FONT_SIZE}
        color={progColor}
        opacity={alpha}
      />
      {showBar && (
        <>
          <Composite src="ChannelList/epg_progress_bg.bmp" iw={14} ih={11} x={L.ITEM_TEXT_PROGRESS_X} y={L.ITEM_TEXT_PROGRESS_Y} w={L.ITEM_TEXT_PROGRESS_W} h={L.ITEM_TEXT_PROGRESS_H} />
          {progress > 0 && (
            <Composite
              src="Common/epg_progress.bmp"
              iw={14}
              ih={11}
              x={L.ITEM_TEXT_PROGRESS_X}
              y={L.ITEM_TEXT_PROGRESS_Y}
              w={Math.max(14 * 1.5, progress)}
              h={L.ITEM_TEXT_PROGRESS_H}
            />
          )}
        </>
      )}
    </div>
  )
}
