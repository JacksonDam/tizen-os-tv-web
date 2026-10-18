import type { RemoteKey } from '../../input/remote'
import { hhmm, nextProgramme, programmeAt } from '../../tv/channels'
import { F, type Juice, W } from '../fw/juice'
import { currentChannel, getTv, setSource, tune } from '../tv/store'
import { strings, type TvEnv } from './env'
import { P } from './props'
import { hide, isShown, repaint, show, timer, type Screen } from './screens'
import { INPUTS, inputName } from './sources'

// The OSD manager's overlays (osdman#0 children; positions from JuiceOsdManagers +0x10 entries):
// volume bar panel#327 (slider#43, property 0x588), mute icon panel#294 at (33,32) (list#163, property
// 0x5a4: 11 muted / 12), the zapping banner panel#296, the messages panel#328..330 at (567,0), the
// input list panel#304. Time-outs are inferred (not traced).

const OSDMAN: Record<number, [number, number]> = { 294: [33, 32], 328: [567, 0], 329: [567, 0], 330: [567, 0] }
function at(p: number): [number, number] {
  return OSDMAN[p] ?? [0, 0]
}

// ---- volume and mute ----
export class VolumeOsd implements Screen {
  name = 'volume'
  layer = 40
  draw(j: Juice) {
    j.draw(W('panel', 327), 0, 0, F.FOCUS)
  }
}
export class MuteOsd implements Screen {
  name = 'mute'
  layer = 41
  draw(j: Juice, env: TvEnv) {
    env.overrides.set(0x5a4, 11)
    const [x, y] = at(294)
    j.draw(W('panel', 294), x, y, 0)
  }
}
export function volumeChanged() {
  const s = getTv()
  if (s.muted) {
    show(new MuteOsd())
    hide('volume')
    return
  }
  hide('mute')
  show(new VolumeOsd())
  timer('volume', 3000, () => hide('volume'))
}

// ---- banner (panel#296: panel#297 programme bars, panel#302 details with INFO) ----
export class Banner implements Screen {
  name = 'banner'
  layer = 30
  details: boolean
  constructor(details: boolean) {
    this.details = details
  }
  draw(j: Juice, env: TvEnv) {
    const s = getTv()
    const ch = currentChannel(s)
    // status values: 0x298 "number | name | programme", 0x2aa now times, 0x2ac "Next: ...", 0x2ae next
    // times, 0x6da clock (strings as in the Polish footage: "8 | TVN Siedem | ...", "Następn.: ...")
    const now = new Date()
    if (s.source !== 'TV' || !ch) {
      env.values.set(W('status', 628), inputName(s.source))
      for (const w of [W('panel', 301), W('status', 630)]) env.hidden.add(w)
    } else if (ch.kind === 'data') {
      env.values.set(W('status', 628), `${ch.number} | ${ch.name}`)
      for (const w of [W('panel', 301), W('status', 630)]) env.hidden.add(w)
    } else {
      const p = programmeAt(ch, now)
      const n = nextProgramme(ch, now)
      env.values.set(W('status', 628), ch.analogue ? `${ch.number} | ${ch.name}` : `${ch.number} | ${ch.name} | ${p.title}`)
      env.values.set(W('status', 630), `${hhmm(p.start)} - ${hhmm(p.end)}`)
      env.values.set(W('status', 637), `${strings.get(1061)} ${n.title}`)
      env.values.set(W('status', 639), `${hhmm(n.start)} - ${hhmm(n.end)}`)
      if (ch.analogue) for (const w of [W('panel', 301), W('status', 630)]) env.hidden.add(w)
    }
    env.values.set(W('status', 634), hhmm(now))
    // the icon rows (mute, sound, subtitle and teletext indicators) stay empty: the Polish banner
    // footage shows none for its broadcasts (inferred)
    for (const w of [W('list', 164), W('list', 165), W('list', 166), W('list', 167), W('status', 635), W('status', 636), W('status', 640)]) env.hidden.add(w)
    if (!this.details) env.hidden.add(W('panel', 302))
    else {
      env.values.set(W('status', 641), strings.get(62)) // List: All channels
      env.values.set(W('status', 642), '')
      env.values.set(W('status', 643), '')
      env.values.set(W('status', 644), '')
      env.hidden.add(W('slider', 42))
    }
    void P
    j.draw(W('panel', 296), 0, 0, 0)
  }
}
export function showBanner(details = false) {
  // the picture messages share the top right corner with the banner and return after it
  hide('message')
  show(new Banner(details))
  timer('banner', details ? 8000 : 4000, () => {
    hide('banner')
    updateMessage()
  })
}

// ---- messages ----
// panel#328 "No programme available", panel#329 "No video signal", panel#330 "Unsupported video format"
export class Message implements Screen {
  name = 'message'
  layer = 20
  panel: number
  constructor(panel: number) {
    this.panel = panel
  }
  draw(j: Juice) {
    const [x, y] = at(this.panel)
    j.draw(W('panel', this.panel), x, y, 0)
  }
}
export function updateMessage() {
  const s = getTv()
  let p = 0
  if (s.source !== 'TV') {
    if (!INPUTS.find(i => i.id === s.source)?.video) p = 329
  } else {
    const ch = currentChannel(s)
    if (!ch) p = 328
    else if (ch.kind === 'tv' && ch.hd && !ch.analogue) p = 330
  }
  if (p && !isShown('banner')) show(new Message(p))
  else hide('message')
}

// ---- input list (SOURCE: panel#304 "Select input", dgrid#12 of status#648 names) ----
export class SourceList implements Screen {
  name = 'sources'
  layer = 25
  modal = true
  focus: number
  items = ['TV', ...INPUTS.map(i => i.id)]
  constructor() {
    this.focus = Math.max(0, this.items.indexOf(getTv().source))
  }
  draw(j: Juice, env: TvEnv) {
    const g = W('dgrid', 12)
    env.gridState.set(g, { count: this.items.length, focus: this.focus, top: Math.max(0, this.focus - 7) })
    env.cells.set(W('status', 648), row => inputName(this.items[row]))
    j.draw(W('panel', 304), 0, 0, F.FOCUS)
  }
  key(k: RemoteKey) {
    switch (k) {
      case 'Up': this.focus = Math.max(0, this.focus - 1); break
      case 'Down': this.focus = Math.min(this.items.length - 1, this.focus + 1); break
      case 'Enter':
      case 'Right': {
        const id = this.items[this.focus]
        hide('sources')
        if (id === 'TV') tune(getTv().channel)
        else setSource(id)
        break
      }
      case 'Source':
      case 'Back':
      case 'Exit':
      case 'Settings':
        hide('sources')
        break
      default:
        return false
    }
    timer('sources', 10000, () => hide('sources'))
    return true
  }
}
export function openSources() {
  if (isShown('sources')) return
  show(new SourceList())
  timer('sources', 10000, () => hide('sources'))
  repaint()
}
