import { useEffect, useRef, useState } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { useShellView, type PinRequest } from '../../tv/shell'
import { settle, usePending } from './pinPromptStore'
import { PinBoxes } from './PinBoxes'
import { checkPin, pinInvalidCount, pinLockRemaining } from './pinStore'
import { S } from './strings'
import './pin.css'

// The PIN prompt that rows and apps with `pinprompt` show first (org.tizen.menu EnterPinPopup.cs,
// PopupGUIUtil.GetEnterPinPopupAttributes): P_PopupSmallBottom_01 with a FLUX Pin1Line (4 boxes,
// message "Enter your PIN.") and a Cancel button. Over All Settings it sits at the bottom of the panel,
// which dims (as the Auto Tuning confirmation does); elsewhere it is centred at the bottom (inferred).
//
// A wrong PIN clears the boxes and shows "Incorrect PIN entered: n time(s)"; more than 10 wrong PINs lock
// the line with a countdown and move the focus to Cancel (FLUX Pin1Line.cs:536-546, 748-772).

export function PinPromptOverlay() {
  const p = usePending()
  return p ? <PinPopup key={p.seq} req={p.req} onDone={settle} /> : null
}

const DIGITS = 4

function PinPopup({ req, onDone }: { req: PinRequest; onDone: (ok: boolean) => void }) {
  const view = useShellView()
  const inSettings = view.settings
  const [digits, setDigits] = useState('')
  const [focus, setFocus] = useState<'pin' | 'cancel'>(() => (pinLockRemaining() ? 'cancel' : 'pin'))
  const [invalid, setInvalid] = useState(0)          // wrong entries to show (0 = none)
  const [locked, setLocked] = useState(pinLockRemaining())
  const [leaving, setLeaving] = useState<boolean | null>(null)
  useMoveSound(focus)

  // the view the prompt was opened over went away (Home, Exit, a tuned channel...): cancel
  const startView = useRef(view)
  useEffect(() => {
    const s = startView.current
    if (view.settings !== s.settings || view.app !== s.app || view.hub !== s.hub) onDone(false)
  }, [view, onDone])

  useEffect(() => {
    if (leaving === null) return
    const t = setTimeout(() => onDone(leaving), 200)
    return () => clearTimeout(t)
  }, [leaving, onDone])

  // locked countdown (1 s ticks)
  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => {
      const left = pinLockRemaining()
      setLocked(left)
      if (!left) {
        setFocus('pin')
        setInvalid(pinInvalidCount())
      }
    }, 1000)
    return () => clearInterval(t)
  }, [locked])

  // 4 digits: check after the last asterisk has drawn (PinBase delay timer, inferred 300 ms)
  useEffect(() => {
    if (digits.length < DIGITS) return
    const t = setTimeout(() => {
      if (checkPin(digits)) {
        setLeaving(true)
        return
      }
      setDigits('')
      const left = pinLockRemaining()
      if (left) {
        setLocked(left)
        setFocus('cancel')
      } else setInvalid(pinInvalidCount())
    }, 300)
    return () => clearTimeout(t)
  }, [digits])

  useRemote((key: RemoteKey) => {
    if (leaving !== null) return true
    if (key === 'Home' || key === 'Exit') {
      onDone(false)
      return false // the view below closes too
    }
    if (key === 'Back') {
      if (focus === 'pin' && digits) setDigits(d => d.slice(0, -1)) // (inferred) Back deletes a digit first
      else {
        playFeedback('back')
        setLeaving(false)
      }
      return true
    }
    if (focus === 'pin') {
      if (key.startsWith('Digit') && digits.length < DIGITS) setDigits(d => d + key.slice(5))
      else if (key === 'Left' && digits) setDigits(d => d.slice(0, -1))
      else if (key === 'Down') setFocus('cancel')
      return true
    }
    if (key === 'Up' && !locked) setFocus('pin')
    else if (key === 'Enter') setLeaving(false)
    return true
  })

  const cls = `pinp ${inSettings ? 'pinp--panel' : 'pinp--screen'} ${leaving !== null ? 'pinp--leaving' : ''}`
  return (
    <div className={cls}>
      {inSettings ? <div className="pinp__panel-dim" /> : <div className="pinp__screen-dim" />}
      <div className="pinp__plate">
        {req.title && <div className="pinp__title">{req.title}</div>}
        <div className="pin-line">
          {locked ? (
            <div className="pin-line__msg pin-line__msg--multi">{S.INCORRECT_PIN_TOO_MANY(locked)}</div>
          ) : (
            <>
              <div className="pin-line__msg">{req.message ?? S.COM_ENTER_YOUR_PIN_KR_PIN}</div>
              {invalid > 0 && <div className="pin-line__msg pin-line__msg--multi">{S.INCORRECT_PIN_ENTERED_TIMES(invalid)}</div>}
              <PinBoxes count={DIGITS} filled={digits.length} focused={focus === 'pin'} />
            </>
          )}
        </div>
        <div className="pinp__buttons">
          <div className={`flux-btn pinp__button ${focus === 'cancel' ? 'is-focused' : ''}`}>{S.COM_SID_CANCEL}</div>
        </div>
      </div>
    </div>
  )
}
