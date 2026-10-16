import { useEffect, useState, type ReactNode } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import './diag.css'

// Shared FLUX pieces for Device Care and the Self Diagnosis test apps (spec/flux.md 5.12-5.13,
// spec3/diag.md 1). Positions are 1920x1080 stage pixels; 1 FLUX unit = 8 px.

// ---- ProgressCircle ----
// C_ProgressCircle_02 (Regular / Bold): track CC_BG110, #33ADFF arc from 12 o'clock. C_ProgressCircle_01
// at 40 u uses the Large Lottie scaled up: 4/124 of the diameter (inferred from i_img_progresscircle_01_l).
export function Ring({ size, value, kind = 'regular', className }: { size: number; value: number; kind?: 'regular' | 'bold' | 'line'; className?: string }) {
  const ratio = kind === 'regular' ? 24.34 / 384 : kind === 'bold' ? 36 / 384 : 4 / 124 // bold: inferred
  const stroke = size * ratio
  const r = size / 2 - stroke / 2
  const c = 2 * Math.PI * r
  const track = kind === 'line' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#33adff"
        strokeWidth={stroke}
        strokeDasharray={`${(c * Math.max(0, Math.min(100, value))) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

// ---- SDOption (OptionButtonType.Text2): row of C_ButtonBasicText_01, 49 x 9 u, gap 1 u, top-centred in
// the 17 u BUTTONS band (y 944) ----
export function OptionRow({ labels, focus, top = 944 }: { labels: string[]; focus: number | null; top?: number }) {
  return (
    <div className="sd-options" style={{ top }}>
      {labels.map((l, i) => (
        <div key={l} className={`flux-btn sd-options__btn ${focus === i ? 'is-focused' : ''}`}>
          {l}
        </div>
      ))}
    </div>
  )
}

// ---- FLUX popups ----
// P_PopupBasicBottom_02 (title hidden): 121 x 55 u, T28 500 CC_Basic180 message, buttons 30 x 7 u in a
// bottom row. P_PopupLargeRight_01 with a CustomList: 161 x 85 u, list area 104 x 73 u on the left and
// a column of 34 x 7 u buttons on the right (SDPopupView.CreateCustomArea).

export type ListRow = { main: string; sub?: string }

type PopupProps = {
  message?: string
  custom?: ReactNode   // custom area above the bottom button row (e.g. View Details)
  rows?: ListRow[]
  buttons: string[]
  focusButton?: number
  onSelect: (button: number) => void
  onBack: () => void
}

export function FluxPopup({ message, custom, rows, buttons, focusButton = 0, onSelect, onBack }: PopupProps) {
  const right = !!rows
  const [focus, setFocus] = useState(focusButton)
  const [rowFocus, setRowFocus] = useState<number | null>(null)
  useMoveSound(`${focus}:${rowFocus}`)
  const [leaving, setLeaving] = useState<null | (() => void)>(null)
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(leaving, 200)
    return () => clearTimeout(t)
  }, [leaving])
  const leave = (f: () => void) => setLeaving(() => f)

  useRemote(key => {
    if (leaving) return true
    if (key === 'Home') return false
    if (key === 'Back') leave(onBack)
    else if (right && rowFocus !== null) {
      // the list takes Up/Down; Right goes back to the buttons
      if (key === 'Up') setRowFocus(Math.max(0, rowFocus - 1))
      else if (key === 'Down') setRowFocus(Math.min(rows!.length - 1, rowFocus + 1))
      else if (key === 'Right') setRowFocus(null)
    } else if (right) {
      if (key === 'Up') setFocus(Math.max(0, focus - 1))
      else if (key === 'Down') setFocus(Math.min(buttons.length - 1, focus + 1))
      else if (key === 'Left' && rows!.length) setRowFocus(0)
      else if (key === 'Enter') leave(() => onSelect(focus))
    } else {
      if (key === 'Left') setFocus(Math.max(0, focus - 1))
      else if (key === 'Right') setFocus(Math.min(buttons.length - 1, focus + 1))
      else if (key === 'Enter') leave(() => onSelect(focus))
    }
    return true
  })

  return (
    <div className={`sd-popup ${leaving ? 'sd-popup--leaving' : ''}`}>
      <div className="sd-popup__dim" />
      <div className={`sd-popup__area ${right ? 'sd-popup__area--right' : ''} ${custom ? 'sd-popup__area--custom' : ''}`}>
        {right ? (
          <>
            <div className="sd-popup__list">
              {rows!.map((r, i) => (
                <div key={i} className={`sd-popup__row ${rowFocus === i ? 'is-focused' : ''}`}>
                  <span className="sd-popup__row-main">{r.main}</span>
                  {r.sub && <span className="sd-popup__row-sub">{r.sub}</span>}
                </div>
              ))}
            </div>
            <div className="sd-popup__buttons sd-popup__buttons--column">
              {buttons.map((b, i) => (
                <div key={b} className={`flux-btn sd-popup__button ${rowFocus === null && focus === i ? 'is-focused' : ''}`}>
                  {b}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {custom ?? <div className="sd-popup__message">{message}</div>}
            <div className="sd-popup__buttons">
              {buttons.map((b, i) => (
                <div key={b} className={`flux-btn sd-popup__button ${focus === i ? 'is-focused' : ''}`}>
                  {b}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// A key handler placed in the tree: React runs effects child-first, so a parent's own useRemote ends up
// above its children's on mount. Rendering this as the first child keeps the handler below the views
// that follow it (they see the keys first and pass on what they don't use). Keep it active: re-activating
// a handler pushes it back on top of the stack.
export function KeyLayer({ handler, active = true }: { handler: (key: RemoteKey) => boolean; active?: boolean }) {
  useRemote(handler, active)
  return null
}

// The FLUX full-screen background (FluxBackground: #090F16 under the i_img_bg_tile.webp gradient).
export function FluxScreen({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`sd-screen ${className}`}>{children}</div>
}
