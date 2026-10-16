import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { getToast, hideToast, subscribeToast } from './toast'
import { createPortal } from 'react-dom'
import { onAnyKey, useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'

// The All Settings popups (org.tizen.menu PopupGUIUtil): the small bottom popup with buttons
// (GetMenuCommonSmallBottomPopupAttributes, 60 s auto-hide) and the toast (GetMenuCommonToastPopupAttributes,
// P_PopupToast_03, 3 s, any key closes it). Both sit on the settings panel (x 80, y 256, 696 tall).

const PANEL_X = 80
const PANEL_Y = 256
const PANEL_H = 696

type PopupProps = {
  panelWidth: number
  message: string
  buttons: string[]
  focus: number
  onClose: (button: number | null) => void
}

// Drawn into the settings layer (.as) so the clipped panel does not cut it; `anchor` is any element
// inside the settings card.
export function PanelPopup({ anchor, ...p }: PopupProps & { anchor: HTMLElement | null }) {
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => setLayer(anchor?.closest<HTMLElement>('.as') ?? null), [anchor])
  return layer ? createPortal(<SmallBottom {...p} />, layer) : null
}

export function SmallBottom({ panelWidth, message, buttons, focus: initial, onClose }: PopupProps) {
  const [focus, setFocus] = useState(initial)
  const [leaving, setLeaving] = useState<number | null | undefined>(undefined)
  useMoveSound(focus)
  useEffect(() => {
    if (leaving === undefined) return
    const t = setTimeout(() => onClose(leaving), 200)
    return () => clearTimeout(t)
  }, [leaving, onClose])
  useEffect(() => {
    const t = setTimeout(() => setLeaving(null), 60_000) // autoHideTime 60000
    return () => clearTimeout(t)
  }, [focus])

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false // the menu closes with its popup
    if (leaving !== undefined) return true
    if (key === 'Left' && focus > 0) setFocus(focus - 1)
    else if (key === 'Right' && focus < buttons.length - 1) setFocus(focus + 1)
    else if (key === 'Enter') setLeaving(focus)
    else if (key === 'Back') {
      playFeedback('back')
      setLeaving(null)
    }
    return true
  })

  // the 63 u popup view is centred on the panel and flush with its bottom; the plate is inset 9 px
  const left = PANEL_X + (panelWidth - 504) / 2 + 9
  return (
    <div className={`avsp ${leaving !== undefined ? 'avsp--leaving' : ''}`}>
      <div className="avsp__plate" style={{ left, bottom: 1080 - (PANEL_Y + PANEL_H) + 13 }}>
        <div className="avsp__message">{message}</div>
        <div className="avsp__buttons">
          {buttons.map((b, i) => (
            <div key={b} className={`flux-btn avsp__button ${focus === i ? 'is-focused' : ''}`}>
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- toast (an overlay, so it outlives the page or popup that raised it; store in toast.ts) ----

export function PanelToast() {
  const t = useSyncExternalStore(subscribeToast, getToast)
  useEffect(() => {
    if (!t) return
    const h = setTimeout(hideToast, 3000)
    // MessageBoxPopup: any key press closes it (and still goes on to the page)
    const off = onAnyKey(hideToast)
    return () => {
      clearTimeout(h)
      off()
    }
  }, [t])
  if (!t) return null
  return (
    <div className="avtoast" style={{ left: PANEL_X + t.width / 2, top: PANEL_Y + PANEL_H / 2, maxWidth: t.width - 16 }}>
      <span>{t.text}</span>
    </div>
  )
}
