import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { hhmm, type Channel, type GuideProgramme } from '../../tv/channels'
import { dayLabel } from './dayLabel'
import '../../components/messagebox.css'

// ug-program-detail-efl, mode "view-detail" (launched by the Guide's Info key and View Details): an
// elm_flux_popup over a CC_Dim50 dim (m_AddPopupDim) with the programme title as the popup title, a
// 109u x 71u content area (m_CreateProgProperties: one 5u row per property; m_CreateProgDescription:
// 101u-wide description, "No Information" when empty) and the popup buttons (m_CreateButtons).
// Button set per programme state (inferred from the modes the Guide launches: watch-now for the current
// programme, schedule-viewing for upcoming ones).

export type DetailAction = 'watch' | 'schedule' | 'cancel' | null

type Props = { ch: Channel; prog: GuideProgramme; scheduled: boolean; onClose: (a: DetailAction) => void }

export function ProgramDetail({ ch, prog, scheduled, onClose }: Props) {
  const now = Date.now()
  const onNow = prog.start.getTime() <= now && now < prog.end.getTime()
  const buttons: { label: string; action: DetailAction }[] = [
    onNow
      ? { label: 'Watch', action: 'watch' }
      : scheduled
        ? { label: 'Cancel Scheduled Viewing', action: 'cancel' }
        : { label: 'Schedule Viewing', action: 'schedule' },
    { label: 'Close', action: null },
  ]
  const [focus, setFocus] = useState(0)
  const [leaving, setLeaving] = useState<DetailAction | undefined>(undefined)
  useMoveSound(focus)

  useEffect(() => {
    if (leaving === undefined) return
    const t = setTimeout(() => onClose(leaving), 200)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  useRemote(key => {
    if (leaving !== undefined) return true
    if (key === 'Home' || key === 'Exit') return false
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons.length - 1, f + 1))
    else if (key === 'Enter') setLeaving(buttons[focus].action)
    else if (key === 'Back' || key === 'Info') {
      playFeedback('back')
      setLeaving(null)
    }
    return true
  })

  return (
    <div className={`msgbox ${leaving !== undefined ? 'msgbox--leaving' : ''}`}>
      <div className="msgbox__dim" />
      <div className="msgbox__area gd-pd">
        <div className="msgbox__title">{prog.title}</div>
        <div className="gd-pd__props">
          <div className="gd-pd__prop">
            {dayLabel(prog.start.getTime(), now)} {hhmm(prog.start)} - {hhmm(prog.end)}
          </div>
          <div className="gd-pd__prop">
            {ch.number} {ch.name}
          </div>
          <div className="gd-pd__prop">{prog.genre}</div>
        </div>
        <div className="gd-pd__desc">{prog.desc || 'No Information'}</div>
        <div className="msgbox__buttons">
          {buttons.map((b, i) => (
            <div key={b.label} className={`flux-btn msgbox__button gd-pd__button ${focus === i ? 'is-focused' : ''}`}>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
