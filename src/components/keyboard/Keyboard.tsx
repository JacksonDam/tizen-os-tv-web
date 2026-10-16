import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { setTextCapture, useRemote, type RemoteKey } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import { DEFAULT_FOCUS, QWERTY, SYMB, moveFocus, type Cell, type Layout } from './layouts'
import './keyboard.css'

// The Samsung on-screen keyboard (com.samsung.tv.sboard-app, "S Board") for the web rebuild.
//
// Usage: keep the text in a useTextEntry() state, show it in the host's own field (<InputText>), and
// mount <Keyboard> while the field is being edited. The keyboard takes every remote key while it is up
// (number keys type digits, Back cancels, Done/Return commits) and lets Home and Exit through.
//
//   const entry = useTextEntry(name, 30)
//   <InputText entry={entry} hint="..." editing />
//   {editing && <Keyboard entry={entry} style={{ left: 840, top: 348 }} onDone={save} onCancel={close} />}
//
// A physical keyboard types into the field too (setTextCapture): printable characters and Backspace
// edit the text, Return after typing commits. Arrow keys and Return still drive the on-screen keys.
//
// Placement follows the callers' ShowInputPanel calls (spec3/connections.md 1.4): "dynamic_ui" (Settings
// search, Edit Name) opens next to the menu panel, "floating_ui" (Wi-Fi password) above the input bar.
// Geometry from the app's dimension table (sboard-app @0x2ab66, FLUX units of 8 px): mini_softkey
// 9 x 7 u = 72 x 56 px keys. Gaps, paddings and key colours are (inferred) from the theme images.

const IMG = `${TV}/keyboard`
const KEY_W = 72
const KEY_H = 56
const GAP = 8
const PAD = 24
export const KEYBOARD_W = 11 * KEY_W + 10 * GAP + 2 * PAD // 920
export const KEYBOARD_H = 5 * KEY_H + 4 * GAP + 2 * PAD // 360

type TextState = { text: string; cursor: number }

export type TextEntry = TextState & {
  maxLength: number
  set: (text: string, cursor?: number) => void
  // edit from the latest state (several key events can arrive before React renders); null = no change
  edit: (fn: (s: TextState) => TextState | null) => boolean
}

export function useTextEntry(initial: string, maxLength: number): TextEntry {
  const [s, setS] = useState<TextState>({ text: initial.slice(0, maxLength), cursor: Math.min(initial.length, maxLength) })
  const latest = useRef(s)
  const apply = (next: TextState) => {
    const clamped = { text: next.text, cursor: Math.max(0, Math.min(next.cursor, next.text.length)) }
    latest.current = clamped
    setS(clamped)
  }
  return {
    ...s,
    maxLength,
    set: (text, cursor = text.length) => apply({ text, cursor }),
    edit: fn => {
      const next = fn(latest.current)
      if (next) apply(next)
      return !!next
    },
  }
}

// The text field (C_InputFieldW_01): text with the caret at the cursor, or the hint while empty.
// Passwords show a dot per character (InputFieldBase password mode).
export function InputText({ entry, hint, editing, password, className }: {
  entry: TextEntry
  hint?: string
  editing: boolean
  password?: boolean
  className?: string
}) {
  const shown = password ? '●'.repeat(entry.text.length) : entry.text
  return (
    <span className={`kb-text ${className ?? ''}`}>
      {!entry.text && !editing ? (
        <span className="kb-text__hint">{hint}</span>
      ) : (
        <>
          {shown.slice(0, entry.cursor)}
          {editing && <span className="kb-text__caret" />}
          {shown.slice(entry.cursor)}
          {!entry.text && hint && <span className="kb-text__hint">{hint}</span>}
        </>
      )}
    </span>
  )
}

type Shift = 'off' | 'on' | 'lock'

