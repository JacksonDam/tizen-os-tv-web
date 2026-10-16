import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { getTv, tuneChannel } from '../../tv/store'
import { hhmm } from '../../tv/channels'
import { TV } from '../../assets'
import { REMIND_LEAD_MS, cancelSchedule, getSchedules, markReminded, useSchedules, type Scheduled } from './schedules'

// Schedule Viewing reminder (reminder-service -> org.tizen.reminder CNotificationBar): 5 minutes before
// a scheduled programme a notification with the title "Schedule Viewing Reminder", the channel ("Ch."
// number name), start time and programme title, "The channel will be tuned on reserved time." and
// OK / Cancel buttons (reminder_share.mo). At the start time the TV tunes to the channel. The notification
// look follows the FLUX toast plate (spec/flux.md 5.13) at the top right (position inferred); it hides by
// itself after 10 s (inferred).

const HIDE_MS = 10000

export function ReminderOverlay() {
  const schedules = useSchedules()
  const [shown, setShown] = useState<Scheduled | null>(null)
  const [focus, setFocus] = useState(0)
  useMoveSound(focus, !!shown)

  // tick: post the reminder at start - 5 min, tune at the start
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      for (const s of getSchedules()) {
        if (s.end <= now) {
          cancelSchedule(s.id)
        } else if (s.start <= now) {
          cancelSchedule(s.id)
          const i = getTv().channels.findIndex(c => c.number === s.number)
          if (i >= 0 && getTv().power === 'on') tuneChannel(i)
          setShown(cur => (cur?.id === s.id ? null : cur))
        } else if (!s.reminded && s.start - now <= REMIND_LEAD_MS) {
          markReminded(s.id)
          setFocus(0)
          setShown(s)
        }
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [schedules])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), HIDE_MS)
    return () => clearTimeout(t)
  }, [shown])

  useRemote(key => {
    if (!shown) return false
    if (key === 'Left' || key === 'Right') setFocus(key === 'Left' ? 0 : 1)
    else if (key === 'Enter') {
      if (focus === 1) cancelSchedule(shown.id)   // Cancel removes the schedule
      setShown(null)
    } else if (key === 'Back') {
      playFeedback('back')
      setShown(null)
    } else return false
    return true
  }, !!shown)

  if (!shown) return null
  return (
    <div className="gd-remind">
      <div className="gd-remind__head">
        <img className="gd-remind__icon" src={`${TV}/epg/epg_i_icon_scheduleviewing.svg`} alt="" />
        <div className="gd-remind__title">Schedule Viewing Reminder</div>
      </div>
      <div className="gd-remind__content">
        <div className="gd-remind__line">
          Ch. {shown.number} {shown.name}
        </div>
        <div className="gd-remind__line gd-remind__prog">
          {hhmm(new Date(shown.start))} {shown.title}
        </div>
        <div className="gd-remind__msg">The channel will be tuned on reserved time.</div>
      </div>
      <div className="gd-remind__buttons">
        {['OK', 'Cancel'].map((b, i) => (
          <div key={b} className={`flux-btn gd-remind__button ${focus === i ? 'is-focused' : ''}`}>
            {b}
          </div>
        ))}
      </div>
    </div>
  )
}
