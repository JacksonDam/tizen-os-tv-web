import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { setTextCapture, useRemote, type RemoteKey } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { MessageBox } from '../setup/wizard/widgets'
import { NET_IMG } from './data'
import './net.css'

// The 2013 on-screen keyboard (exeDSP CIMEWidget in OSK mode, AppMWOSDInfo OSK_* constants of the
// 1280x720 OSD; drawn x1.5 by .n13-osd). Built for the network app's security key entry
// (CNetworkIMEWindow::Create @02f04de0: title N 0x28 "Security Key", guide N 0x75, max 64, Done
// dimmed until more than 7 characters). Layout:
//  - the whole screen behind dims (OSK_DARK_BG_ALPHA_COLOR 0xE5000000)
//  - input window: full width, OSK_1LINE_INPUT_WINDOW_BG_H 106 + shadow 2 above the keypad, AppCM/
//    ime_up_bg 9-slice (t_UpdateInputWinBg @019375c4); description at (72,8) (title " : " guide, the
//    format the footage shows for Samsung Account: "Email : Enter your Samsung Account ID."), count
//    "n / max" right-aligned in (1078,8) 133 wide; input box AppCM/ime_input_box at (57,34) 932x72
//    (OSK_INPUT_BOX_WITH_BTN_W), text at +24,+22 size 26; Done button (t_CreateInputDoneBtn @01938d40)
//    at (993,41) 226x53, AppCM btn_normal / btn_focused / btn_dim, "Done" (C 0xb1) size 24
//  - keypad window OSK_BLACKAREA_Y 418, 301 high (t_CreateKeypadBtn @01934030): a 5 x 15 key table
//    (t_InitKey @01933e5c, table @04bf9808), column 0 at OSK_NORMALKEY_X 69 and 133 wide
//    (OSK_MIDIUM_KEY_W), column c at c * 72 + 141, row r at r * 56 + 16, keys 61 x 48; Clear, Delete,
//    Settings, 0x39-0x3b span two columns (133), Space four (277); AppCM/ime_btn_general (letters and
//    symbols), ime_btn_number (digits), ime_btn_function (the rest), 3-slice 10/2/10; labels size 33
//    (OSK_FONTSIZE_NORMAL_KEY) or 21 (OSK_FONTSIZE_SPECIAL_KEY); focus AppCM/ime_highlight 9-slice
//    around the key (OSK_HIGHLITEKEY_GAP -12 / +24). Every key plays UI sound 11 (SetAudioParam).
// Key texts: table @04bf9934 (letters), @04bf99e8 (the 123#& page). The keys the footage (EhQ9pDtWV4M
// 3:29) shows blank stay hidden: 0x32 (language, two rows), 0x37, 0x38, 0x39, 0x3a (the custom function
// key: the mocked access points offer no WPS PIN, so SetIMECustomFunctionKey is never called).

const IMG = `${NET_IMG}/ime`

// key codes 0..44 -> text (lower case page, then the symbol page)
const LOWER = 'qwertyuiopasdfghjklzxcvbnm0123456789^*~?!.,@-'.split('')
const SYMBOL = ['!', '@', '#', '$', '/', '^', '&', '*', '(', ')', "'", '"', ':', ';', ',', '?', '<', '>', '{', '-', '+', 'x', '÷', '=', '%', '\\',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '[', ']', '}', '¥', '≫', '£', '€', '≪', '¢']

const E = 0x42 // empty cell (covered by a wider key)
const GRID: number[][] = [
  [0x2f, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x1a, 0x2e, E, 0x2d, E],
  [0x30, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x24, 0x25, 0x39, E],
  [0x34, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x26, 0x2b, 0x28, 0x3a, E],
  [0x32, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x2a, 0x29, 0x27, 0x2c, 0x37, 0x3b, E],
  [E, 0x33, E, 0x31, E, E, E, 0x3c, 0x3d, 0x3e, 0x35, 0x36, 0x38, 0x3f, 0x40],
]
const HIDDEN = new Set([0x32, 0x37, 0x38, 0x39, 0x3a])
const K = {
  CLEAR: 0x2d, DELETE: 0x2e, CAPS: 0x2f, SHIFT: 0x30, SPACE: 0x31, SETTINGS: 0x33, SYMBOLS: 0x34,
  LEFT: 0x35, RIGHT: 0x36, CANCEL: 0x3b, WWW: 0x3c, COM: 0x3d, SLASH: 0x3e, HOME: 0x3f, END: 0x40,
}
// AppMWOSDInfo (1280 OSD)
const X0 = 69, COL = 72, ROW = 56, Y0 = 16, KW = 61, KH = 48, MID = 133
const PAD_Y = 418, PAD_H = 301
const WIN_H = 106 + 2
const WIN_Y = PAD_Y - WIN_H

