import { useState } from 'react'
import type { AppProps } from '../../apps/registry'
import { isNavKey, useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { getTv } from '../../tv/store'
import { hhmm, programmeAt } from '../../tv/channels'
import { TV } from '../../assets'
import { cancelSchedule, useSchedules } from './schedules'
import { dayLabel } from './dayLabel'
import { ProgramDetail } from './ProgramDetail'
import './schedule-manager.css'

// org.tizen.schedule-manager, opened from the Guide's options (CContextMenuPopupView "Schedule Manager":
// LaunchApp org.tizen.schedule-manager, epgData, org.tizen.epg). This TV has no recording storage, so
// the list holds scheduled viewings only. Strings: schedule-manager.mo (TV_SID_SCHEDULE_MANAGER,
// COM_SCHEDULED_TO_VIEW, COM_NOTHING_SCHEDULED, TV_SID_SCHEDULE_PROGRAMS_SHOWN, TV_SID_CANCEL_SCHEDULE,
// COM_MORE_INFO, COM_REMOVED_FROM_THE_SCHEDULE). The native layout (dark_theme.edj) was not decompiled:
// the page uses FLUX list conventions (inferred).

const ROWS = 6

export function ScheduleManager({ args, onExit, launch }: AppProps) {
  const list = useSchedules()
  const [focus, setFocus] = useState(0)
  const [top, setTop] = useState(0)
  const [menu, setMenu] = useState<number | null>(null)       // option list focus
  const [detail, setDetail] = useState<number | null>(null)   // row index shown in More Info
  const [toast, setToast] = useState<string | null>(null)
  const f = Math.min(focus, Math.max(0, list.length - 1))
  useMoveSound(menu !== null ? `m${menu}` : `r${f}`)

  const back = () => (args?.from === 'guide' ? launch('guide') : onExit('live'))
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(null), 3000)
  }

  useRemote(key => {
    if (key === 'Home' || !isNavKey(key)) return false
    if (key === 'Exit') {
      onExit('live')
      return true
    }
    if (detail !== null) return false
    if (menu !== null) {
      if (key === 'Up' || key === 'Down') setMenu(key === 'Up' ? 0 : 1)
      else if (key === 'Back') {
        playFeedback('back')
        setMenu(null)
      } else if (key === 'Enter') {
        const s = list[f]
        setMenu(null)
        if (!s) return true
        if (menu === 0) {
          cancelSchedule(s.id)
          showToast('Removed from the schedule.')
        } else setDetail(f)
      }
      return true
    }
    if (key === 'Back') {
      playFeedback('back')
      back()
    } else if (key === 'Up' || key === 'Down') {
      const n = Math.max(0, Math.min(list.length - 1, f + (key === 'Up' ? -1 : 1)))
      setFocus(n)
      if (n < top) setTop(n)
      else if (n >= top + ROWS) setTop(n - ROWS + 1)
    } else if (key === 'Enter' && list.length) setMenu(0)
    return true
  })

  const d = detail !== null ? list[detail] : undefined
  const dch = d ? getTv().channels.find(c => c.number === d.number) : undefined

  return (
    <div className="sm">
      <div className="sm__title">Schedule Manager</div>
      <div className="sm__sub">Scheduled to View</div>
      {list.length === 0 ? (
        <div className="sm__empty">
          <div className="sm__empty-title">Nothing scheduled.</div>
          <div className="sm__empty-text">When you schedule programs to view, they will be shown here.</div>
        </div>
      ) : (
        <div className="sm__list">
          {list.slice(top, top + ROWS).map((s, i) => {
            const on = top + i === f && menu === null && detail === null
            return (
              <div key={s.id} className={`sm__row ${on ? 'is-focused' : ''}`}>
                <img className="sm__icon" src={`${TV}/epg/${on ? 'epg_i_icon_scheduleviewing_f.svg' : 'epg_i_icon_scheduleviewing.svg'}`} alt="" />
                <div className="sm__text">
                  <div className="sm__main">{s.title}</div>
                  <div className="sm__info">
                    {dayLabel(s.start)} {hhmm(new Date(s.start))} - {hhmm(new Date(s.end))}
                    <span className="sm__sep" />
                    {s.number} {s.name}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {menu !== null && (
        <div className="sm__menu" style={{ top: 248 + (f - top) * 112 }}>
          {['Cancel Schedule', 'More Info'].map((m, i) => (
            <div key={m} className={`sm__menu-item ${menu === i ? 'is-focused' : ''}`}>
              {m}
            </div>
          ))}
        </div>
      )}
      {d && dch && (
        <ProgramDetail
          ch={dch}
          prog={programmeAt(dch, new Date(d.start))}
          scheduled
          onClose={a => {
            setDetail(null)
            if (a === 'cancel') {
              cancelSchedule(d.id)
              showToast('Removed from the schedule.')
            }
          }}
        />
      )}
      {toast && <div className="gd-toast">{toast}</div>}
    </div>
  )
}
