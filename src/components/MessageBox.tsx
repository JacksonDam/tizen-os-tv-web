import { useEffect, useState } from 'react'
import { useRemote } from '../input/remote'
import './messagebox.css'
import { useMoveSound } from '../tv/sound'

// FLUX MessageBox on the P_PopupSmallBottom_01 frame (spec/flux.md 5.12): optional title, T28 message,
// a row of 240x56 buttons. Appears with a 200 ms fade and a 0.95 -> 1 elastic scale.
type Props = {
  title?: string
  message: string
  buttons: string[]
  onClose: (button: number | null) => void
}

export function MessageBox({ title, message, buttons, onClose }: Props) {
  const [focus, setFocus] = useState(0)
  useMoveSound(focus)
  const [leaving, setLeaving] = useState<number | null | undefined>(undefined)

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
    else if (key === 'Back') setLeaving(null)
    else if (key === 'Home') return false
    return true
  })

  return (
    <div className={`msgbox ${leaving !== undefined ? 'msgbox--leaving' : ''}`}>
      <div className="msgbox__dim" />
      <div className="msgbox__area">
        {title && <div className="msgbox__title">{title}</div>}
        <div className="msgbox__message">{message}</div>
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
