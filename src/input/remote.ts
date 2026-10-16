import { useEffect, useRef } from 'react'

// Remote-control keys, named after the Tizen key names the TV apps handle.
export type DigitKey = `Digit${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
export type RemoteKey =
  | 'Up' | 'Down' | 'Left' | 'Right' | 'Enter' | 'Back' | 'Home' | 'Exit'
  | 'ChannelUp' | 'ChannelDown' | 'VolumeUp' | 'VolumeDown' | 'Mute'
  | 'Info' | 'Source' | 'ChannelList' | 'Settings' | 'Power'
  | 'Guide'                              // XF86ChannelGuide
  | 'More'                               // XF86More: the 123 / colour button (virtual numeric pad)
  | 'Red' | 'Green' | 'Yellow' | 'Blue'  // colour keys
  | DigitKey

// Keyboard mapping. Mirrors the QEMU setup used to drive the real firmware
// (F5 = Home, Esc = Back, Return = OK) and adds keys for the rest of the remote.
const KEYMAP: Record<string, RemoteKey> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Enter',
  ' ': 'Enter',
  Escape: 'Back',
  Backspace: 'Back',
  F5: 'Home',
  h: 'Home',
  H: 'Home',
  x: 'Exit',
  PageUp: 'ChannelUp',
  PageDown: 'ChannelDown',
  '+': 'VolumeUp',
  '=': 'VolumeUp',
  '-': 'VolumeDown',
  _: 'VolumeDown',
  m: 'Mute',
  i: 'Info',
  s: 'Source',
  l: 'ChannelList',
  q: 'Settings',
  p: 'Power',
  g: 'Guide',
  n: 'More',
  F1: 'Red',
  F2: 'Green',
  F3: 'Yellow',
  F4: 'Blue',
}
for (let d = 0; d <= 9; d++) KEYMAP[String(d)] = `Digit${d}` as DigitKey

// Volume, mute and power belong to the system (volume app, power manager) and work over every app:
// they go to the system handler first.
const SYSTEM_KEYS = new Set<RemoteKey>(['VolumeUp', 'VolumeDown', 'Mute', 'Power'])

// Handlers form a stack: the most recently mounted active handler receives keys first and returns
// true when it consumed the key, false to let the next handler down the stack see it.
type Handler = (key: RemoteKey) => boolean
const stack: { id: number; fn: () => Handler }[] = []
let nextId = 1
let systemHandler: Handler | null = null
let fallbackHandler: Handler | null = null
const listeners = new Set<(key: RemoteKey) => void>()

export function pressKey(key: RemoteKey) {
  listeners.forEach(l => l(key))
  if (SYSTEM_KEYS.has(key) && systemHandler?.(key)) return
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].fn()(key)) return
  }
  fallbackHandler?.(key)
}

// The navigation keys an app UI uses; apps let the other (TV) keys through to the fallback handler.
const NAV_KEYS = new Set<RemoteKey>(['Up', 'Down', 'Left', 'Right', 'Enter', 'Back', 'Home', 'Exit'])
export function isNavKey(key: RemoteKey) {
  return NAV_KEYS.has(key)
}

// Text entry: while a text field (the on-screen keyboard) has the focus, a physical keyboard types into
// it. The capture function gets every keydown first and returns true when it used the key (printable
// characters); arrows, Enter, Esc and the rest still reach the remote mapping.
type TextCapture = (e: KeyboardEvent) => boolean
let textCapture: TextCapture | null = null
export function setTextCapture(fn: TextCapture | null) {
  textCapture = fn
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (textCapture?.(e)) {
      e.preventDefault()
      return
    }
    const key = KEYMAP[e.key]
    if (!key) return
    e.preventDefault()
    pressKey(key)
  })
  // Test hook: drive the UI from automation (window.__tv.press('Down')).
  ;(window as unknown as { __tv: object }).__tv = { press: pressKey }
}

export function useRemote(handler: Handler, active = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const entry = { id: nextId++, fn: () => ref.current }
    stack.push(entry)
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}

// The system layer (volume OSD, power) sees system keys before any app.
export function useSystemKeys(handler: Handler) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const h: Handler = k => ref.current(k)
    systemHandler = h
    return () => {
      if (systemHandler === h) systemHandler = null
    }
  }, [])
}

// Observe every key press (used for feedback sounds).
export function onAnyKey(fn: (key: RemoteKey) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// The TV layer (tv-viewer) sees the keys no app consumed: channel keys, Info, Source, digits...
export function useFallbackKeys(handler: Handler) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const h: Handler = k => ref.current(k)
    fallbackHandler = h
    return () => {
      if (fallbackHandler === h) fallbackHandler = null
    }
  }, [])
}
