import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { OSD } from './osd'
import { currentPin, PIN_TEXT, transparencyAlpha, type AWProps } from './kit'
import { IMG } from './parts'
import type { MenuItem } from './types'
import { getValue, setValue } from './values'

// Widgets and action windows the Menu opens for an item.
//  popup      CPopUpWidget sublist inside the Menu (CMenuMainWidgetAgency, widget type 1)
//  sublistAW  CSublistActionWindowBase: Menu hidden, item title + sublist at the bottom
//  sliderAW   CSliderActionWindowBase: Menu hidden, slider bar with previous/next item labels
//  bar        CControlBar inside the Menu (widget type 3: DTV Audio Level, Audio Delay ...)
//  msg        CMessageBox sequence (resets, confirmations, the dim reason)
//  pin        CPinNumberWidget, then the item's action
export type Widget =
  | { kind: 'popup'; item: MenuItem }
  | { kind: 'sublistAW'; item: MenuItem }
  | { kind: 'sliderAW'; item: MenuItem; items: MenuItem[] }
  | { kind: 'bar'; item: MenuItem }
  | { kind: 'msg'; item?: MenuItem; boxes: MsgBox[] }
  | { kind: 'pin'; item: MenuItem; text?: string; then: () => Widget | null | void }
  | { kind: 'custom'; item?: MenuItem; hideMenu?: boolean; render: (p: AWProps) => ReactNode }

export type MsgBox = {
  text: string
  buttons?: string[]              // none = auto-close box
  onButton?: (index: number) => Widget | null | void  // next widget (another box) or null to close
  timeout?: number
  icon?: string                   // CMessageBox::SetMsgIcon at MENU_MSG_BOX_ICON (40,30)
}

type Props = {
  widget: Widget
  level: number
  row: number                     // visible row of the item in its list (CMenuMainWidgetAgency +0x1c)
  onClose: () => void
  onExitMenu: () => void
  onChange: (w: Widget | null) => void
  onValue: () => void
}

export function Widgets(props: Props) {
  const { widget } = props
  switch (widget.kind) {
    case 'popup':
      return <Popup {...props} item={widget.item} />
    case 'sublistAW':
      return <SublistActionWindow {...props} item={widget.item} />
    case 'sliderAW':
      return <SliderActionWindow {...props} item={widget.item} items={widget.items} />
    case 'bar':
      return <MenuControlBar {...props} item={widget.item} />
    case 'msg':
      return <MessageBoxes {...props} boxes={widget.boxes} />
    case 'pin':
      return <PinWidget {...props} then={widget.then} />
    case 'custom':
      return <>{widget.render({ close: props.onClose, exitMenu: props.onExitMenu, change: props.onChange })}</>
  }
}

// ---------------------------------------------------------------------------------------------
// CPopUpWidget (AppMWOSDInfo; m_CreateBackgroundImage @01927db8): opaque SUB_POPUP_BG_ALPHA_COLOR #222d3b
// rectangle under the sub_popup_bg frame, act_popup_shadow around; 325 wide, height by item count, 48 px items with 22 px list margins,
// list_highlight focus (320x85), list_check_icon on the current value, text at x 64.

const POPUP_H = [0, 128, 162, 210, 258, 306, 354, 402]
const POPUP_W = 325
const SHADOW = 21

