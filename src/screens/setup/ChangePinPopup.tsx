import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import type { PopupProps } from '../allsettings/extensions'
import { PinBoxes } from './PinBoxes'
import { setPin } from './pinStore'
import { showToast } from './toastStore'
import { S } from './strings'
import './pin.css'

// General & Privacy > Change PIN (org.tizen.menu ChangePinPopup.cs; the row's pinprompt asks for the
// current PIN first). P_PopupBasicBottom_02 holding a FLUX Pin2Line: "Enter a new PIN." over 4 boxes,
// "Enter the PIN again." over 4 more, and Cancel. When both match, the PIN is stored and the popup
// closes into the "The PIN has been changed." toast (setting-ui confirmation-content
// TV_SID_CI_PIN_HAS_BEEN_CHANGED); otherwise both rows clear and "The PINs you entered do not match.
// Please try again." appears above them (CheckChangePinResult).

const N = 4

export function ChangePinPopup({ onClose }: PopupProps) {
  const [digits, setDigits] = useState('')         // up to 8: new PIN then confirmation
  const [focus, setFocus] = useState<'pin' | 'cancel'>('pin')
  const [retry, setRetry] = useState(false)
  const [leaving, setLeaving] = useState(false)
  useMoveSound(focus)

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onClose, 200)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  // 8 digits: compare after the delay timer (CreateDelayTimer, 10 ms; plus the asterisk draw, inferred)
  useEffect(() => {
    if (digits.length < 2 * N) return
    const t = setTimeout(() => {
      const a = digits.slice(0, N)
      if (a === digits.slice(N)) {
        setPin(a)
        setLeaving(true)
        showToast(S.TV_SID_CI_PIN_HAS_BEEN_CHANGED)
      } else {
        setRetry(true)
        setDigits('')
      }
    }, 300)
    return () => clearTimeout(t)
  }, [digits])

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false // the menu closes with its popup
    if (leaving) return true
    if (key === 'Back') {
      if (focus === 'pin' && digits) setDigits(d => d.slice(0, -1)) // (inferred) delete first
      else {
        playFeedback('back')
        setLeaving(true)
      }
      return true
    }
    if (focus === 'pin') {
      if (key.startsWith('Digit') && digits.length < 2 * N) setDigits(d => d + key.slice(5))
      else if (key === 'Left' && digits) setDigits(d => d.slice(0, -1))
      else if (key === 'Down') setFocus('cancel')
      return true
    }
    if (key === 'Up') setFocus('pin')
    else if (key === 'Enter') setLeaving(true)
    return true
  })

  const first = Math.min(digits.length, N)
  const second = Math.max(0, digits.length - N)
  return (
    <div className={`pinp pinp--panel ${leaving ? 'pinp--leaving' : ''}`}>
      <div className="pinp__plate">
        {retry && <div className="pin-line__msg pin-line__msg--multi">{S.TV_SID_WEBBROWSER_PIN_ENTERED_NOT_MATCH_TRY_KR_17}</div>}
        <div className="pin-line">
          <div className="pin-line__msg">{S.COM_TV_SID_ENTER_A_NEW_PIN}</div>
          <PinBoxes count={N} filled={first} focused={focus === 'pin' && digits.length < N} />
        </div>
        <div className="pin-line">
          <div className="pin-line__msg">{S.TV_SID_ENTER_PIN_AGAIN_POINT}</div>
          <PinBoxes count={N} filled={second} focused={focus === 'pin' && digits.length >= N} />
        </div>
        <div className="pinp__buttons">
          <div className={`flux-btn pinp__button ${focus === 'cancel' ? 'is-focused' : ''}`}>{S.COM_SID_CANCEL}</div>
        </div>
      </div>
    </div>
  )
}
