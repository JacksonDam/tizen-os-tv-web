import { useEffect, useRef, useState } from 'react'
import { useRemote, type RemoteKey } from '../../../../input/remote'
import type { AppProps } from '../../../shell'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { openApp } from '../../../shell'
import { getTv, switchSource, useTv } from '../../../tv/store'
import { deviceName, INPUTS } from '../sources'
import { L, TOOLS_BALLOON_TEXT } from './layout'
import { EditNameWindow } from './EditName'
import { InfoWindow } from './Info'
import { MessageBox, ToolsPopup, type PopupItem } from './popups'
import { Nine, Pic, Text, rgb } from './parts'

// The Source application (exeDSP CSourceApp / CSourceMainWndBase / CSourceListDataRenderer): a
// 1920x396 window across the top of the picture with the inputs in one horizontal row. Layout values
// are SourceOSDInfo statics evaluated at 1920 (see layout.ts and spec/tvview-source.md).

type Item = {
  id: string
  type: string          // the source text (CSourceItem::GetSourceText)
  icon: string          // SourceBrowser/<icon>_n|_f.bmp
  connected: boolean    // CSourceItem vtable+8 (jack connected)
  legacy: boolean       // CSourceManagerUtil::FlagLagacyDevice(type)
  sourceType: number
}

const ICON: Record<string, string> = {
  tv: 'tv', hdmi: 'hdmi', ext: 'ext', av: 'avcable', component: 'component', mirroring: 'screen_mirroring',
}

// FlagLagacyDevice (0x046502a4): TV, AV, Component, PC, HDMI, SCART... are "legacy" inputs; network,
// USB and Screen Mirroring sources are not.
function isLegacy(t: number) {
  return t === 0 || (t >= 0x1c && t <= 0x1e) || (t >= 0x21 && t <= 0x23) || (t >= 0x29 && t <= 0x2b) ||
    t === 0x31 || (t >= 0x39 && t <= 0x3c) || (t >= 0x41 && t <= 0x43) || t === 0x49 || t === 0x69 ||
    t === 0x6a || t === 0x88 || t === 0xb8 || t === 0xc0 || t === 0xe2
}

function items(): Item[] {
  return INPUTS.map(i => ({
    id: i.id, type: i.title, icon: ICON[i.type], connected: i.connected, legacy: isLegacy(i.sourceType), sourceType: i.sourceType,
  }))
}

type Overlay =
  | { kind: 'popup'; items: PopupItem[]; focus: number; itemIdx: number }
  | { kind: 'msg'; text: string }
  | { kind: 'editname'; itemIdx: number }
  | { kind: 'info'; itemIdx: number }
  | null

