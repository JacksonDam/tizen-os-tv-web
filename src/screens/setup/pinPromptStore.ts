import { useSyncExternalStore } from 'react'
import type { PinRequest } from '../../tv/shell'

// The pending PIN request (registerPinPrompt -> requestPinImpl); PinPromptOverlay shows it.

type Pending = { req: PinRequest; resolve: (ok: boolean) => void; seq: number }
let pending: Pending | null = null
let seq = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

export function requestPinImpl(req: PinRequest): Promise<boolean> {
  pending?.resolve(false)
  return new Promise(resolve => {
    pending = { req, resolve, seq: ++seq }
    emit()
  })
}

export function settle(ok: boolean) {
  const p = pending
  pending = null
  emit()
  p?.resolve(ok)
}

export function usePending() {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => pending,
  )
}

