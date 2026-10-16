import { useSyncExternalStore } from 'react'
import { TV } from '../../../assets'
import { DEFAULT_LINEUP, programmeAt } from '../../../tv/channels'

// Notifications (com.samsung.tv.notification-app): the list the notification center shows, newest
// first, and the banner a new one raises. Kept per browser under 'tizen-os-tv-web.notifications'.
// Other features add theirs with pushNotification().

export type TvNotification = {
  id: number
  title: string
  description?: string
  icon?: string          // icon URL; empty = the app's default (noti_icon_default.svg)
  time: number           // creation time (ms)
  buttons?: string[]     // button labels; a buttonless one gets "Close" in the center (CreateDefaultButton)
}

type State = {
  list: TvNotification[]
  nextId: number
  allowSound: boolean    // Settings > Allow sound (NotificationSetting.AllowSound)
  seeded: boolean
  greeted: string[]      // one-time device arrivals already announced
}

const KEY = 'tizen-os-tv-web.notifications'
export const NOTI_RES = `${TV}/notification-app`

const DAY = 86400000

// First visit: two notifications already in the center, as a TV that has been in use would have.
function seed(): State {
  const now = Date.now()
  const ch = DEFAULT_LINEUP[0]
  const yesterday = new Date(now - DAY)
  yesterday.setHours(19, 55, 0, 0)
  const p = programmeAt(ch, new Date(yesterday.getTime() + 5 * 60000))
  const swu = new Date(now - 2 * DAY)
  swu.setHours(9, 12, 0, 0)
  return {
    list: [
      {
        id: 2,
        title: 'Schedule Viewing Reminder',                     // COM_SCHEDULE_VIEWING_REMINDER (reminder_share.mo)
        description: `${p.title || ch.name} on ${ch.number} ${ch.name}`, // (inferred) wording
        time: yesterday.getTime(),
      },
      {
        id: 1,
        title: 'Software Update',
        description: 'You have the latest software.',           // TV_SID_OOBE_CAJUL_SWU_U_HAVE_LATEST_SW
        time: swu.getTime(),
      },
    ],
    nextId: 3,
    allowSound: true,
    seeded: true,
    greeted: [],
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return seed()
}

let state = load()
const subs = new Set<() => void>()
const added = new Set<(n: TvNotification) => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  subs.forEach(f => f())
}

export function getNotifications() {
  return state
}

export function useNotifications<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => select(state),
  )
}

// Adds a notification (newest first) and shows its banner, or adds it to the open center.
export function pushNotification(n: Omit<TvNotification, 'id' | 'time'> & { time?: number }): number {
  const item: TvNotification = { ...n, id: state.nextId, time: n.time ?? Date.now() }
  set({ list: [item, ...state.list], nextId: state.nextId + 1 })
  added.forEach(f => f(item))
  return item.id
}

export function deleteNotification(id: number) {
  set({ list: state.list.filter(n => n.id !== id) })
}

export function deleteAllNotifications() {
  set({ list: [] })
}

export function setAllowSound(on: boolean) {
  set({ allowSound: on })
}

// one-time arrivals (e.g. a device announcing itself the first time)
export function greetOnce(key: string, n: Omit<TvNotification, 'id' | 'time'>) {
  if (state.greeted.includes(key)) return
  set({ greeted: [...state.greeted, key] })
  pushNotification(n)
}

export function onNotificationAdded(f: (n: TvNotification) => void) {
  added.add(f)
  return () => {
    added.delete(f)
  }
}

// Style.GetTimestampString: time only for today, else date and time (format of the TV's info banner;
// TimeUtil's exact pattern is not in the decompile -> inferred).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function timestamp(ms: number) {
  const d = new Date(ms)
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === new Date().toDateString()) return t
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${t}`
}
