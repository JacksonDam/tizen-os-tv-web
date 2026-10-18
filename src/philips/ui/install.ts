import type { RemoteKey } from '../../input/remote'
import { F, type Juice, W } from '../fw/juice'
import { numberLineup, searchAerial, type TvChannel } from '../tv/lineup'
import { getTv, setTv, tune } from '../tv/store'
import { getProp, setProp, type TvEnv } from './env'
import { registerMenuAction } from './menu'
import { P } from './props'
import { cancelTimer, hide, repaint, show, timer, type Screen } from './screens'

// Installation (TV menu > Installation > Channel installation): the wizard panel#149 in its frame
// panel#194 (header panel#195 "Television" with the PHILIPS logo status#470, body panel#196, footer
// panel#199) and its steps, as in the Polish 42PFL5603D/12 footage: country panel#157 (list#132,
// property 0x329), start panel#154 ("You can now start automatic installation...", dynamic string
// 1966), searching panel#152 (status#393 "System searching. Please wait...", digital / analogue
// channels found #395 / #396 = properties 0x32a / 0x32b, progress slider#35 = property 0x32e, red
// "Stop" #399), completed panel#153 (#400 / #401 counts, #403 "First analogue channel:" = property
// 0x3a7, #404 the Rearrange remark, legends list#128 / list#129 on property 0x2cf, value 6 = Previous /
// Finish) and stopped panel#169. The antenna / cable step panel#156 and the time zone steps
// panel#155 / panel#158 are skipped for this country (DVB-T only; time zones in Spain / Australia),
// as in the footage. Installation update: panel#219 (frame panel#220; start panel#226, searching
// panel#227, stopped panel#228, completed panel#229; digital added / analogue added / digital removed
// = properties 0x371 / 0x372 / 0x373).
//
// The search is mocked: it steps through UHF 21..69 of the museum's aerial (../tv/lineup.ts), storing
// the digital services (TV and radio) and the analogue stations it passes. The set takes about
// 2 minutes for the band in the footage (0:04 to 2:13); the exhibit does one UHF channel every 500 ms
// (inferred, shortened).

const STEP_MS = 500
const PR = { digital: 0x32a, analogue: 0x32b, progress: 0x32e, firstAnalogue: 0x3a7, legend: 0x2cf, stopA: 0x2d0, stopB: 0x2d1 }
const PU = { digitalAdded: 0x371, analogueAdded: 0x372, digitalRemoved: 0x373 }

class Search {
  steps = searchAerial()
  i = 0
  digital: TvChannel[] = []
  analogue: TvChannel[] = []
  get done() {
    return this.i >= this.steps.length
  }
  get progress() {
    return Math.round((100 * this.i) / this.steps.length)
  }
  step() {
    const s = this.steps[this.i++]
    if (!s) return
    // data services are not stored as channels and not counted (inferred)
    this.digital.push(...s.digital.filter(c => c.kind !== 'data'))
    this.analogue.push(...s.analogue)
  }
  run(name: string, onStep: () => void, onDone: () => void) {
    const tick = () => {
      this.step()
      onStep()
      repaint()
      if (this.done) onDone()
      else timer(name, STEP_MS, tick)
    }
    timer(name, STEP_MS, tick)
  }
}

function finish(channels: TvChannel[]) {
  // store the new channel list and watch its first channel (the footage returns to TV on channel 1)
  setTv(s => ({ channels, channel: 0, prevChannel: 0, source: 'TV', zapSeq: s.zapSeq }))
  for (const n of ['install', 'menu', 'home']) hide(n)
  tune(0)
}

// ---- automatic installation (wizard panel#149) ----
type Step = 'country' | 'start' | 'search' | 'stopped' | 'done'
const STEP_PANEL: Record<Step, number> = { country: 157, start: 154, search: 152, stopped: 169, done: 153 }
const STEPS_ALL = [156, 157, 158, 155, 154, 159, 152, 169, 153]

