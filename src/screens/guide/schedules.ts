import { useSyncExternalStore } from 'react'
import type { Channel, GuideProgramme } from '../../tv/channels'

// Scheduled viewings (libreminder-api's reminder list, kept per browser). The Guide adds and cancels
// them; the reminder overlay shows the notification 5 minutes before the start and tunes at the start
// (reminder_share.mo TV_SID_VIEWING_SCHEDULED_SCREEN_REMINDER_5_MIN, TV_SID_THE_CHANNEL_WILL_BE_TUNED_ON_RESERVED_TIME).

export type Scheduled = {
  id: string        // programme id ("<LCN>-<start ms>")
  number: number    // channel LCN
  name: string      // channel name
  title: string
  start: number     // ms
  end: number       // ms
  reminded?: boolean
}

const KEY = 'tizen-os-tv-web.guide.schedules'
export const REMIND_LEAD_MS = 5 * 60000

function load(): Scheduled[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as Scheduled[]) : []
    // past schedules are dropped (DeletePastRemindItem)
    return list.filter(s => s.end > Date.now())
  } catch {
    return []
  }
}

let list: Scheduled[] = load()
const subs = new Set<() => void>()

function save(next: Scheduled[]) {
  list = next
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
  subs.forEach(f => f())
}

export function getSchedules() {
  return list
}

export function useSchedules(): Scheduled[] {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => list,
  )
}

export function isScheduled(id: string) {
  return list.some(s => s.id === id)
}

export function scheduleViewing(ch: Channel, p: GuideProgramme) {
  if (isScheduled(p.id)) return
  const s: Scheduled = { id: p.id, number: ch.number, name: ch.name, title: p.title, start: p.start.getTime(), end: p.end.getTime() }
  save([...list, s].sort((a, b) => a.start - b.start))
}

export function cancelSchedule(id: string) {
  save(list.filter(s => s.id !== id))
}

export function markReminded(id: string) {
  save(list.map(s => (s.id === id ? { ...s, reminded: true } : s)))
}