export function SourceApp({ close }: AppProps) {
  const list = useRef(items()).current
  const source = useTv(s => s.source)
  useTv(s => s.settings) // re-render on Edit Name changes
  const [focus, setFocus] = useState(() => Math.max(0, list.findIndex(i => i.id === getTv().source)))
  const [scroll, setScroll] = useState(() => clampScroll(Math.max(0, list.findIndex(i => i.id === getTv().source)), 0, list.length))
  const [area, setArea] = useState<'list' | 'tools'>('list')
  const [checkIdx, setCheckIdx] = useState(-1)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [phase, setPhase] = useState<'enter' | 'shown' | 'exit'>('enter')
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const connectAlarm = useRef<ReturnType<typeof setTimeout>>(undefined)
  const closing = useRef(false)

  // Show animation: CDefaultWindow::m_ShowAni type 6 with CSourceMainWndAnimation times (500 ms,
  // y offset 200, alpha 0 -> window alpha).
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('shown')))
    return () => cancelAnimationFrame(r)
  }, [])

  const hide = () => {
    if (closing.current) return
    closing.current = true
    clearTimeout(timeout.current)
    clearTimeout(connectAlarm.current)
    setPhase('exit')
    setTimeout(close, L.ANI_HIDE_MS)
  }

  // CDefaultWindow time-out alarm: SetAlarmTimeOut(5000) in CSourceMainWndBase::Show (20000 with the
  // voice recognition app); every key resets it (t_ResetTimeOutAlarm). Stopped while a sub window is up.
  const resetTimeout = () => {
    clearTimeout(timeout.current)
    if (overlayRef.current && overlayRef.current.kind !== 'popup') return
    timeout.current = setTimeout(hide, L.TIMEOUT_MS)
  }
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay
  useEffect(() => {
    resetTimeout()
    return () => {
      clearTimeout(timeout.current)
      clearTimeout(connectAlarm.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay])

  // t_OnFocusChanged starts the 2 s connect alarm; t_OnConnectAlarmCallback then connects the focused
  // input if it is connected, a legacy input and not already the current one (the list stays open).
  const startConnectAlarm = (idx: number) => {
    clearTimeout(connectAlarm.current)
    connectAlarm.current = setTimeout(() => {
      const it = list[idx]
      if (closing.current || overlayRef.current) return
      if (it.connected && it.legacy && getTv().source !== it.id) switchSource(it.id)
    }, L.CONNECT_ALARM_MS)
  }

  const moveFocus = (to: number) => {
    setFocus(to)
    setScroll(s => clampScroll(to, s, list.length))
    startConnectAlarm(to)
  }

  // Enter on an item (t_OnItemPress -> CSourceItem::Connect): a connected input is switched to and the
  // Source app closes; an input with nothing connected shows message box 0.
  const press = (idx: number) => {
    const it = list[idx]
    clearTimeout(connectAlarm.current)
    if (!it.connected) {
      setOverlay({ kind: 'msg', text: 'This source is not connected. Please check the connection again.' })
      return
    }
    if (getTv().source !== it.id) switchSource(it.id)
    hide()
  }

  // CSourceWidgetAgency::t_ShowPopup (0x029a30bc): the Tools sub list for the focused input.
  const toolsFor = (idx: number): PopupItem[] => {
    const it = list[idx]
    const out: PopupItem[] = []
    // Anynet+ (HDMI-CEC) is listed while CEC is enabled (factory default On, inferred).
    out.push({ id: 7, label: 'Anynet+ (HDMI-CEC)' })
    if (it.sourceType !== 0 && it.sourceType !== 0x69 && it.sourceType !== 0xe4 && it.legacy) out.push({ id: 0, label: 'Edit Name' })
    if (it.connected && it.sourceType !== 0xe4) out.push({ id: 1, label: 'Information' })
    return out
  }
  // Initial focus: Anynet+ if present first, else Edit Name, else the first item (SetFocusItemId).
  const openTools = (idx: number) => {
    const it = list[idx]
    if (!it.connected && !it.legacy) return
    const its = toolsFor(idx)
    if (!its.length) return
    playUi(UI_SOUND.SELECT)
    clearTimeout(connectAlarm.current)
    setCheckIdx(idx)
    setOverlay({ kind: 'popup', items: its, focus: 0, itemIdx: idx })
  }

  // Screen Mirroring selected and CEC disabled would dim the Tools button (t_OnFocusChanged); with CEC
  // on (default) it stays enabled.
  const toolsEnabled = true

  useRemote(key => {
    if (closing.current) return isNavKey(key)
    resetTimeout()
    const ov = overlayRef.current
    if (ov) return false // the sub window handles its keys
    if (key === 'Exit') {
      hide()
      return true
    }
    if (key === 'Back') {
      playUi(UI_SOUND.BACK)
      hide()
      return true
    }
    if (key === 'Source') {
      // t_ConnectNextSource: the next item if it is connected, else the first item; legacy inputs
      // are connected at once.
      if (area !== 'list') return true
      clearTimeout(connectAlarm.current)
      const next = focus + 1 < list.length && list[focus + 1].connected ? focus + 1 : 0
      setFocus(next)
      setScroll(s => clampScroll(next, s, list.length))
      const it = list[next]
      if (it.legacy && it.connected && getTv().source !== it.id) switchSource(it.id)
      return true
    }
    if (key === 'Tools') {
      if (area === 'list') openTools(focus)
      else openTools(checkIdx)
      return true
    }
    if (area === 'tools') {
      if (key === 'Down') {
        setArea('list')
        setCheckIdx(-1)
        startConnectAlarm(focus)
      } else if (key === 'Enter') openTools(checkIdx)
      return isNavKey(key)
    }
    switch (key) {
      case 'Left':
        if (focus > 0) {
          playUi(16)
          moveFocus(focus - 1)
        }
        return true
      case 'Right':
        if (focus < list.length - 1) {
          playUi(16)
          moveFocus(focus + 1)
        }
        return true
      case 'Up':
        // t_OnKeyPress Up: the list loses the focus to the Tools button (the focused item keeps a check
        // mark, t_OnListFocusCallback 0x38).
        if (toolsEnabled) {
          clearTimeout(connectAlarm.current)
          setCheckIdx(focus)
          setArea('tools')
        }
        return true
      case 'Enter':
        playUi(UI_SOUND.SELECT)
        press(focus)
        return true
      case 'Down':
        return true
      default:
        return false
    }
  })

  const shown = phase === 'shown'
  const listFocused = area === 'list' && !overlay
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: "'SamsungSVD', sans-serif" }}>
      <div
        style={{
          position: 'absolute',
          left: L.WND_X,
          top: L.WND_Y,
          width: L.WND_W,
          height: L.WND_H,
          opacity: shown ? L.WND_OPACITY / 255 : 0,
          transform: `translateY(${shown ? 0 : -L.ANI_Y}px)`,
          transition: phase === 'enter' ? 'none'
            : `opacity ${L.ANI_SHOW_MS}ms ease-in-out, transform ${L.ANI_SHOW_MS}ms cubic-bezier(0, 0, 0.3, 1)`,
        }}
      >
        <Nine src="SourceBrowser/source_list_bg.bmp" x={0} y={0} w={L.WND_W} h={L.WND_H} t={L.BG_SLICE_T} r={0} b={L.BG_SLICE_B} l={0} />
        <Text x={L.TITLE_X} y={L.TITLE_Y} w={L.TITLE_W} h={L.TITLE_H} size={L.TITLE_FONT} color="#fff">Source</Text>
        <Pic src="SourceBrowser/SourceListHelpLine.bmp" x={L.HELP_LINE_X} y={L.HELP_LINE_Y} w={480 * 1.5} h={2 * 1.5} />
        {/* Tools button (t_CreateToolsURSButton) and its focus frame / word balloon */}
        <Pic src={toolsEnabled ? 'SourceBrowser/option_tool_nor.bmp' : 'SourceBrowser/option_tool_dim.bmp'}
          x={L.TOOLS_X} y={L.TOOLS_Y} w={L.TOOLS_W} h={L.TOOLS_H} />
        {area === 'tools' && !overlay && (
          <>
            <Pic src="SourceBrowser/option_tool_hi.bmp" x={L.TOOLS_X} y={L.TOOLS_Y} w={L.TOOLS_W} h={L.TOOLS_H} />
            <Balloon x={L.TOOLS_X + L.TOOLS_W / 2} y={L.BALLOON_ARROW_Y} text={TOOLS_BALLOON_TEXT} />
          </>
        )}
        <SourceList list={list} focus={focus} scroll={scroll} focused={listFocused} checkIdx={area === 'tools' || overlay ? checkIdx : -1} current={source} />
      </div>
      {overlay?.kind === 'popup' && (
        <ToolsPopup
          items={overlay.items}
          onClose={how => {
            if (how === 'app') hide()
            else {
              setOverlay(null)
              setArea('list')
              setCheckIdx(-1)
            }
          }}
          onSelect={id => {
            const idx = overlay.itemIdx
            if (id === 0) setOverlay({ kind: 'editname', itemIdx: idx })
            else if (id === 1) setOverlay({ kind: 'info', itemIdx: idx })
            else if (id === 7) {
              // RunApp(0x3e, 0x6e) from CSourceApp::t_OnEvent 0x20 (inferred: the Menu's Anynet+ page).
              setOverlay(null)
              hide()
              setTimeout(() => openMenuAnynet(), L.ANI_HIDE_MS)
            }
          }}
          onKey={resetTimeout}
        />
      )}
      {overlay?.kind === 'msg' && (
        <MessageBox text={overlay.text} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'editname' && (
        <EditNameWindow
          inputId={list[overlay.itemIdx].id}
          title={list[overlay.itemIdx].type}
          onClose={() => {
            setOverlay(null)
            setArea('list')
            setCheckIdx(-1)
          }}
        />
      )}
      {overlay?.kind === 'info' && (
        <InfoWindow
          inputId={list[overlay.itemIdx].id}
          onClose={() => {
            setOverlay(null)
            setArea('list')
            setCheckIdx(-1)
          }}
        />
      )}
    </div>
  )
}

