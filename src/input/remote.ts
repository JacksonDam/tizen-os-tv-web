import { useEffect, useRef } from 'react'

// Remote-control keys, named after the Tizen key names the TV apps handle.
export type RemoteKey = 'Up' | 'Down' | 'Left' | 'Right' | 'Enter' | 'Back' | 'Home' | 'Exit'

// Keyboard mapping. Mirrors the QEMU setup used to drive the real firmware
// (F5 = Home, Esc = Back, Return = OK) and adds Backspace / H for convenience.
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
}

// Handlers form a stack: the most recently mounted active handler receives keys first and returns
// true when it consumed the key, false to let the next handler down the stack see it.
type Handler = (key: RemoteKey) => boolean
const stack: { id: number; fn: () => Handler }[] = []
let nextId = 1

export function pressKey(key: RemoteKey) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].fn()(key)) return
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
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
