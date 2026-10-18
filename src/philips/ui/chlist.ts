import type { RemoteKey } from '../../input/remote'
import { F, type Juice, W } from '../fw/juice'
import type { TvChannel } from '../tv/lineup'
import { getTv, tune } from '../tv/store'
import { strings, type TvEnv } from './env'
import { hide, isShown, repaint, show, timer, type Screen } from './screens'

// Channel list (OK while watching): panel#305 in its overlay form panel#315. The header bar (status#666)
// carries the list name (status#667, property 0x279); the count is the scroll bar's total (scroll bar
// 21 of dgrid#15, juicesbc__sb_ScrollBarDrawnbyN). Rows of dgrid#15: number status#668, icons
// list#173, name status#669); the red key opens the list choice (panel#318: list#174 All / Digital /
// Radio / Analogue / Favourites 1-4) and status#675 is the help line (string 271).

// list#174 values: 13 All, 33 Digital, 34 Radio, 37 Analogue, 36 / 0 / 1 / 2 Favourites 1-4 (empty:
// no favourites are set in the exhibit)
type ListId = 13 | 33 | 34 | 37 | 36 | 0 | 1 | 2
const LIST_IDS: ListId[] = [13, 33, 34, 37, 36, 0, 1, 2]

function members(l: ListId, chs: TvChannel[]) {
  switch (l) {
    case 33: return chs.filter(c => !c.analogue && c.kind === 'tv')
    case 34: return chs.filter(c => c.kind === 'radio')
    case 37: return chs.filter(c => c.analogue)
    case 13: return chs.filter(c => c.kind !== 'data')
    default: return []
  }
}

export class ChannelList implements Screen {
  name = 'chlist'
  layer = 25
  osd = 305
  modal = true
  list: ListId = 13
  row = 0
  top = 0
  choosing = false
  choice = 0

  constructor() {
    this.sync()
  }
  rows() {
    return members(this.list, getTv().channels)
  }
  sync() {
    const s = getTv()
    const r = this.rows()
    this.row = Math.max(0, r.indexOf(s.channels[s.channel]))
    this.top = Math.max(0, this.row - 3)
  }

  draw(j: Juice, env: TvEnv) {
    const r = this.rows()
    env.hidden.add(W('panel', 306)) // the favourite list editor
    env.hidden.add(W('panel', 316)) // "Empty"
    if (!r.length) env.hidden.delete(W('panel', 316))
    for (const w of [W('status', 671), W('status', 672), W('list', 175), W('list', 176), W('status', 676), W('list', 173)]) env.hidden.add(w)
    // the list choice (red key): the application shows list#174 in panel#318; the rows and the help line give way to it (inferred: the list has no opaque
    // background of its own, state style 178 is a frame)
    // the red key's legend "Select list" (status#677) is up whenever the list is (Polish footage:
    // "Wybierz listę")
    env.show(W('status', 677))
    if (this.choosing) {
      env.show(W('list', 174))
      for (const w of [W('dgrid', 15), W('status', 675), W('panel', 317)]) env.hidden.add(w)
    }
    // the list name: the caption of its value in list#174
    const lw0 = W('list', 174)
    env.values.set(W('status', 667), env.str(j.listCaptions(lw0)[j.listValueIds(lw0).indexOf(this.list)]))
    env.values.set(W('status', 674), '')
    env.values.set(W('status', 675), strings.get(271))
    const g = W('dgrid', 15)
    env.gridState.set(g, { count: r.length, focus: this.choosing ? -1 : this.row, top: this.top })
    env.cells.set(W('status', 668), row => r[row]?.number)
    env.cells.set(W('status', 669), row => r[row]?.name)
    const lw = W('list', 174)
    const ids = j.listValueIds(lw)
    env.lists.set(lw, { focus: this.choice, top: 0, expanded: true })
    env.overrides.set(j.prop(lw), ids[this.choice])
    j.draw(W('panel', 305), 0, 0, F.FOCUS)
  }

  key(k: RemoteKey) {
    timer('chlist', 15000, () => hide('chlist'))
    if (this.choosing) {
      const ids = LIST_IDS
      if (k === 'Up') this.choice = Math.max(0, this.choice - 1)
      else if (k === 'Down') this.choice = Math.min(ids.length - 1, this.choice + 1)
      else if (k === 'Enter' || k === 'Right') {
        this.list = ids[this.choice]
        this.choosing = false
        this.sync()
      } else if (k === 'Back' || k === 'Left' || k === 'Red') this.choosing = false
      return true
    }
    const r = this.rows()
    switch (k) {
      case 'Up': this.row = Math.max(0, this.row - 1); break
      case 'Down': this.row = Math.min(r.length - 1, this.row + 1); break
      case 'ChannelUp': this.row = Math.max(0, this.row - 8); break
      case 'ChannelDown': this.row = Math.min(r.length - 1, this.row + 8); break
      case 'Enter': {
        const ch = r[this.row]
        hide('chlist')
        if (ch) tune(getTv().channels.indexOf(ch))
        return true
      }
      case 'Red':
        this.choosing = true
        this.choice = Math.max(0, LIST_IDS.indexOf(this.list))
        return true
      case 'Back':
      case 'Exit':
      case 'Settings':
      case 'ChannelList':
        hide('chlist')
        return true
      default:
        return true
    }
    if (this.row < this.top) this.top = this.row
    if (this.row >= this.top + 8) this.top = this.row - 7
    return true
  }
}

export function openChannelList() {
  if (isShown('chlist')) return
  show(new ChannelList())
  timer('chlist', 15000, () => hide('chlist'))
  repaint()
}