export class Installation implements Screen {
  name = 'install'
  layer = 12
  covers = true
  modal = true
  step: Step = 'country'
  search = new Search()
  top = 0

  draw(j: Juice, env: TvEnv) {
    for (const p of STEPS_ALL) if (p !== STEP_PANEL[this.step]) env.hidden.add(W('panel', p))
    // the application shows the current step (its panels do not activate with the frame)
    env.show(W('panel', STEP_PANEL[this.step]))
    // the other wizards of panel#149 (first-time language, location, settings assistant)
    for (const p of [150, 170, 180, 187, 208, 207, 193]) env.hidden.add(W('panel', p))
    const s = this.search
    // "Digital channels found" counts the TV services: the Polish footage ends with 13 found and the
    // first analogue channel at 21, the radio services being numbered before the analogue ones (inferred)
    env.overrides.set(PR.digital, s.digital.filter(c => c.kind === 'tv').length)
    env.overrides.set(PR.analogue, s.analogue.length)
    env.overrides.set(PR.progress, s.progress)
    switch (this.step) {
      case 'country': {
        const lw = W('list', 132)
        const ids = j.listValueIds(lw)
        const f = Math.max(0, ids.indexOf(getProp(P.country)))
        const rows = j.listRows(lw)
        if (f < this.top) this.top = f
        if (f >= this.top + rows) this.top = f - rows + 1
        env.lists.set(lw, { focus: f, top: this.top, expanded: true })
        break
      }
      case 'start':
        env.hidden.add(W('status', 407)) // "Settings": the cable network settings (DVB-C only)
        break
      case 'search':
        // the title "System searching. Please wait..." is shown by the application; "Sorting...",
        // "Channels found" (analogue-only countries) and "Network name:" (cable) are not
        env.show(W('status', 393))
        for (const w of [394, 397, 398]) env.hidden.add(W('status', w))
        break
      case 'stopped':
        env.hidden.add(W('status', 439))
        env.hidden.add(W('status', 440))
        env.hidden.add(W('status', 441))
        env.overrides.set(PR.stopA, 6) // red: Finish (inferred)
        env.overrides.set(PR.stopB, 7) // green: Restart (inferred)
        break
      case 'done':
        env.hidden.add(W('status', 402))
        if (s.analogue.length) env.overrides.set(PR.firstAnalogue, numberLineup(s.digital, []).length + 1)
        else env.hidden.add(W('status', 403))
        env.overrides.set(PR.legend, 6) // red Previous, green Finish (footage: "Poprzedni", "Zakończenie")
        break
    }
    j.draw(W('panel', 194), 0, 0, F.FOCUS)
  }

  startSearch() {
    cancelTimer('install')
    this.search = new Search()
    this.step = 'search'
    this.search.run('install', () => {}, () => {
      this.step = 'done'
    })
  }

  key(k: RemoteKey) {
    switch (this.step) {
      case 'country': {
        const ids = this.countryIds()
        const f = Math.max(0, ids.indexOf(getProp(P.country)))
        if (k === 'Up' || k === 'Down') setProp(P.country, ids[Math.max(0, Math.min(ids.length - 1, f + (k === 'Down' ? 1 : -1)))])
        else if (k === 'Green' || k === 'Enter' || k === 'Right') this.step = 'start'
        else if (k === 'Red' || k === 'Left' || k === 'Back') hide('install')
        break
      }
      case 'start':
        if (k === 'Green' || k === 'Enter') this.startSearch()
        else if (k === 'Red' || k === 'Back' || k === 'Left') this.step = 'country'
        else if (k === 'Blue') hide('install') // Skip
        break
      case 'search':
        if (k === 'Red') {
          cancelTimer('install')
          this.step = 'stopped'
        }
        break
      case 'stopped':
        if (k === 'Red') finish(numberLineup(this.search.digital, this.search.analogue))
        else if (k === 'Green') this.startSearch()
        break
      case 'done':
        if (k === 'Green' || k === 'Enter') finish(numberLineup(this.search.digital, this.search.analogue))
        else if (k === 'Red') this.step = 'start'
        break
    }
    if (k === 'Settings' || k === 'Exit') {
      if (this.step !== 'search') {
        cancelTimer('install')
        hide('install')
      }
    }
    return true
  }
  countryIds: () => number[] = () => []
}

