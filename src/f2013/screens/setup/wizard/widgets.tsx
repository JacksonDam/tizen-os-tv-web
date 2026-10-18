import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRemote } from '../../../../input/remote'
import { F13 } from '../../../assets'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { POPUP_INSET, POPUP_ITEM_H, POPUP_MARGIN, POPUP_W, popupHeight, VISIBLE } from './popupGeometry'

// Shared AppMW widgets the setup pages open: the option popup (CPopUpWidget) and the message box
// (CMessageBox). Values are AppMWOSDInfo constants of the 1280x720 OSD, x1.5 on the stage
// (spec/setup.md 2.6, 2.7).

const POP = `${F13}/setup/popup`

// ---- CPopUpWidget ----
// Width POPUPWIDGET_WIDTH 325; height by item count (t_GetSize @019279f8): 128, 162, 210, 258, 306,
// 354, 402 for 1..7 items, then the list scrolls. Shadow AppCM/act_popup_shadow 9-slice over the whole
// box; inside it (inset DEFAULTWND_SHADOW_BG 21/2) a SUB_POPUP_BG_ALPHA_COLOR #222D3B rectangle under
// the AppCM/sub_popup_bg frame (m_CreateBackgroundImage @01927db8). List (m_CreateList @01927ac4):
// item POPUPWIDGET_ITEM_H 48, margins 22 top and bottom, focus Common/list_highlight 9-slice
// 320x85; text at POPUPWIDGET_TEXT_X/Y 64,8 (220x40), check mark at CHECKBOX_X/Y 24,8.
export type PopupProps = {
  items: string[]
  value: number            // the checked item
  left?: number            // stage position of the box (shadow included)
  right?: number
  top: number
  itemH?: number           // some owners size the rows themselves (channel search: 72)
  onPick: (i: number) => void
  onClose: () => void
}

export function Popup({ items, value, left, right, top, itemH = POPUP_ITEM_H, onPick, onClose }: PopupProps) {
  const [focus, setFocus] = useState(Math.max(0, value))
  const [scroll, setScroll] = useState(() => Math.max(0, Math.min(value, items.length - VISIBLE)))
  const rows = Math.min(items.length, VISIBLE)
  const h = itemH === POPUP_ITEM_H ? popupHeight(items.length) : rows * itemH + 2 * POPUP_MARGIN + 2 * POPUP_INSET

  useRemote(key => {
    if (key === 'Up' || key === 'Down') {
      const f = key === 'Up' ? focus - 1 : focus + 1
      if (f < 0 || f >= items.length) return true
      setFocus(f)
      if (f < scroll) setScroll(f)
      else if (f >= scroll + VISIBLE) setScroll(f - VISIBLE + 1)
      playUi(UI_SOUND.MOVE)
      return true
    }
    if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      onPick(focus)
      return true
    }
    if (key === 'Back' || key === 'Left') {
      onClose()
      return true
    }
    return true
  })

  const box: CSSProperties = { top, height: h, width: POPUP_W }
  if (right !== undefined) box.right = right
  else box.left = left
  return (
    <div className="pop" style={box}>
      <div className="pop__inner">
        {items.length > VISIBLE && scroll > 0 && <img className="pop__arrow pop__arrow--up" src={`${POP}/act_arrow_up_nor.png`} alt="" />}
        {items.slice(scroll, scroll + VISIBLE).map((t, k) => {
          const i = scroll + k
          return (
            <div key={i} className={`pop__item${i === focus ? ' pop__item--focus' : ''}`} style={{ top: POPUP_MARGIN + k * itemH, height: itemH }}>
              {i === focus && <div className="pop__focus" style={{ top: (itemH - 127.5) / 2 }} />}
              {i === value && <img className="pop__check" src={`${POP}/list_check_icon.png`} alt="" />}
              <span className="pop__text">{t}</span>
            </div>
          )
        })}
        {items.length > VISIBLE && scroll + VISIBLE < items.length && (
          <img className="pop__arrow pop__arrow--down" src={`${POP}/act_arrow_down_nor.png`} alt="" />
        )}
      </div>
    </div>
  )
}

// ---- CMessageBox ----
// MESSAGEBOX_BG_W 544; with buttons and up to 3 rows the height is BUTTON_1LINE_BG_H 160 +
// BUTTON_1LINE_GAP 37, text top at 1LINE/2LINE/3LINE_TEXT_Y 60/38/21 (t_AutoArrange @018f203c);
// text COMMON_FONT_SIZE_18 (24) white, centred, row gap 9, 60 px side gaps (t_MoveTextDrawing);
// buttons 176x53 Common/btn_normal / btn_focused, white text 24, BUTTON_BOTTOM_GAP 13
// (m_CreateButton @018f0988, m_ArrangeButton @018f1c8c); box centred on the screen; black fill at the
// OSD transparency (m_CreateAlphaDrawing: BG_ALPHA_COLOR, GetOSDTransparency) under the
// AppCM/message_popup_bg frame, AppCM/act_popup_shadow around it (m_CreateShadowBGImage).
export type MessageBoxProps = {
  text: string
  buttons: string[]
  focus?: number
  timeoutMs?: number
  onButton: (i: number) => void   // -1 = RETURN / timeout
}

export function MessageBox({ text, buttons, focus: initial = 0, timeoutMs, onButton }: MessageBoxProps) {
  const [focus, setFocus] = useState(initial)
  const textRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState(1)
  const done = useRef(onButton)
  done.current = onButton

  useEffect(() => {
    const el = textRef.current
    if (el) setLines(Math.max(1, Math.round(el.scrollHeight / 49.5)))
  }, [text])
  useEffect(() => {
    if (!timeoutMs) return
    const t = setTimeout(() => done.current(-1), timeoutMs)
    return () => clearTimeout(t)
  }, [timeoutMs, focus])

  useRemote(key => {
    if (key === 'Left' || key === 'Right') {
      const f = key === 'Left' ? focus - 1 : focus + 1
      if (f >= 0 && f < buttons.length) {
        setFocus(f)
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      onButton(focus)
      return true
    }
    if (key === 'Back' || key === 'Exit') {
      onButton(-1)
      return true
    }
    return true
  })

  const h = (lines <= 3 ? 160 + 37 : 160 + 37 * (lines - 2)) * 1.5
  const textY = (lines === 1 ? 60 : lines === 2 ? 38 : 21) * 1.5
  const bw = 176 * 1.5
  const gap = 5 * 1.5
  const total = buttons.length * bw + (buttons.length - 1) * gap
  return (
    <div className="msg" style={{ height: h, top: (1080 - h) / 2 }}>
      <div className="msg__fill" />
      <div ref={textRef} className="msg__text" style={{ top: textY }}>
        {text}
      </div>
      {buttons.map((b, i) => (
        <div
          key={i}
          className={`msg__btn${i === focus ? ' msg__btn--focus' : ''}`}
          style={{ left: (816 - total) / 2 + i * (bw + gap), top: h - 19.5 - 79.5 }}
        >
          {b}
        </div>
      ))}
    </div>
  )
}
