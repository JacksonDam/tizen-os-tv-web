import { useSyncExternalStore } from 'react'
import { isConnected, useNet } from '../screens/connections/network'
import { resetLauncher } from '../screens/home/launcher'

// The TV's online state for the Smart Hub: the mocked network (screens/connections/network.ts) and the
// Smart Hub disclaimer.
//
// The disclaimer is config string key 42, a JSON object of agreement flags written by the terms client
// (com.samsung.tv.termsclient). The home counts it as agreed when both `tnc` and `pp` are "TRUE"
// (CompTopBanner.IsDisclaimerAgreeDefaultTopBanner, CompHome/.../CompTopBanner.cs:155-171;
// Disclaimer.IsDisclaimerAgreeDefault, CoBA.Core/Util/Disclaimer.cs:172-187). The museum's TV starts
// with the terms agreed; first-time setup starts from a factory TV (nothing agreed) and agrees in its
// Smart Hub step; Reset Smart Hub clears the agreements (termsclient "Smarthub reset, need to reset
// service", "Start to reset DB").

export type Disclaimer = {
  tnc?: string        // Smart Hub Terms and Conditions
  pp?: string         // Privacy Notice
  viewing?: string    // optional consents the server may offer (not used by the home)
  voice_service?: string
}

const KEY = 'tizen-os-tv-web.disclaimer'
export const AGREED: Disclaimer = { tnc: 'TRUE', pp: 'TRUE' }
export const NOT_AGREED: Disclaimer = {}

function load(): Disclaimer {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Disclaimer
  } catch {
    /* storage unavailable or broken: the museum default */
  }
  return AGREED
}

let state = load()
const subs = new Set<() => void>()

export function getDisclaimer() {
  return state
}

export function setDisclaimer(d: Disclaimer) {
  // withdrawing the terms resets the launcher (AppListManagerST.OnDisclaimerChanged -> LauncherReset)
  if (isAgreed(state) && !isAgreed(d)) resetLauncher()
  state = d
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* ignore */
  }
  subs.forEach(f => f())
}

export function isAgreed(d: Disclaimer = state) {
  return d.tnc?.toUpperCase() === 'TRUE' && d.pp?.toUpperCase() === 'TRUE'
}

export function useAgreed(): boolean {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => isAgreed(state),
  )
}

// The TV reaches the internet (the server content of the Smart Hub needs it).
export function useOnline(): boolean {
  return useNet(isConnected)
}

// Legal and other documents come from Samsung's servers; the recreation shows this instead of them.
export const SERVER_TEXT_STUB =
  'This text is supplied by the server when the TV is online. It is not part of this recreation.'
