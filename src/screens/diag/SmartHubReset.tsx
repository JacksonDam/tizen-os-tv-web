import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { requestPin } from '../../tv/shell'
import { NOT_AGREED, setDisclaimer } from '../../tv/online'
import { resetLauncher } from '../home/launcher'
import { Ring } from './ui'

// Reset Smart Hub (org.tizen.smarthub-reset, spec3/diag.md 4.6): a transparent window over the caller.
// PIN popup (title "Reset Smart Hub", guide "All Smart Hub settings, downloaded apps, and accounts stored
// on your TV will be reset (takes about 1 min).", Cancel) -> P_PopupBasicBottom_02 "Resetting all
// settings…" with a progress circle and its percentage -> C_PopupToast_White "Reset is complete.".
// The PIN pad is the shared one (requestPin); the reset itself is mocked and runs faster than 1 min.
// Its effect: the terms client resets its agreement DB ("Smarthub reset, need to reset service",
// "Start to reset DB", com.samsung.tv.termsclient), so the Smart Hub terms are no longer agreed and the
// home goes back to "Welcome. Start your Smart Hub!"; the launcher goes back to its default apps.

const T = {
  title: 'Reset Smart Hub',
  guide: 'All Smart Hub settings, downloaded apps, and accounts stored on your TV will be reset (takes about 1 min).',
  resetting: 'Resetting all settings…',
  complete: 'Reset is complete.',
}
const RESET_MS = 6000 // mock

export function SmartHubReset({ onDone }: { onDone: (reset: boolean) => void }) {
  const [phase, setPhase] = useState<'pin' | 'resetting' | 'complete'>('pin')
  const [value, setValue] = useState(0)

  // ask once (StrictMode runs mount effects twice)
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    requestPin({ title: T.title, message: T.guide }).then(ok => {
      if (ok) setPhase('resetting')
      else onDone(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase === 'resetting') {
      if (value >= 100) {
        setDisclaimer(NOT_AGREED)
        resetLauncher() // AppListManagerST.OnTriggerSmartHubReset -> LauncherReset
        return setPhase('complete')
      }
      const t = setTimeout(() => setValue(v => v + 1), RESET_MS / 100)
      return () => clearTimeout(t)
    }
    if (phase === 'complete') {
      const t = setTimeout(() => onDone(true), 3000)
      return () => clearTimeout(t)
    }
  }, [phase, value, onDone])

  // keys are grabbed while it resets (GrapKeys)
  useRemote(() => true, phase !== 'pin')

  if (phase === 'pin') return null
  if (phase === 'complete') return <div className="sd-toast sd-toast--white">{T.complete}</div>
  return (
    <div className="sd-popup">
      <div className="sd-popup__dim" />
      <div className="sd-popup__area shr">
        <div className="shr__ring">
          <Ring size={88} value={value} kind="line" />
        </div>
        <div className="sd-popup__message shr__text">
          {T.resetting}
          <br />
          {`${value}%`}
        </div>
      </div>
    </div>
  )
}
