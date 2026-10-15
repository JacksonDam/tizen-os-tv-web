import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import type { PopupProps } from '../allsettings/extensions'
import './auto-tuning-popup.css'

// UgManualScan gadget, gadgetId "auto-program" (spec2/channels.md 2.2.2): P_PopupSmallBottom_01 at the
// bottom of the All Settings panel, which the host dims. Start launches channel-search; Cancel and Back
// pop the view. 60 s without a key: the gadget times out and the menu closes it (ums:UtilTimer.cs).

const MESSAGE = 'Press Start to search and store channels.\nNote: This search will erase your current channel list.'
const BUTTONS = ['Start', 'Cancel']

export function AutoTuningPopup({ host, onClose }: PopupProps) {
  const [focus, setFocus] = useState(0) // default focus: Start (ums:PopupAutoProgramStart.cs:283-287)
  const [leaving, setLeaving] = useState(false)
  const [keySeq, setKeySeq] = useState(0)
  useMoveSound(focus)

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onClose, 200)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 60000)
    return () => clearTimeout(t)
  }, [keySeq])

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false   // the menu closes with its popup
    if (leaving) return true
    setKeySeq(n => n + 1)
    if (key === 'Left' || key === 'Right') setFocus(key === 'Left' ? 0 : 1)
    else if (key === 'Enter') {
      if (focus === 0) host.launchApp('channel-search')
      else setLeaving(true)
    } else if (key === 'Back') {
      playFeedback('back')
      setLeaving(true)
    }
    return true
  })

  return (
    <div className={`atp ${leaving ? 'atp--leaving' : ''}`}>
      <div className="atp__plate">
        <div className="atp__title">Auto Tuning</div>
        <div className="atp__message">{MESSAGE}</div>
        <div className="atp__buttons">
          {BUTTONS.map((b, i) => (
            <div key={b} className={`flux-btn atp__button ${focus === i ? 'is-focused' : ''}`}>
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