function PopupList({ options, current, focus, x, y }: { options: [number, string, boolean][]; current: number; focus: number; x: number; y: number }) {
  const n = Math.min(7, options.length)
  const h = POPUP_H[n]
  const top = Math.max(0, Math.min(focus - n + 1, options.length - n, focus))
  const first = focus >= top + n ? focus - n + 1 : top
  const shown = options.slice(first, first + n)
  return (
    <div className="m13-popup" style={{ left: x, top: y, width: POPUP_W, height: h }}>
      <div className="m13-popup-shadow" style={{ width: POPUP_W, height: h }} />
      <div className="m13-popup-fill" style={{ left: SHADOW / 2 | 0, top: SHADOW / 2 | 0, width: POPUP_W - SHADOW, height: h - SHADOW }} />
      <div className="m13-popup-bg" style={{ left: SHADOW / 2 | 0, top: SHADOW / 2 | 0, width: POPUP_W - SHADOW, height: h - SHADOW }} />
      <div className="m13-popup-list" style={{ left: SHADOW / 2 | 0, top: SHADOW / 2 | 0, width: POPUP_W - SHADOW, height: h - SHADOW }}>
        {shown.map(([v, t, en], i) => {
          const idx = first + i
          const f = idx === focus
          return (
            <div key={v + ':' + idx} className="m13-popup-item" style={{ top: 22 + i * 48 }}>
              {f && <div className="m13-popup-focus" style={{ top: (48 - 85) / 2, width: 320 - SHADOW + 16 }} />}
              {v === current && <img className="m13-popup-check" src={`${IMG}/list_check_icon.png`} alt="" />}
              <div className="m13-popup-text" style={{ color: f && en ? '#fdd911' : '#fff', opacity: en ? 1 : 102 / 255 }}>{t}</div>
            </div>
          )
        })}
        {first > 0 && <img className="m13-popup-arrow" src={`${IMG}/cm_act_arrow_up_nor.png`} style={{ left: (POPUP_W - SHADOW - 42) / 2, top: 0 }} alt="" />}
        {first + n < options.length && (
          <img className="m13-popup-arrow" src={`${IMG}/cm_act_arrow_down_nor.png`} style={{ left: (POPUP_W - SHADOW - 42) / 2, top: h - SHADOW - 26 - 22 + 8 }} alt="" />
        )}
      </div>
    </div>
  )
}

function useListKeys(n: number, start: number, enabled: (i: number) => boolean, onMove?: (i: number) => void) {
  const [focus, setFocus] = useState(start)
  const move = (d: number) => {
    let i = focus + d
    while (i >= 0 && i < n && !enabled(i)) i += d
    if (i < 0 || i >= n) return
    setFocus(i)
    playUi(UI_SOUND.MOVE)
    onMove?.(i)
  }
  return { focus, move }
}

function Popup({ item, row, onClose, onExitMenu, onValue }: Props & { item: MenuItem }) {
  const opts = (item.o ?? []).map(([v, t]) => [v, t, true] as [number, string, boolean])
  const cur = getValue(item)
  const start = Math.max(0, opts.findIndex(o => o[0] === cur))
  const { focus, move } = useListKeys(opts.length, start, i => opts[i][2])
  useRemote((k: RemoteKey) => {
    if (k === 'Up' || k === 'Down') move(k === 'Up' ? -1 : 1)
    else if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      // Device Name > User Input opens the on-screen keyboard (not built): the name stays
      if (!(item.id === 0x51 && opts[focus][1] === 'User Input')) setValue(item, opts[focus][0])
      onValue()
      onClose()
    } else if (k === 'Left' || k === 'Back') onClose()
    else if (k === 'Exit' || k === 'Settings') onExitMenu()
    else return k !== 'Home'
    return true
  })
  // CMenuMainWidgetAgency::t_AdjustSublistPosition: right edge at MENU_MAIN_ITEM_RIGHT_EDGE_X (720),
  // top at row * 53 + MENU_MAIN_SUBLIST_Y (66), kept above the back panel bottom (528 - 9).
  const n = Math.min(7, opts.length)
  const h = POPUP_H[n]
  const y = Math.min(OSD.ITEM_H * row + 66, OSD.PANEL_H - 9 - h)
  return <PopupList options={opts} current={cur} focus={focus} x={720 - POPUP_W} y={y} />
}

// ---------------------------------------------------------------------------------------------
// Action windows draw in screen space. Window rects from MenuOSDInfo: x = 640 + X; y = 720 + Y
// (the Y constants are negative distances from the screen bottom; inferred, see spec).

