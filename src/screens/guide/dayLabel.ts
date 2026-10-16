// Date labels of the Guide and View Details: "Today" / "Tomorrow" / "Yesterday" (SID_TODAY, SID_TOMORROW,
// COM_YESTERDAY in epg.mo), else "Fri 17 Oct" from the epg.mo day and month abbreviations (format inferred).

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayLabel(t: number, now = Date.now()) {
  const a = new Date(t)
  a.setHours(0, 0, 0, 0)
  const b = new Date(now)
  b.setHours(0, 0, 0, 0)
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return `${DAYS[a.getDay()]} ${a.getDate()} ${MONTHS[a.getMonth()]}`
}