export function Keyboard({ entry, style, onDone, onCancel, onFull, doneEnabled = true, onExitUp, search }: {
  entry: TextEntry
  style: CSSProperties              // position on the 1920x1080 stage (left/top or left/bottom)
  onDone: (text: string) => void    // Done key, or Return after typing on a physical keyboard
  onCancel: () => void              // Back
  onFull?: () => void               // a character did not fit (maxLength)
  doneEnabled?: boolean             // EnableMetaKeyAtInputPanel: Done is dimmed until the text is valid
  onExitUp?: () => void             // Up from the top row leaves the keyboard (the host takes the focus)
  search?: boolean                  // "action=search": the Done key shows the search icon
}) {
  const [layout, setLayout] = useState<Layout>(QWERTY)
  const [page, setPage] = useState(0) // symbols page 0/1
  const [shift, setShift] = useState<Shift>('off')
  const [focus, setFocus] = useState(DEFAULT_FOCUS)
  const column = useRef(QWERTY.cells[DEFAULT_FOCUS].col) // column remembered across wide keys
  const [toast, setToast] = useState<string | null>(null)
  const typed = useRef(false) // last input came from a physical keyboard
  useMoveSound(`${layout.name}:${focus}`)

  const latest = useRef({ entry, onDone, onCancel, doneEnabled })
  latest.current = { entry, onDone, onCancel, doneEnabled }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const insert = (s: string) => {
    const e = latest.current.entry
    const ok = e.edit(t =>
      t.text.length + s.length > e.maxLength ? null : { text: t.text.slice(0, t.cursor) + s + t.text.slice(t.cursor), cursor: t.cursor + s.length },
    )
    if (!ok) {
      setToast("The box is full. You can't enter any more text.") // TV_SID_THE_BOX_IS_FULL_YOU_CANT_ENTER_ANY_MORE_TEXT_15Y
      onFull?.()
    }
  }
  const backspace = () =>
    latest.current.entry.edit(t => (t.cursor > 0 ? { text: t.text.slice(0, t.cursor - 1) + t.text.slice(t.cursor), cursor: t.cursor - 1 } : null))
  const moveCursor = (d: number) => latest.current.entry.edit(t => ({ text: t.text, cursor: t.cursor + d }))

  // physical keyboard
  useEffect(() => {
    setTextCapture(ev => {
      if (ev.key === 'Backspace') {
        typed.current = true
        backspace()
        return true
      }
      if (ev.key === 'Enter' && typed.current) {
        if (latest.current.doneEnabled) latest.current.onDone(latest.current.entry.text)
        return true
      }
      if (ev.key.length === 1) {
        typed.current = true
        insert(ev.key)
        return true
      }
      typed.current = false
      return false
    })
    return () => setTextCapture(null)
    // insert/backspace read the latest entry through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const press = (c: Cell) => {
    if (c.char) {
      const label = layout.name === 'symb' ? c.char[page] ?? c.char[0] : shift !== 'off' && c.upper ? c.char[1]! : c.char[0]
      insert(label)
      if (shift === 'on') setShift('off')
      return
    }
    switch (c.fn) {
      case 'space': insert(' '); break
      case 'done': if (doneEnabled) onDone(entry.text); break
      case 'backspace': backspace(); break
      case 'left': moveCursor(-1); break
      case 'right': moveCursor(1); break
      case 'shift': setShift(s => (s === 'off' ? 'on' : s === 'on' ? 'lock' : 'off')); break
      case 'symb': setLayout(SYMB); setPage(0); break
      case 'abc': setLayout(QWERTY); break
      case 'symbpage': setPage(p => 1 - p); break
      // English is the only enabled input language here; keyboard settings are a separate app
      case 'lang': case 'symb_lang': case 'settings':
        setToast("This function isn't available.")
        break
    }
  }

  useRemote((key: RemoteKey) => {
    if (key === 'Home' || key === 'Exit') return false
    typed.current = false
    if (key === 'Back') {
      playFeedback('back')
      onCancel()
    } else if (key === 'Up' && layout.cells[focus].row === 0 && onExitUp) {
      onExitUp()
    } else if (key === 'Up' || key === 'Down' || key === 'Left' || key === 'Right') {
      const next = moveFocus(layout, focus, key, column.current)
      if (key === 'Left' || key === 'Right') column.current = layout.cells[next].col
      setFocus(next)
    } else if (key === 'Enter') press(layout.cells[focus])
    else if (key.startsWith('Digit')) insert(key.slice(5))
    return true // the IME grabs the other keys while it is shown
  })

  // the IME is its own window: drawn on the stage, outside any clipped panel
  const layer = document.querySelector('.stage') ?? document.body
  return createPortal(
    <div className="kb" style={{ ...style, width: KEYBOARD_W, height: KEYBOARD_H }}>
      {layout.cells.map((c, i) => (
        <Key
          key={`${layout.name}${i}`}
          cell={c}
          focused={i === focus}
          label={c.char ? (layout.name === 'symb' ? c.char[page] ?? c.char[0] : shift !== 'off' && c.upper ? c.char[1]! : c.char[0]) : undefined}
          shift={shift}
          page={page}
          dim={c.fn === 'done' && !doneEnabled}
          search={search}
        />
      ))}
      {toast && <div className="kb__toast">{toast}</div>}
    </div>,
    layer,
  )
}

const FN_ICON: Partial<Record<string, string>> = {
  settings: 'ime_keypad_ic_options.svg',
  space: 'ime_keypad_ic_spacebar.svg',
  left: 'ime_keypad_ic_left.svg',
  right: 'ime_keypad_ic_right.svg',
  backspace: 'ime_keypad_ic_delete.svg',
  lang: 'ime_keypad_ic_language.svg',
  symb_lang: 'ime_keypad_ic_language.svg',
}
const FN_TEXT: Partial<Record<string, string>> = { done: 'Done', symb: '!#1', abc: 'ABC' }

function Key({ cell, focused, label, shift, page, dim, search }: {
  cell: Cell
  focused: boolean
  label?: string
  shift: Shift
  page: number
  dim: boolean
  search?: boolean
}) {
  const icon =
    cell.fn === 'done' && search
      ? 'ime_keypad_ic_search.svg'
      : cell.fn === 'shift'
      ? shift === 'off' ? 'ime_keypad_ic_shift.svg' : shift === 'on' ? 'ime_keypad_ic_shift_press.svg' : 'ime_keypad_ic_shift_hold.svg'
      : cell.fn && FN_ICON[cell.fn]
  const text = cell.fn === 'symbpage' ? `${page + 1}/2` : cell.fn ? FN_TEXT[cell.fn] : label
  const mask = icon ? `url(${IMG}/${icon})` : undefined
  return (
    <div
      className={[
        'kb-key',
        cell.fn ? 'kb-key--fn' : '',
        cell.fn === 'done' ? 'kb-key--done' : '',
        cell.fn === 'shift' && shift !== 'off' ? 'kb-key--shift-on' : '',
        dim ? 'is-dim' : '',
        focused ? 'is-focused' : '',
      ].join(' ')}
      style={{
        left: PAD + cell.col * (KEY_W + GAP),
        top: PAD + cell.row * (KEY_H + GAP),
        width: cell.span * KEY_W + (cell.span - 1) * GAP,
        height: KEY_H,
      }}
    >
      {icon ? (
        <span className={`kb-key__icon ${cell.fn === 'space' ? 'kb-key__icon--space' : ''}`} style={{ maskImage: mask, WebkitMaskImage: mask }} />
      ) : (
        text
      )}
    </div>
  )
}
