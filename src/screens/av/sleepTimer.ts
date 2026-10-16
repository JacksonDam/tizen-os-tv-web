import { useSyncExternalStore } from 'react'

// Sleep Timer countdown shared by the timer overlay and the Quick Settings tile. The TV counts from the
// moment a value is chosen and forgets the timer when it turns off (menu/system/time/sleeptimer).
// `?timerspeed=<n>` runs every timer n times faster (testing aid, like ?scanspeed).

export const TIMER_SPEED = Math.max(
  1,
  Number(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('timerspeed') : 1) || 1,
)

let deadline = 0 // epoch ms; 0 = off
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

export function startSleep(minutes: number) {
  deadline = minutes > 0 ? Date.now() + (minutes * 60_000) / TIMER_SPEED : 0
  emit()
}

export function sleepLeftMs() {
  return deadline ? Math.max(0, deadline - Date.now()) * TIMER_SPEED : 0
}

// whole minutes left, rounded up (the Quick Settings "{0} min remaining" subtitle)
export function sleepLeftMinutes() {
  const ms = sleepLeftMs()
  return ms ? Math.ceil(ms / 60_000) : 0
}

setInterval(() => {
  if (deadline) emit()
}, 1000)

export function useSleepLeftMinutes() {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    sleepLeftMinutes,
  )
}
