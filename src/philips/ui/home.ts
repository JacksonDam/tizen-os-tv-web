import type { RemoteKey } from '../../input/remote'
import { F, type Juice, W } from '../fw/juice'
import type { TvEnv } from './env'
import { openChannelList } from './chlist'
import { openGuide } from './guide'
import { openMenu } from './menu'
import { hide, repaint, show, type Screen } from './screens'

// MENU: the browser of the 2008 sets (panel#469): "Television" with its list (list#275: TV menu,
// Channel list, Programme guide; Guest menu is the hotel set's) and "Multimedia" (dgrid#29, the
// USB browser; empty without a device). The PHILIPS logo sits in the right pane (status#956).

export const HOME = W('panel', 469)
const LIST = W('list', 275)
// list#275 values: 8 TV menu, 9 Guest menu, 0 Channel list, 5/7/4/6 Programme guide (one per guide
// source); this set shows TV menu, Channel list and the DVB programme guide (inferred: 5).
const ITEMS = [8, 0, 5]

export class HomeScreen implements Screen {
  name = 'home'
  covers = true
  layer = 10
  modal = true
  focus = 0
  j: Juice
  open: (item: number) => void

  constructor(j: Juice, open: (item: number) => void) {
    this.j = j
    this.open = open
  }

  draw(j: Juice, env: TvEnv) {
    // the network logo and the hotel/USB rows are other models' (connectedplanet: Net TV sets)
    for (const w of [W('status', 955), W('panel', 467)]) env.hidden.add(w)
    const ids = j.listValueIds(LIST)
    env.lists.set(LIST, { focus: ids.indexOf(ITEMS[this.focus]), top: 0, expanded: true })
    env.allowedValues.set(LIST, new Set(ITEMS))
    env.overrides.set(j.prop(LIST), ITEMS[this.focus])
    j.draw(HOME, 0, 0, F.FOCUS)
  }

  key(k: RemoteKey) {
    switch (k) {
      case 'Up': this.focus = Math.max(0, this.focus - 1); return true
      case 'Down': this.focus = Math.min(ITEMS.length - 1, this.focus + 1); return true
      case 'Enter':
      case 'Right': this.open(ITEMS[this.focus]); return true
      case 'Settings':
      case 'Back':
      case 'Exit': hide('home'); return true
    }
    return false
  }
}

export function openHome(j: Juice) {
  const h = new HomeScreen(j, item => {
    if (item === 8) {
      hide('home')
      const m = openMenu(j)
      m.onExit = () => {
        hide('menu')
        openHome(j)
      }
    } else if (item === 0) {
      hide('home')
      openChannelList()
    } else if (item === 5) {
      hide('home')
      openGuide()
    }
    repaint()
  })
  show(h)
}
