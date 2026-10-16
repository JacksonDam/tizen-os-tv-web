import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import type { PopupProps } from '../allsettings/extensions'
import { factoryReset } from './setupState'
import { showToast } from './toastStore'
import { S } from './strings'
import './pin.css'

// General & Privacy > Factory data reset (org.tizen.menu; row self-diagnosis-reset, setting-ui popup.reset
// with pinprompt). After the PIN:
//   1. P_PopupSmallBottom_01 with the reset warning (args.content), Reset (focused) and Cancel
//      (SettingViewPluginTileBase.ShowResetPopup).
//   2. Reset: ResetProgressPopup, "TV will restart automatically after the reset is complete." over a
//      ProgressBarWide with its percentage; keys are blocked while it runs.
//   3. Done: the popup closes into the toast "Reset is complete. TV will turn off and restart
//      automatically."; 2 s later the TV reboots (GetFactoryDataPopupResetHandler, delayRebootTimer 2000)
//      and comes back up in first-time setup.
// The reset itself is mocked: the progress runs over about 4 s (inferred).

const RESET_MS = 4000

export function FactoryResetPopup({ onClose }: PopupProps) {
  const [stage, setStage] = useState<'confirm' | 'progress'>('confirm')
  const [focus, setFocus] = useState(0) // 0 Reset, 1 Cancel
  const [percent, setPercent] = useState(0)
  const [leaving, setLeaving] = useState(false)
  useMoveSound(focus)

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onClose, 200)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  useEffect(() => {
    if (stage !== 'progress') return
    const start = Date.now()
    const t = setInterval(() => {
      const p = Math.min(100, Math.floor(((Date.now() - start) / RESET_MS) * 100))
      setPercent(p)
      if (p >= 100) {
        clearInterval(t)
        setLeaving(true)
        showToast(S.PJT_SID_SUPPORT_RESET_COMPLELTE_TV_TURN_OFF_RESTART, 2000)
        setTimeout(factoryReset, 2000)
      }
    }, 100)
    return () => clearInterval(t)
  }, [stage])

  useRemote(key => {
    if (stage === 'progress' || leaving) return true // BlockRemoteKeyEvents
    if (key === 'Home' || key === 'Exit') return false
    if (key === 'Left' || key === 'Right') setFocus(key === 'Left' ? 0 : 1)
    else if (key === 'Enter') {
      if (focus === 0) setStage('progress')
      else setLeaving(true)
    } else if (key === 'Back') {
      playFeedback('back')
      setLeaving(true)
    }
    return true
  })

  return (
    <div className={`pinp pinp--panel ${leaving ? 'pinp--leaving' : ''}`}>
      <div key={stage} className="pinp__plate">
        {stage === 'confirm' ? (
          <>
            <div className="pinp__message">{S.TV_SID_SETTINGS_PRIVACY_CBJUL_POPUP_MSG_ALL_DATA_DELETED_MSG}</div>
            <div className="pinp__buttons pinp__buttons--two">
              {[S.COM_SID_RESET, S.COM_SID_CANCEL].map((b, i) => (
                <div key={b} className={`flux-btn pinp__button ${focus === i ? 'is-focused' : ''}`}>{b}</div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="pinp__message">{S.TV_SID_SUPPORT_MIX_CBJAN_WILL_RESTART_AUTO_AFTER_RESET}</div>
            <div className="pinp__progress">
              <div className="pinp__progress-track">
                <div className="pinp__progress-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="pinp__progress-value">{percent}%</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