function keyX(c: number) {
  return c === 0 ? X0 : c * COL + (MID + X0 - KW)
}
function keyW(code: number, c: number) {
  if (code === K.SPACE) return COL * 3 + KW
  if (code === K.CLEAR || code === K.DELETE || code === K.SETTINGS || code === 0x39 || code === 0x3a || code === K.CANCEL) return COL + KW
  return c === 0 ? MID : KW
}

type Cell = { r: number; c: number }
function cellsOf(code: number): Cell[] {
  const out: Cell[] = []
  GRID.forEach((row, r) => row.forEach((k, c) => k === code && out.push({ r, c })))
  return out
}
// the key a grid cell belongs to (a wide key covers the empty cells to its right)
function keyAt(r: number, c: number): number | null {
  if (r < 0 || r >= GRID.length || c < 0 || c >= 15) return null
  let k = GRID[r][c]
  let cc = c
  while (k === E && cc > 0) k = GRID[r][--cc]
  if (k === E || HIDDEN.has(k)) return null
  const w = keyW(k, cc)
  return keyX(cc) + w > keyX(c) ? k : null
}

export type OskProps = {
  title: string
  guide: string
  password?: boolean
  max: number
  min?: number            // Done stays dimmed below this length (SetDoneButtonDimFlag / SetCompareTextLength)
  onDone: (text: string) => void
  onCancel: () => void
}

