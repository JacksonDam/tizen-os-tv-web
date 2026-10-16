import { resetTv } from '../../tv/store'
import { shell } from '../../tv/shell'
import { resetPinState } from './pinStore'

// Whether first-time setup still has to run (the wizard's db/wizard/oobe status, inferred). Set by a
// factory data reset or ?setup=1, cleared when the wizard finishes. A normal first visit opens on the
// Smart Hub as before: no key means setup is done.

const KEY = 'tizen-os-tv-web.setup'
const REMOTE_KEY = 'tizen-os-tv-web.remote'   // the on-screen remote's open/closed state survives a reset

export function isSetupPending(): boolean {
  try {
    return localStorage.getItem(KEY) === 'pending'
  } catch {
    return false
  }
}

export function setSetupPending(pending: boolean) {
  try {
    if (pending) localStorage.setItem(KEY, 'pending')
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: setup state lives only in this page */
  }
  memPending = pending
}

// fallback when storage is unavailable
let memPending = false
export function setupPending() {
  return isSetupPending() || memPending
}

// Factory data reset: every stored setting of this TV (all 'tizen-os-tv-web.*' keys except the
// on-screen remote's) goes back to its default, then the TV turns off and back on into setup.
export function factoryReset() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('tizen-os-tv-web.') && k !== REMOTE_KEY) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  resetTv()
  resetPinState()
  setSetupPending(true)
  shell.restart()
}
