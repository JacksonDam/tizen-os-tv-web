import { useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { MessageBox } from '../setup/wizard/widgets'
import { Wizard, type WizFocus } from '../setup/wizard/Wizard'
import './net.css'

// Plug & Play step 10 (indicator 8): Software Update (app 0x4a, activate 0x50b; SWU UI state machine
// CSWUMainGBUI_PnP_*). Reached when the network is enabled and the Smart Hub step finished with the
// terms agreed (CHomeWizardWindowManager::HandleEvent @02c03078, event 0x119048: AddPlugPlayStep(10)
// when SWUUIAppWrapper::IsReadyUpgrade). The page (footage sAmJMgr1va0 1:01-1:03): title "Software
// Update" (SWU 0x2f), the loading circle, "Checking your TV software version…" (SWU 0x60) and
// "Updating your TV software ensures you can enjoy the latest features and services." (SWU 0x61),
// bottom buttons "Update now" (SWU 0x39) and "Update later" (SWU 0x63), dimmed while checking; only
// the Previous circle. The mocked server has nothing newer than T-MST12DEUC 2130.0, so the search ends
// in CSWUMainGBUI_PnP_Popup_NoNewUpdate (OnEntry @03c1c3c8): message box type 0xf, SWU 0x5b "You
// already have the most up to date version.", no buttons, 10 s (CSWUMainMsg_GB::ConfigMsgBox
// @03c278ac); when it closes the state machine sends 0x2921 and Plug & Play goes on to Setup complete!
// Positions are the footage's (inferred); the check takes 2.5 s (inferred, the footage's ~2 s).

const CHECK_MS = 2500

export function SwUpdatePage({ step, total, smartHubStep, hiding, onPrev, onNext }: {
  step: number
  total: number
  smartHubStep: number
  hiding?: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const [checking, setChecking] = useState(true)
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState<WizFocus>('content')
  useEffect(() => {
    const ani = setInterval(() => setFrame(f => (f + 1) % 18), 250)
    const t = setTimeout(() => {
      clearInterval(ani)
      setChecking(false)
    }, CHECK_MS)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [])

  useRemote((k: RemoteKey) => {
    if (hiding || !checking) return !checking ? false : true
    if (k === 'Left' && focus !== 'prev') {
      setFocus('prev')
      playUi(UI_SOUND.MOVE)
    } else if (k === 'Right' && focus === 'prev') {
      setFocus('content')
      playUi(UI_SOUND.MOVE)
    } else if (k === 'Enter' && focus === 'prev') {
      playUi(UI_SOUND.SELECT)
      onPrev()
    }
    return k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute' && k !== 'Power'
  })

  return (
    <>
      <Wizard
        title="Software Update"
        step={step}
        total={total}
        smartHubStep={smartHubStep}
        prev="normal"
        buttons={[{ label: 'Update now', disabled: true }, { label: 'Update later', disabled: true }]}
        focus={focus}
        hiding={hiding}
        pageKey="swu"
      >
        <div className="n13-swu">
          {checking && <div className="n13-swu__loading" style={{ backgroundPosition: `${-frame * 64}px 0` }} />}
          <div className="n13-swu__msg" style={{ top: 352 }}>Checking your TV software version…</div>
          <div className="n13-swu__msg" style={{ top: 452 }}>Updating your TV software ensures you can enjoy the latest features and services.</div>
        </div>
      </Wizard>
      {!checking && (
        <MessageBox text="You already have the most up to date version." buttons={[]} timeoutMs={10000} onButton={() => onNext()} />
      )}
    </>
  )
}