function screenRect(x: number, y: number) {
  return { left: 640 + x, top: 720 + y }
}

function SublistActionWindow({ item, onClose, onExitMenu, onValue }: Props & { item: MenuItem }) {
  const opts = (item.o ?? []).map(([v, t]) => [v, t, true] as [number, string, boolean])
  const orig = useRef(getValue(item))
  const start = Math.max(0, opts.findIndex(o => o[0] === orig.current))
  // the list previews each entry while it has the focus (t_PreviewSublist); Return restores
  const { focus, move } = useListKeys(opts.length, start, () => true, i => {
    setValue(item, opts[i][0])
    onValue()
  })
  useRemote((k: RemoteKey) => {
    if (k === 'Up' || k === 'Down') move(k === 'Up' ? -1 : 1)
    else if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      setValue(item, opts[focus][0])
      onValue()
      onClose()
    } else if (k === 'Back' || k === 'Left') {
      setValue(item, orig.current)
      onValue()
      onClose()
    } else if (k === 'Exit' || k === 'Settings') {
      setValue(item, opts[focus][0])
      onExitMenu()
    } else return k !== 'Home'
    return true
  })
  const W = 805, H = 413
  const n = Math.min(7, opts.length)
  const ph = POPUP_H[n]
  const pos = screenRect(-402, -453)
  return (
    <div className="m13-aw" style={{ ...pos, width: W, height: H }}>
      <div className="m13-aw-bar" style={{ top: 339, width: W, height: 74 }} />
      <div className="m13-aw-title" style={{ left: 50, top: 339, width: 346, height: 74, fontSize: 26 }}>{item.t}</div>
      <PopupList options={opts} current={orig.current} focus={focus} x={W - POPUP_W} y={H - 5 - ph} />
    </div>
  )
}

// CControlBar: slider control (thumb control_progress_box_highlight 88x56) between left/right arrow
// buttons, track control_progress(_bg) with 16 px inner margins, value balloon above the thumb.
function ControlBar({ item, value, w, h }: { item: MenuItem; value: number; w: number; h: number }) {
  const [min, max] = item.v ?? [0, 100]
  const margin = 40
  const sw = w - 2 * margin
  const thumbW = 88, thumbH = 56
  const pathX = 1 + thumbW / 2
  const pathLen = sw - thumbW - 2
  const f = max > min ? (value - min) / (max - min) : 0
  const tx = pathX + Math.round(pathLen * f)
  const sy = (h - thumbH) / 2
  const text = (min < 0 && value > 0 ? '+' : '') + String(value)
  const bw = Math.max(93, 32 + text.length * 14)
  return (
    <div className="m13-cbar" style={{ width: w, height: h }}>
      <img className="m13-cbar-arrow" src={`${IMG}/subpopup_arrow_left.png`} style={{ left: 13 + (42 - 21) / 2, top: (h - 26) / 2 }} alt="" />
      <img className="m13-cbar-arrow" src={`${IMG}/subpopup_arrow_right.png`} style={{ left: w - 42 - 13 + (42 - 21) / 2, top: (h - 26) / 2 }} alt="" />
      <div className="m13-cbar-slider" style={{ left: margin, top: sy, width: sw, height: thumbH }}>
        <div className="m13-cbar-track" style={{ left: 16, top: (thumbH - 8) / 2, width: sw - 32 }} />
        <div className="m13-cbar-fill" style={{ left: 16, top: (thumbH - 8) / 2, width: Math.max(0, tx - 16) }} />
        <img className="m13-cbar-thumb" src={`${IMG}/control_progress_box_highlight.png`} style={{ left: tx - thumbW / 2, top: 0 }} alt="" />
        <div className="m13-cbar-balloon" style={{ left: tx - bw / 2, top: thumbH / 2 - 61 - 10, width: bw }}>
          <div className="m13-cbar-balloon-bg" />
          <img src={`${IMG}/progress_balloon_arrow.png`} style={{ position: 'absolute', left: (bw - 18) / 2, top: 42 }} alt="" />
          <div className="m13-cbar-balloon-text">{text}</div>
        </div>
      </div>
    </div>
  )
}

