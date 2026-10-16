import { useRef, useState } from 'react'

// Text being edited with the on-screen keyboard (see Keyboard.tsx): the host keeps it, shows it in its
// own field with <InputText> and passes it to <Keyboard>.

export type TextState = { text: string; cursor: number }

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

