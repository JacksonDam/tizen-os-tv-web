import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import '../../components/messagebox.css'

// A FLUX MessageBox (P_PopupSmallBottom_01 frame, spec/flux.md 5.12) for tv-viewer's timer popups
// (CPopupBannerViewCommonUtil::GetPopupContent): title, a message whose countdown updates every
// second, and a row of buttons. Same look and motion as src/components/MessageBox.

type Props = {
  title?: string
  message: string
  buttons: string[]
  focus?: number
  onClose: (button: number | null) => void   // null = Back
}

export function AvPopup({ title, message, buttons, focus: initial = 0, onClose }: Props) {
  const [focus, setFocus] = useState(initial)
  const [leaving, setLeaving] = useState<number | null | undefined>(undefined)
  useMoveSound(focus)

  useEffect(() => {
    if (leaving === undefined) return
    const t = setTimeout(() => onClose(leaving), 200)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  useRemote(key => {
    if (leaving !== undefined) return true
    if (key === 'Left' && focus > 0) setFocus(focus - 1)
    else if (key === 'Right' && focus < buttons.length - 1) setFocus(focus + 1)
    else if (key === 'Enter') setLeaving(focus)
    else if (key === 'Back') {
      playFeedback('back')
      setLeaving(null)
    } else if (key === 'Home' || key === 'Exit') setLeaving(null)
    return true
  })

  return (
    <div className={`msgbox avp ${leaving !== undefined ? 'msgbox--leaving' : ''}`}>
      <div className="msgbox__dim" />
      <div className="msgbox__area avp__area">
        {title && <div className="msgbox__title">{title}</div>}
        <div className="msgbox__message avp__message">{message}</div>
        <div className="msgbox__buttons">
          {buttons.map((b, i) => (
            <div key={b} className={`flux-btn msgbox__button ${focus === i ? 'is-focused' : ''}`}>
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
