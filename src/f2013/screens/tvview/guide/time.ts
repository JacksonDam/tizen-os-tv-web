import { L } from './layout'

// Date and time texts of the Guide.
// CCountryUtil::GetDateTimeStr(PTTime*, ushort*, uint, int) @ 018c6f50 picks a strftime-like pattern by
// target location; for a European set we use location 3 (inferred: the 24-hour, day-before-month
// group): 1 = date "%a %d %b", 2 = time "%h:%N", 4 = date and time "%h:%N %a %d %b".

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// EpgUtilBase::GetDayOfWeekTextId -> g_EPGWStringEng 64 Sunday, 29 Monday, 71 Tuesday, 77 Wednesday,
// 65 Thursday, 19 Friday, 53 Saturday.
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const p2 = (n: number) => String(n).padStart(2, '0')

export function timeStr(t: number) {
  const d = new Date(t)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function dateStr(t: number) {
  const d = new Date(t)
  return `${WEEKDAY_ABBR[d.getDay()]} ${p2(d.getDate())} ${MONTH_ABBR[d.getMonth()]}`
}

// EpgUtilBase::MakeCurrentTimeStr: GetDateTimeStr(.., 4) once the clock is set.
export function currentTimeStr(t: number) {
  return `${timeStr(t)} ${dateStr(t)}`
}

function dayKey(t: number) {
  const d = new Date(t)
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate()
}
function nextDay(t: number) {
  const d = new Date(t)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}
function startOfDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// CEpgFullMain::t_GetAndSetDayText(now, pageStart) @ 02798e6c: the two day labels over the time bar
// (the second one, and its arrow, only when the page reaches into another day one hour in).
// focusStart = start of the focused programme. Strings: 120 'On Now', 68 'Today', 69 'Tomorrow'.
export function dayTexts(now: number, pageStart: number, focusStart: number): [string, string] {
  const later = pageStart + L.SCROLL_TIME * 1000
  const today = dayKey(now)
  const tomorrow = dayKey(nextDay(now))
  const onNow = !(now < focusStart || pageStart + L.PAGE_TIME * 1000 < now) ? 'On Now' : 'Today'
  if (dayKey(pageStart) === today) {
    if (dayKey(later) === today) return [onNow, '']
    if (dayKey(later) === tomorrow) return [onNow, 'Tomorrow']
  }
  if (dayKey(pageStart) === tomorrow && dayKey(later) === tomorrow) return ['Tomorrow', '']
  const weekday = new Date(now).getDay()
  const days = Math.round((startOfDay(pageStart) - startOfDay(now)) / 86400000)
  const name = (t: number) => (days > 7 - weekday ? dateStr(t) : WEEKDAY[new Date(t).getDay()])
  const a = name(pageStart)
  const b = dayKey(later) !== dayKey(pageStart) ? name(later) : ''
  return [a, b]
}