// ---- installation update (panel#219) ----
type UStep = 'start' | 'search' | 'stopped' | 'done'
const USTEP_PANEL: Record<UStep, number> = { start: 226, search: 227, stopped: 228, done: 229 }

const key = (c: TvChannel) => `${c.analogue ? 'a' : 'd'}:${c.rf}:${c.name}`

export class InstallationUpdate implements Screen {
  name = 'install'
  layer = 12
  covers = true
  modal = true
  step: UStep = 'start'
  search = new Search()

  counts() {
    const stored = new Set(getTv().channels.map(key))
    const found = [...this.search.digital, ...this.search.analogue]
    const seen = new Set(found.map(key))
    const scanned = new Set(this.search.steps.slice(0, this.search.i).map(s => s.rf))
    return {
      digitalAdded: this.search.digital.filter(c => !stored.has(key(c))).length,
      analogueAdded: this.search.analogue.filter(c => !stored.has(key(c))).length,
      digitalRemoved: getTv().channels.filter(c => !c.analogue && c.rf !== undefined && scanned.has(c.rf) && !seen.has(key(c))).length,
    }
  }

  draw(j: Juice, env: TvEnv) {
    for (const p of Object.values(USTEP_PANEL)) if (p !== USTEP_PANEL[this.step]) env.hidden.add(W('panel', p))
    env.show(W('panel', 220))
    env.show(W('panel', USTEP_PANEL[this.step]))
    env.hidden.add(W('panel', 230))
    // "Channels added :" is the analogue-only countries' line (inferred)
    for (const w of [505, 510, 516]) env.hidden.add(W('status', w))
    const c = this.counts()
    env.overrides.set(PU.digitalAdded, c.digitalAdded)
    env.overrides.set(PU.analogueAdded, c.analogueAdded)
    env.overrides.set(PU.digitalRemoved, c.digitalRemoved)
    env.overrides.set(PR.progress, this.search.progress)
    j.draw(W('panel', 219), 0, 0, F.FOCUS)
  }

  startSearch() {
    cancelTimer('install')
    this.search = new Search()
    this.step = 'search'
    this.search.run('install', () => {}, () => {
      this.step = 'done'
    })
  }

  // the update keeps the stored channels and their numbers and adds the new ones after them
  result() {
    const stored = getTv().channels
    const have = new Set(stored.map(key))
    const added = [...this.search.digital, ...this.search.analogue].filter(c => !have.has(key(c)))
    const n = stored.length
    return [...stored, ...added.map((c, i) => ({ ...c, number: n + i + 1 }))]
  }

  key(k: RemoteKey) {
    switch (this.step) {
      case 'start':
        if (k === 'Green' || k === 'Enter') this.startSearch()
        else if (k === 'Red' || k === 'Back' || k === 'Left') hide('install')
        break
      case 'search':
        if (k === 'Red') {
          cancelTimer('install')
          this.step = 'stopped'
        }
        break
      case 'stopped':
        if (k === 'Red') finish(this.result())
        else if (k === 'Green') this.startSearch()
        break
      case 'done':
        if (k === 'Green' || k === 'Red' || k === 'Enter') finish(this.result())
        break
    }
    if ((k === 'Settings' || k === 'Exit') && this.step !== 'search') {
      cancelTimer('install')
      hide('install')
    }
    return true
  }
}

// TV menu > Installation > Channel installation > Automatic installation ("Start now", button#6 of
// panel#101) and Installation update (button#7)
export function registerInstallation(j: Juice) {
  registerMenuAction(115, () => {
    const s = new Installation()
    s.countryIds = () => j.listValueIds(W('list', 132))
    show(s)
  })
  registerMenuAction(116, () => show(new InstallationUpdate()))
}