export function Osk({ title, guide, password, max, min = 1, onDone, onCancel }: OskProps) {
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState(0)
  const [focus, setFocus] = useState<Cell | 'done'>({ r: 1, c: 1 })  // (inferred) the focus starts on q
  const [caps, setCaps] = useState(false)
  const [shift, setShift] = useState(false)
  const [symbols, setSymbols] = useState(false)
  const [reveal, setReveal] = useState(-1)        // the last typed character shows for a moment
  const [confirm, setConfirm] = useState(false)
  const anchor = useRef(1)
  const doneOn = text.length >= min

  const insert = (s: string) => {
    if (text.length + s.length > max) return false
    const t = text.slice(0, cursor) + s + text.slice(cursor)
    setText(t)
    setCursor(cursor + s.length)
    setReveal(cursor + s.length - 1)
    return true
  }
  const del = () => {
    if (cursor === 0) return
    setText(text.slice(0, cursor - 1) + text.slice(cursor))
    setCursor(cursor - 1)
    setReveal(-1)
  }
  // t_OnPasswordShowAlarm: the typed character is masked again after a moment (1 s, inferred)
  useEffect(() => {
    if (reveal < 0) return
    const t = setTimeout(() => setReveal(-1), 1000)
    return () => clearTimeout(t)
  }, [reveal, text])

  const charOf = (code: number) => {
    const ch = (symbols ? SYMBOL : LOWER)[code]
    return !symbols && code < 26 && (caps !== shift) ? ch.toUpperCase() : ch
  }

  const press = (code: number) => {
    if (code < 0x2d) {
      if (insert(charOf(code))) playUi(UI_SOUND.OSK_KEYPAD)
      if (shift) setShift(false)
      return
    }
    switch (code) {
      case K.SPACE: insert(' '); playUi(UI_SOUND.OSK_SPACE); return
      case K.DELETE: del(); playUi(UI_SOUND.OSK_BACKSPACE); return
      case K.CLEAR: setText(''); setCursor(0); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.CAPS: setCaps(c => !c); setShift(false); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.SHIFT: setShift(s => !s); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.SYMBOLS: setSymbols(s => !s); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.WWW: insert('www.'); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.COM: insert('.com'); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.SLASH: insert('/'); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.LEFT: setCursor(c => Math.max(0, c - 1)); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.RIGHT: setCursor(c => Math.min(text.length, c + 1)); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.HOME: setCursor(0); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.END: setCursor(text.length); playUi(UI_SOUND.OSK_KEYPAD); return
      case K.CANCEL: playUi(UI_SOUND.CANCEL); onCancel(); return
      case K.SETTINGS: playUi(UI_SOUND.NOKEY); return  // the options window (t_ShowOptionWnd) is not built
    }
  }

  const move = (dr: number, dc: number) => {
    if (focus === 'done') {
      if (dr > 0) {
        const c = 13
        anchor.current = c
        setFocus({ r: 0, c })
        playUi(UI_SOUND.MOVE)
      }
      return
    }
    const code = keyAt(focus.r, focus.c)
    if (dc !== 0) {
      // step to the next key in that direction (skipping the cells of a wide key)
      let c = focus.c + dc
      while (c >= 0 && c < 15) {
        const k = keyAt(focus.r, c)
        if (k !== null && k !== code) {
          // land on the key's first cell
          const first = cellsOf(k).find(x => x.r === focus.r) ?? { r: focus.r, c }
          anchor.current = c
          setFocus({ r: focus.r, c: first.c })
          playUi(UI_SOUND.MOVE)
          return
        }
        c += dc
      }
      return
    }
    let r = focus.r + dr
    while (r >= 0 && r < GRID.length) {
      // nearest visible key in that row around the anchor column
      for (let d = 0; d < 15; d++) {
        for (const c of [anchor.current - d, anchor.current + d]) {
          const k = keyAt(r, c)
          if (k !== null) {
            const first = cellsOf(k).find(x => x.r === r) ?? { r, c }
            setFocus({ r, c: first.c })
            playUi(UI_SOUND.MOVE)
            return
          }
        }
      }
      r += dr
    }
    // above the keypad: the Done button when it can be used (inferred)
    if (dr < 0 && doneOn) {
      setFocus('done')
      playUi(UI_SOUND.MOVE)
    }
  }

  useRemote((k: RemoteKey) => {
    if (confirm) return false
    switch (k) {
      case 'Up': move(-1, 0); return true
      case 'Down': move(1, 0); return true
      case 'Left': move(0, -1); return true
      case 'Right': move(0, 1); return true
      case 'Enter':
        if (focus === 'done') {
          if (doneOn) {
            playUi(UI_SOUND.OSK_ENTER)
            onDone(text)
          }
          return true
        }
        {
          const code = keyAt(focus.r, focus.c)
          if (code !== null) press(code)
        }
        return true
      case 'Back':
      case 'Exit':
        // t_ProcessQuitIMEConfirm: "Do you want to cancel input?" (C 0x3b5) when something was typed
        if (text) setConfirm(true)
        else onCancel()
        return true
    }
    if (k.startsWith('Digit')) {   // t_RegisterNumKey: the number keys type digits
      if (insert(k.slice(5))) playUi(UI_SOUND.OSK_KEYPAD)
      return true
    }
    return k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute' && k !== 'Power'
  })

  // a USB keyboard types into the field (CIMEWidget::ProcessKeyFromBT; the museum's physical keyboard)
  const stateRef = useRef({ insert, del })
  stateRef.current = { insert, del }
  useEffect(() => {
    setTextCapture(e => {
      if (e.key === 'Backspace') {
        stateRef.current.del()
        playUi(UI_SOUND.OSK_BACKSPACE)
        return true
      }
      if (e.key.length === 1 && e.key !== ' ') {
        if (stateRef.current.insert(e.key)) playUi(UI_SOUND.OSK_KEYPAD)
        return true
      }
      return false
    })
    // capture hook: window.__osk13.type('text')
    const w = window as unknown as { __osk13?: { type: (s: string) => void } }
    w.__osk13 = { type: (s: string) => stateRef.current.insert(s) }
    return () => {
      setTextCapture(null)
      delete w.__osk13
    }
  }, [])

  const shown = password
    ? text.split('').map((ch, i) => (i === reveal ? ch : '*')).join('')
    : text
  const focusCode = focus === 'done' ? null : keyAt(focus.r, focus.c)

  return (
    <div className="n13-osk">
      <div className="n13-osk__dim" />
      <div className="n13-osd">
        <div className="n13-osk__win" style={{ top: WIN_Y, height: WIN_H }}>
          <div className="n13-osk__desc">{`${title} : ${guide}`}</div>
          <div className="n13-osk__count">{`${text.length} / ${max}`}</div>
          <div className="n13-osk__box">
            <span className="n13-osk__text">
              {shown.slice(0, cursor)}
              <span className="n13-osk__cursor" />
              {shown.slice(cursor)}
            </span>
          </div>
          <div
            className={`n13-osk__done${focus === 'done' ? ' n13-osk__done--focus' : ''}${doneOn ? '' : ' n13-osk__done--dim'}`}
            style={{ backgroundImage: `url(${IMG}/appcm_btn_${focus === 'done' ? 'focused' : doneOn ? 'normal' : 'dim'}.png)` }}
          >
            Done
          </div>
        </div>
        <div className="n13-osk__pad" style={{ top: PAD_Y, height: PAD_H }}>
          {GRID.flatMap((row, r) =>
            row.map((code, c) => {
              if (code === E || HIDDEN.has(code)) return null
              const style: CSSProperties = { left: keyX(c), top: Y0 + r * ROW, width: keyW(code, c), height: KH }
              const img = code >= 0x1a && code <= 0x23 ? 'number' : code < 0x2d ? 'general' : 'function'
              const focused = focusCode === code
              return (
                <div key={`${r}:${c}`} className="n13-key" style={{ ...style, borderImageSource: `url(${IMG}/ime_btn_${img}.png)` }}>
                  <KeyFace code={code} label={code < 0x2d ? charOf(code) : ''} caps={caps} shift={shift} symbols={symbols} />
                  {focused && <div className="n13-key__focus" />}
                </div>
              )
            }),
          )}
        </div>
      </div>
      {confirm && (
        <MessageBox
          text="Do you want to cancel input?"
          buttons={['Yes', 'No']}
          onButton={b => {
            setConfirm(false)
            if (b === 0) onCancel()
          }}
        />
      )}
    </div>
  )
}