function stepValue(it: MenuItem, v: number, d: number) {
  const [min, max, step] = it.v ?? [0, 100, 1]
  return Math.max(min, Math.min(max, v + d * (step || 1)))
}

function SliderActionWindow({ item, items, onClose, onExitMenu, onValue }: Props & { item: MenuItem; items: MenuItem[] }) {
  const [cur, setCur] = useState(item)
  const [, force] = useState(0)
  const idx = items.indexOf(cur)
  const prev = idx > 0 ? items[idx - 1] : undefined
  const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : undefined
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const arm = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(onClose, 30000)   // (inferred) slider action window auto-hide
  }
  useEffect(() => {
    arm()
    return () => clearTimeout(timer.current)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useRemote((k: RemoteKey) => {
    arm()
    if (k === 'Left' || k === 'Right') {
      const v = getValue(cur)
      const nv = stepValue(cur, v, k === 'Left' ? -1 : 1)
      if (nv !== v) {
        setValue(cur, nv)
        playUi(UI_SOUND.MOVE)
        onValue()
        force(x => x + 1)
      }
    } else if (k === 'Up' && prev) {
      setCur(prev)
      playUi(UI_SOUND.MOVE)
    } else if (k === 'Down' && next) {
      setCur(next)
      playUi(UI_SOUND.MOVE)
    } else if (k === 'Enter' || k === 'Back') {
      if (k === 'Enter') playUi(UI_SOUND.SELECT)
      onClose()
    } else if (k === 'Exit' || k === 'Settings') onExitMenu()
    else return k !== 'Home'
    return true
  })
  const W = 805
  const pos = screenRect(-402, -218)
  return (
    <div className="m13-aw" style={{ ...pos, width: W, height: 181 }}>
      {prev && (
        <div className="m13-slider-sub m13-slider-sub--up" style={{ left: 8, top: 2, width: 789, height: 53 }}>
          <img src={`${IMG}/act_arrow_up_nor.png`} style={{ position: 'absolute', left: 29, top: 21 }} alt="" />
          <div className="m13-slider-subname" style={{ left: 80, top: 10, width: 738 - 80, height: 42 }}>{prev.t}</div>
        </div>
      )}
      {next && (
        <div className="m13-slider-sub m13-slider-sub--down" style={{ left: 8, top: 53 + 74 - 2, width: 789, height: 53 }}>
          <img src={`${IMG}/act_arrow_down_nor.png`} style={{ position: 'absolute', left: 29, top: 2 }} alt="" />
          <div className="m13-slider-subname" style={{ left: 80, top: 0, width: 738 - 80, height: 42 }}>{next.t}</div>
        </div>
      )}
      <div className="m13-aw-bar" style={{ top: 53, width: W, height: 74 }} />
      <div className="m13-aw-title" style={{ left: 86, top: 53, width: 317, height: 74, fontSize: 26 }}>{cur.t}</div>
      <div style={{ position: 'absolute', left: 365, top: 53 }}>
        <ControlBar item={cur} value={getValue(cur)} w={432} h={74} />
      </div>
    </div>
  )
}

// In-menu control bar (MENU_CONTROLBAR 336x80; CMenuMainWidgetAgency::t_AdjustControlBarPosition:
// right-aligned to 720, top at row * 53 + MENU_MAIN_CONTROLBAR_Y 50), on a black ALPHA_WIDGET box.
function MenuControlBar({ item, row, onClose, onExitMenu, onValue }: Props & { item: MenuItem }) {
  const [, force] = useState(0)
  useRemote((k: RemoteKey) => {
    if (k === 'Left' || k === 'Right') {
      const v = getValue(item)
      const nv = stepValue(item, v, k === 'Left' ? -1 : 1)
      if (nv !== v) {
        setValue(item, nv)
        playUi(UI_SOUND.MOVE)
        onValue()
        force(x => x + 1)
      }
    } else if (k === 'Enter' || k === 'Back' || k === 'Up' || k === 'Down') onClose()
    else if (k === 'Exit' || k === 'Settings') onExitMenu()
    else return k !== 'Home'
    return true
  })
  const y = Math.min(OSD.ITEM_H * row + 50, OSD.PANEL_H - 9 - 80)
  return (
    <div className="m13-menubar" style={{ left: 720 - 336, top: y, width: 336, height: 80 }}>
      <div className="m13-menubar-bg" />
      <ControlBar item={item} value={getValue(item)} w={336} h={80} />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// CMessageBox (AppMWOSDInfo): 544 wide; height and text top by row count (with buttons:
// 197 px up to 3 rows, + 37 per row beyond; without: 149, + 32 per row beyond 3); buttons 176x53,
// 13 px from the bottom, 5 px apart; centred on the screen.

export function MessageBox({ box, focus, bottom }: { box: MsgBox; focus: number; bottom?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (el) setRows(Math.max(1, Math.round(el.scrollHeight / (24 + 9))))
  }, [box.text])
  const btns = box.buttons ?? []
  const W = 544
  let H: number, Y: number
  if (!btns.length) {
    H = rows <= 3 ? 149 : 32 * (rows - 3) + 149
    Y = rows === 1 ? 58 : rows === 2 ? 42 : 26
  } else if (rows < 4) {
    H = 197
    Y = rows === 1 ? 60 : rows === 2 ? 38 : 21
  } else {
    H = 37 * (rows - 2) + 160
    Y = 21
  }
  const bw = 176, gap = 5
  const total = btns.length * bw + (btns.length - 1) * gap
  return (
    <div className="m13-msg" style={{ left: (1280 - W) / 2, top: bottom === undefined ? (720 - H) / 2 : 720 - H - bottom, width: W, height: H }}>
      <div className="m13-msg-shadow" style={{ left: -10, top: -10, width: W + 21, height: H + 21 }} />
      <div className="m13-msg-alpha" style={{ opacity: transparencyAlpha() }} />
      <div className="m13-msg-bg" />
      {box.icon && <img src={box.icon} style={{ position: 'absolute', left: 40, top: 30 }} alt="" />}
      <div ref={ref} className="m13-msg-text" style={{ top: Y, textAlign: rows > 1 ? 'left' : 'center' }}>{box.text}</div>
      {btns.map((b, i) => (
        <div key={i} className={`m13-btn${i === focus ? ' m13-btn--focus' : ''}`} style={{ left: (W - total) / 2 + i * (bw + gap), top: H - 13 - 53, width: bw, height: 53 }}>
          <span>{b}</span>
        </div>
      ))}
    </div>
  )
}

function MessageBoxes({ boxes, onClose, onExitMenu, onChange }: Props & { boxes: MsgBox[] }) {
  const [i, setI] = useState(0)
  const [focus, setFocus] = useState(0)
  const box = boxes[i]
  const advance = (btn: number) => {
    const next = box.onButton?.(btn)
    if (next) return onChange(next)
    if (i + 1 < boxes.length && next !== null) {
      setI(i + 1)
      setFocus(0)
    } else onClose()
  }
  useEffect(() => {
    if (box && !box.buttons?.length) {
      const t = setTimeout(() => advance(-1), box.timeout ?? 3000)
      return () => clearTimeout(t)
    }
  }, [i])  // eslint-disable-line react-hooks/exhaustive-deps
  useRemote((k: RemoteKey) => {
    const n = box?.buttons?.length ?? 0
    if ((k === 'Left' || k === 'Right') && n > 1) {
      const f = Math.max(0, Math.min(n - 1, focus + (k === 'Left' ? -1 : 1)))
      if (f !== focus) {
        setFocus(f)
        playUi(UI_SOUND.MOVE)
      }
    } else if (k === 'Enter' && n) {
      playUi(UI_SOUND.SELECT)
      advance(focus)
    } else if (k === 'Back') onClose()
    else if (k === 'Exit' || k === 'Settings') onExitMenu()
    else return k !== 'Home'
    return true
  })
  if (!box) return null
  return <MessageBox box={box} focus={focus} />
}

// ---------------------------------------------------------------------------------------------
// CPinNumberWidget as CMenuWindowManager::t_ShowPinNumberWindow @02592bec shows it: no title
// (PINNUMBERWIDGET_NOTITLE_*: 608x336 centred), contents (26,19) 556x128 centre/middle size 24 (M 0x75b,
// or M 0x18 for the country items), four boxes (66 + 117 i, 139) 120x96 (Common/input_box_normal,
// input_box_highlight on the next box, Common/input_character per entered digit), Cancel (216,256)
// 176x53, hidden after 60 s. The TV's PIN is 0000 until changed (menu.pin).


function PinWidget({ widget, onClose, onExitMenu, onChange }: Props & { then: () => Widget | null | void }) {
  const w = widget as Extract<Widget, { kind: 'pin' }>
  const [digits, setDigits] = useState('')
  const [wrong, setWrong] = useState(false)
  useEffect(() => {
    const t = setTimeout(onClose, 60000)
    return () => clearTimeout(t)
  }, [digits])  // eslint-disable-line react-hooks/exhaustive-deps
  useRemote((k: RemoteKey) => {
    if (k.startsWith('Digit')) {
      const d = digits + k.slice(5)
      playUi(UI_SOUND.OSK_KEYPAD)
      if (d.length < 4) setDigits(d)
      else if (d === currentPin()) {
        const next = w.then()
        if (next) onChange(next)
        else onClose()
      } else {
        // (inferred) a wrong PIN clears the boxes and shows M 0x78c in the contents
        setDigits('')
        setWrong(true)
      }
    } else if (k === 'Enter' || k === 'Back') onClose()
    else if (k === 'Exit' || k === 'Settings') onExitMenu()
    else return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown'
    return true
  })
  return <PinBox text={wrong ? 'Incorrect PIN. Please check and try again.' : (w.text ?? PIN_TEXT)} digits={digits.length} />
}

export function PinBox({ text, digits, cancelFocus = true }: { text: string; digits: number; cancelFocus?: boolean }) {
  const W = 608, H = 336
  return (
    <div className="m13-pin" style={{ left: 640 - 304, top: 360 - 168, width: W, height: H }}>
      <div className="m13-msg-shadow" style={{ left: -10, top: -10, width: W + 21, height: H + 21 }} />
      <div className="m13-msg-alpha" style={{ opacity: transparencyAlpha() }} />
      <div className="m13-msg-bg" />
      <div className="m13-pin-text" style={{ left: 26, top: 19, width: 556, height: 128 }}>{text}</div>
      <PinBoxes x={66} y={139} digits={digits} />
      <div className={`m13-btn${cancelFocus && digits >= 4 ? ' m13-btn--focus' : ''}`} style={{ left: 216, top: 256, width: 176, height: 53 }}><span>Cancel</span></div>
    </div>
  )
}

export function PinBoxes({ x, y, digits, active = true }: { x: number; y: number; digits: number; active?: boolean }) {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`m13-pin-box${active && i === digits ? ' m13-pin-box--hl' : ''}`} style={{ left: x + i * 117, top: y, width: 120, height: 96 }}>
          {i < digits && <img src={`${IMG}/input_character.png`} alt="" />}
        </div>
      ))}
    </>
  )
}