function openMenuAnynet() {
  openApp('menu', { page: 'Anynet+ (HDMI-CEC)', from: 'source' })
}

function isNavKey(k: RemoteKey) {
  return k === 'Up' || k === 'Down' || k === 'Left' || k === 'Right' || k === 'Enter' || k === 'Back' || k === 'Exit' || k === 'Tools' || k === 'Source'
}

// The list shows SOURCE_WND_W - margins = 1800 px = 6 items; it scrolls so the focus stays visible.
function clampScroll(focus: number, scroll: number, n: number) {
  const vis = L.VISIBLE
  let s = scroll
  if (focus < s) s = focus
  if (focus >= s + vis) s = focus - vis + 1
  return Math.max(0, Math.min(s, Math.max(0, n - vis)))
}

// CSourceListDataRenderer::Draw: icon, source type, device name, check mark per item.
function SourceList({ list, focus, scroll, focused, checkIdx, current }: {
  list: Item[]
  focus: number
  scroll: number
  focused: boolean
  checkIdx: number
  current: string
}) {
  const ox0 = L.LIST_MARGIN_LEFT
  return (
    <>
      <div style={{ position: 'absolute', left: ox0, top: 0, width: L.WND_W - L.LIST_MARGIN_LEFT - L.LIST_MARGIN_RIGHT, height: L.WND_H, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateX(${-scroll * L.ITEM_W}px)`, transition: `transform ${L.SCROLL_MS}ms ease-out` }}>
          {focused && (
            <Nine src="SourceBrowser/list_highlight.bmp"
              x={focus * L.ITEM_W + L.FOCUS_DX} y={L.LIST_MARGIN_TOP + L.FOCUS_DY} w={L.FOCUS_W} h={L.FOCUS_H}
              t={L.FOCUS_SLICE} r={L.FOCUS_SLICE} b={L.FOCUS_SLICE} l={L.FOCUS_SLICE} />
          )}
          {list.map((it, i) => (
            <SourceItem key={it.id} it={it} x={i * L.ITEM_W} y={L.LIST_MARGIN_TOP}
              focused={focused && i === focus} check={i === checkIdx} current={it.id === current} />
          ))}
        </div>
      </div>
      {scroll > 0 && <Pic src="SourceBrowser/indi_arrow_left_n.bmp" x={L.ARROW_LEFT_X} y={L.ARROW_Y} w={40 * 1.5} h={53 * 1.5} />}
      {scroll + L.VISIBLE < list.length && <Pic src="SourceBrowser/indi_arrow_right_n.bmp" x={L.ARROW_RIGHT_X} y={L.ARROW_Y} w={40 * 1.5} h={53 * 1.5} />}
    </>
  )
}

function SourceItem({ it, x, y, focused, check, current }: {
  it: Item
  x: number
  y: number
  focused: boolean
  check: boolean
  current: boolean
}) {
  // t_DrawIcon: a disconnected input shows its normal icon at alpha 0x42; a connected one the focused
  // or normal icon at full alpha.
  const iconSrc = `SourceBrowser/${it.icon}_${it.connected && focused ? 'f' : 'n'}.bmp`
  const iconAlpha = it.connected ? 1 : 0x42 / 255
  // t_DrawDeviceType / t_DrawDeviceName colours.
  let color: string
  if (current) color = rgb(...L.COLOR_CURRENT)
  else if (!it.connected) color = rgb(...L.COLOR_DIM)
  else if (focused) color = rgb(...L.COLOR_FOCUS)
  else color = rgb(...L.COLOR_NORMAL)
  const name = deviceName(it.id)
  const icon = L.ICON_IMG * 1.5
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: L.ITEM_W, height: L.ITEM_H }}>
      <Pic src={iconSrc} x={L.ICON_X + (L.ICON_W - icon) / 2} y={L.ICON_Y + (L.ICON_H - icon) / 2} w={icon} h={icon} style={{ opacity: iconAlpha }} />
      {check && it.connected && (
        <Pic src="SourceBrowser/list_check_icon.bmp" x={L.CHECK_X + (L.CHECK_W - 48) / 2} y={L.CHECK_Y + (L.CHECK_H - 48) / 2} w={48} h={48} />
      )}
      <Text x={L.TYPE_X} y={L.TYPE_Y} w={L.TYPE_W} h={L.TYPE_H} size={L.TYPE_FONT} color={color} h_align={1}>{it.type}</Text>
      {name && (
        <Text x={L.NAME_X} y={L.NAME_Y} w={L.NAME_W} h={L.NAME_H} size={L.NAME_FONT} color={color} h_align={1}>{name}</Text>
      )}
    </div>
  )
}

// CWordBalloon with a top arrow (text_balloon_top_arrow over text_balloon_basic), black text.
function Balloon({ x, y, text }: { x: number; y: number; text: string }) {
  const textW = Math.ceil(text.length * L.BALLOON_FONT * 0.5) // (inferred) width estimate for the box
  const w = textW + 2 * L.BALLOON_TEXT_OFFSET
  const h = 38 * 1.5
  let bx = x - w / 2
  if (bx + w > L.BALLOON_MAX_X) bx = L.BALLOON_MAX_X - w
  const ah = 10 * 1.5
  return (
    <>
      <Nine src="Common/text_balloon_basic.bmp" x={bx} y={y + ah - 3} w={w} h={h} t={18} r={18} b={18} l={18} />
      <Pic src="Common/text_balloon_top_arrow.bmp" x={x - 7 * 1.5} y={y} w={14 * 1.5} h={ah} />
      <Text x={bx} y={y + ah - 3} w={w} h={h} size={L.BALLOON_FONT} color="#000" h_align={1}>{text}</Text>
    </>
  )
}