// key faces: text keys, or the AppCM icons for the function keys
function KeyFace({ code, label, caps, shift, symbols }: { code: number; label: string; caps: boolean; shift: boolean; symbols: boolean }) {
  const icon = (f: string) => <img className="n13-key__icon" src={`${IMG}/${f}.png`} alt="" />
  switch (code) {
    case K.DELETE: return icon('ime_icon_delete')
    case K.SHIFT: return icon(shift ? 'ime_icon_shift_sh_ca' : 'ime_icon_shift_de')
    case K.SPACE: return icon('ime_icon_space')
    case K.SETTINGS: return icon('ime_icon_setting')
    case K.LEFT: return icon('ime_icon_arrow_left')
    case K.RIGHT: return icon('ime_icon_arrow_right')
    case K.HOME: return icon('ime_icon_former_word')
    case K.END: return icon('ime_icon_next_word')
    case K.CLEAR: return <span className="n13-key__fn">Clear</span>                // C 0x1a9
    case K.CAPS: return <span className={`n13-key__fn${caps ? ' n13-key__fn--on' : ''}`}>Caps</span> // C 0x1e4
    case K.SYMBOLS: return <span className="n13-key__fn">{symbols ? 'abc' : '123#&'}</span> // footage; 'abc' inferred
    case K.CANCEL: return <span className="n13-key__fn">Cancel</span>              // C 0xe7
    case K.WWW: return <span className="n13-key__fn">www.</span>                   // t_GetBtnText @019068d0
    case K.COM: return <span className="n13-key__fn">.com</span>
    case K.SLASH: return <span className="n13-key__ch">/</span>
  }
  return <span className="n13-key__ch">{label}</span>
}
