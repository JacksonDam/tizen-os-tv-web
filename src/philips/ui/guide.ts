import type { RemoteKey } from '../../input/remote'
import { hhmm, nextProgramme, programmeAt, type GuideProgramme } from '../../tv/channels'
import { F, type Juice, W } from '../fw/juice'
import { getTv, tune } from '../tv/store'
import { strings, type TvEnv } from './env'
import { hide, repaint, show, timer, type Screen } from './screens'

// Programme guide (GUIDE): panel#942, the now / next guide of the DVB EIT. Header panel#949 (title,
// "Around" time, date and clock), rows dgrid#39 (cells: channel status#1470, now time #1471 and title
// #1473, next time #1474 and title #1476), footer panel#947 (Remind / Watch / Jump to / Info) and the
// focused programme in panel#950. Programmes come from the museum's shared guide (src/tv/channels.ts).

const WD = [492, 983, 1200, 307, 682, 1195, 894] // Sun..Sat abbreviations
const MON = [517, 490, 491, 993, 994, 1077, 1130, 845, 186, 588, 1178, 345]
export function shortDate(d: Date) {
  return `${strings.get(WD[d.getDay()])}, ${d.getDate()} ${strings.get(MON[d.getMonth()])}`
}

export class Guide implements Screen {
  name = 'guide'
  covers = true
  layer = 10
  modal = true
  row: number
  col = 0
  top = 0
  chans = getTv().channels.filter(c => c.kind !== 'data')

  constructor() {
    const cur = getTv().channels[getTv().channel]
    this.row = Math.max(0, this.chans.indexOf(cur))
    this.top = Math.max(0, this.row - 7)
  }

  prog(i: number, col: number): GuideProgramme | undefined {
    const ch = this.chans[i]
    if (!ch || ch.analogue) return undefined
    const now = new Date()
    return col === 0 ? programmeAt(ch, now) : nextProgramme(ch, now)
  }

  draw(j: Juice, env: TvEnv) {
    const now = new Date()
    env.hidden.add(W('panel', 951)) // the Jump to day list
    // the reminder marks of the now / next cells (properties 0x808 / 0x807): no reminders are set
    env.hidden.add(W('status', 1472))
    env.hidden.add(W('status', 1475))
    const g = W('dgrid', 39)
    env.gridState.set(g, { count: this.chans.length, focus: this.row, top: this.top })
    const text = (col: number, f: (p: GuideProgramme) => string) => (row: number) => {
      const p = this.prog(row, col)
      return p ? f(p) : strings.get(665) // "No broadcast" in both columns (Polish footage: "Brak transmisji")
    }
    env.cells.set(W('status', 1470), row => this.chans[row]?.name)
    env.cells.set(W('status', 1471), row => { const p = this.prog(row, 0); return p ? hhmm(p.start) : '' })
    env.cells.set(W('status', 1473), text(0, p => p.title))
    env.cells.set(W('status', 1474), row => { const p = this.prog(row, 1); return p ? hhmm(p.start) : '' })
    env.cells.set(W('status', 1476), text(1, p => p.title))
    // the focus bar of a row is the now column's (status#1471 text background, state style 195);
    // the next column has none, so the cursor moves over channels only (as in the Polish footage)
    env.values.set(W('status', 1462), hhmm(now))
    env.values.set(W('status', 1463), shortDate(now))
    env.values.set(W('status', 1464), hhmm(now))
    const p = this.prog(this.row, this.col)
    const ch = this.chans[this.row]
    env.values.set(W('status', 1466), p ? hhmm(p.start) : '')
    env.values.set(W('status', 1467), p ? p.title : '')
    env.values.set(W('status', 1468), '')
    env.values.set(W('status', 1469), ch ? `${ch.number} ${ch.name}` : '')
    j.draw(W('panel', 942), 0, 0, F.FOCUS)
  }

  key(k: RemoteKey) {
    const n = this.chans.length
    switch (k) {
      case 'Up':
        this.row = Math.max(0, this.row - 1)
        break
      case 'Down':
        this.row = Math.min(n - 1, this.row + 1)
        break
      case 'ChannelUp':
        this.row = Math.max(0, this.row - 8)
        break
      case 'ChannelDown':
        this.row = Math.min(n - 1, this.row + 8)
        break
      case 'Enter':
      case 'Green': {
        const ch = this.chans[this.row]
        hide('guide')
        if (ch) tune(getTv().channels.indexOf(ch))
        return true
      }
      case 'Guide':
      case 'Back':
      case 'Exit':
      case 'Settings':
        hide('guide')
        return true
      default:
        return true
    }
    if (this.row < this.top) this.top = this.row
    if (this.row >= this.top + 8) this.top = this.row - 7
    return true
  }
}

export function openGuide() {
  show(new Guide())
  timer('guide-clock', 60000, () => repaint())
  repaint()
}
