import { useSyncExternalStore } from 'react'
import type { RemoteKey } from '../../input/remote'
import { PH } from '../assets'
import { F, type Juice, W } from '../fw/juice'
import { getTv, setTv, subscribeTv } from '../tv/store'
import { setProp, type TvEnv } from './env'
import { P } from './props'
import { cancelTimer, hide, repaint, show, timer, tvKeys, type Screen } from './screens'

// The Settings assistant of mtv522eu (ceapsltv, properties 0x5e..0x69 through ceapsltv__sltvapi_*,
// CeapPropRangeValues index 2; table 0xb8bbc0, Set jump table 0x10053968, Get 0x10053994) and its
// OSD panel#208 (child of the wizard panel#149 at (133,240)), driven by the panels' event-action
// tables like the Demo.
//
// - Entry points: TV menu > TV settings > Settings assistant ("Start now", button#9 of panel#131)
//   sets property 0x63 (mode 0, menu): event 0x4238 makes panel#15 focus the empty panel#218 in
//   place of the TV menu. The installation wizard sets property 0x62 (mode 1) from its frame
//   panel#194 (OK / green at "Channel search completed", key group 0x805e, when installation property
//   0x2cc holds; the blue "Skip" of the start step), from panel#201 and from the end screen panel#217
//   (red "Previous"). Those rules only see the keys of a first-time installation: in a menu
//   installation, the one the exhibit has (install.ts), the steps consume them and return to the
//   menu (condition property 0x2ce), so mode 1 is not reachable here. Features > Demo > Settings assistant
//   sets property 0x65 (mode 2, see startSltvDemo).
// - The steps come from the decision tree Jaguar3rdSpin_Tree (0x100b59b0, 768 nodes of 0x2c bytes,
//   exported to public/philips/fw/sltv-tree.json): each node has an image, music and video file,
//   a section (0 welcome, 1 picture, 2 sound, 3 Ambilight, 4 finish), its left (A) and right (B)
//   children and the settings chosen so far as {property, value} pairs. A step shows the current
//   node's two children side by side; Left / Right pick one (property 0x68: list#151 "Left side" 1 /
//   "Right side" 5, list#152 "Sound A" / "Sound B"), green / OK goes to the picked child's children.
//   The path from the root: Welcome.jpg, Level1..5.jpg (brightness 0 / -15, contrast -25 / 0,
//   colour 0 / 10, colour 0 / 1 or 10 / 11, sharpness 0 / 1), Audio1.jpg and Audio2.jpg with
//   Audio.mp3 (equalizer bands -2 -2 0 0 0 / 2 2 0 2 4, then -6 -4 0 0 0 or 6 4 0 2 4), Video.mpeg
//   (Ambilight, section 3) and Level3.jpg (finish).
// - Per section (table 0x100a154c {section, display A, display B, u8 images, u8 music, u8 video,
//   u16 event}): 0 one picture full screen (display record 3: 1366x768) and event 0x41a1 (panel#209
//   "With the settings assistant you can choose ..."), 1 two pictures, the A candidate on the left
//   half (display 1: 683x768 at x 0) and the B candidate on the right half (display 2: at x 683),
//   event 0x4033 (panel#211 with the dividing line panel#212 and "Select the picture setting that
//   you prefer."), 2 one picture and the music, event 0x4277 (panel#213), 3 the video, event 0x4032
//   (panel#214, Ambilight), 4 one picture, event 0x41a0 (panel#215 "The TV has learned your
//   preferences."). The image players (pamtd type 7) get the candidate's picture settings, the music
//   player (type 6) its equalizer bands. A step is shown when all its players report ready.
// - Sections not available are skipped along the left children (apsltvdiv_IsSectionAvailable:
//   section 3 needs NVM option byte 0x30, Ambilight; this set has none), so the 42PFL5603D has 7
//   steps: "1/7".."7/7" (property 0x61, "%d/%d") under the step texts.
// - Legends (panel#216): red list#154 (0x64) "Previous", green list#155 (0x5e) "Next" (3) or, on the
//   finish screen, "Store" (8), yellow list#156 (0x5f) none (6), blue list#157 (0x60) "Cancel" (7).
//   Green / OK (key group 0x80d5) on the finish screen stores the finish node's settings: picture
//   (apsltvdiv_ConvertSltvParameter against the profile items of cetvatv__pobs_GetProfileItem(2):
//   brightness + trunc(4v / 15), contrast + trunc(0.6v), colour + 5 for 1 and 10 / + 10 for 11,
//   sharpness - 2 for 1, at most 100) through vctl, sound through pactl2(0x1d, band) (band 1: -2 0,
//   -6 -4, 2 2, 6 6; band 2: -2 0, -4 -2, 2 2, 4 4; band 3: 0; band 4: 0 0, 2 2; band 5: 0 0, 4 4)
//   and the A / B history (bit per step, ceapnvm SetSltvHistoryPath), which preselects the next run's
//   candidates (a new set: none, all A; inferred NVM default). Red goes back one step (from the
//   welcome screen it leaves: event 0x419e), blue leaves
//   (event 0x4215 from the menu, 0x41a3 in the installation). Menu and the other keys of key group
//   0x80c0 do nothing while it runs.
// - Music: Audio.mp3 plays in the two sound steps, from when the step is shown. Entering a sound
//   step (Next or Previous) deletes and creates the player, so the music starts from the beginning;
//   Left / Right set the equalizer of the playing music (pamtd_SetProperty 0x38..0x3c) without
//   restarting it; at its end the player is deleted and created again with the picked candidate's
//   bands (SltvAmtdOnStateChanged -> message pump 0x6d0f18, player state 8 taken as the end of the
//   stream: inferred), so it loops. It stops when the step is left. While a step changes (0x1480)
//   the keys are ignored. The video player is only used by the Ambilight section.

const IMG = `${PH}/sltv/`
const TREE_URL = `${PH}/fw/sltv-tree.json`

// ---- the decision tree ----
type Node = { img: number; aud: number; sect: number; L: number; R: number; P: number; params: Map<number, number> }
type Tree = { uris: string[]; nodes: Node[] }
let treeLoad: Promise<Tree> | null = null
function loadTree() {
  treeLoad ??= fetch(TREE_URL)
    .then(r => r.json())
    .then((t: { uris: string[]; nodes: [number, number, number, number, number, number, number, number, number[]][] }) => ({
      uris: t.uris,
      nodes: t.nodes.map(([img, aud, , , sect, L, R, Pn, ps]) => {
        const params = new Map<number, number>()
        for (let i = 0; i + 1 < ps.length; i += 2) params.set(ps[i], ps[i + 1])
        return { img, aud, sect, L, R, P: Pn, params }
      }),
    }))
  return treeLoad
}

// table 0x100a154c: images, music, video per section
const SECTIONS = [
  { images: 1, music: false }, // 0 welcome
  { images: 2, music: false }, // 1 picture
  { images: 1, music: true },  // 2 sound
  { images: 0, music: false }, // 3 Ambilight (video)
  { images: 1, music: false }, // 4 finish
]
// apsltvdiv_IsSectionAvailable: section 3 needs the Ambilight option (NVM option byte 0x30; not in
// the update, 0 for this set: inferred from the model's features)
const sectionAvailable = (s: number) => s >= 0 && s <= 4 && s !== 3

// ---- settings: tree values to the TV's properties (apsltvdiv_ConvertSltvParameter) ----
// The base values are profile 2's (cetvatv__pobs_GetProfileItem(2, item), NVM struct +0x224, not in
// the update): taken as the Standard smart picture, the factory values 100 / 50 / 50 / 5 (inferred).
const BASE = { brightness: 50, contrast: 100, colour: 50, sharpness: 5 }
export type Picture = { brightness: number; contrast: number; colour: number; sharpness: number }
export function pictureOf(params: Map<number, number>): Picture {
  const b = params.get(0x2d) ?? 0
  const c = params.get(0x2e) ?? 0
  const col = params.get(0x2f) ?? 0
  const s = params.get(0x30) ?? 0
  const cap = (v: number) => Math.min(100, v)
  return {
    brightness: cap(BASE.brightness + Math.trunc((4 * b) / 15)),
    contrast: cap(BASE.contrast + Math.trunc(0.6 * c)),
    colour: cap(BASE.colour + (col === 1 || col === 10 ? 5 : col === 11 ? 10 : 0)),
    sharpness: cap(BASE.sharpness - (s === 1 ? 2 : 0)),
  }
}
// equalizer bands 0x38..0x3c -> the sound menu's equalizer sliders (pactl2 0x1d band 1..5; which
// slider is which band is inferred from their order in panel#67: 120 Hz, 500 Hz, 1.5 kHz, 5 kHz, 10 kHz)
const EQ_PROPS = [0x595, 0x598, 0x599, 0x59a, 0x596]
const EQ_STORE: Record<number, number>[] = [
  { [-2]: 0, [-6]: -4, 2: 2, 6: 6 },
  { [-2]: 0, [-4]: -2, 2: 2, 4: 4 },
  {},
  { 0: 0, 2: 2 },
  { 0: 0, 4: 4 },
]
const eqOf = (params: Map<number, number>) => [0x38, 0x39, 0x3a, 0x3b, 0x3c].map(p => params.get(p) ?? 0)

// ---- the music (Audio.mp3 through the exhibit's volume and mute) ----
// Five peaking filters at the equalizer's frequencies (Q 1, 1 dB per step of the player's band
// values: inferred), then the volume (square-root curve of 0..100, as the 2025 exhibit's set-up music).
const EQ_FREQ = [120, 500, 1500, 5000, 10000]
class Music {
  ctx: AudioContext | null = null
  buf: Promise<AudioBuffer | null> | null = null
  src: AudioBufferSourceNode | null = null
  eq: BiquadFilterNode[] = []
  out: GainNode | null = null
  unsub: (() => void) | null = null
  gen = 0

  // called from a key press (browsers start audio on a user gesture)
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return
      }
      const c = this.ctx
      this.out = c.createGain()
      this.out.connect(c.destination)
      this.eq = EQ_FREQ.map(f => {
        const b = c.createBiquadFilter()
        b.type = 'peaking'
        b.frequency.value = f
        b.Q.value = 1
        return b
      })
      for (let i = 0; i < this.eq.length; i++) this.eq[i].connect(i + 1 < this.eq.length ? this.eq[i + 1] : this.out)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.buf ??= fetch(`${IMG}Audio.mp3`)
      .then(r => r.arrayBuffer())
      .then(a => this.ctx!.decodeAudioData(a))
      .catch(() => null)
  }
  volume() {
    const s = getTv()
    if (this.out) this.out.gain.value = s.muted || s.power !== 'on' ? 0 : Math.min(1, Math.sqrt(s.volume / 100))
  }
  setEq(bands: number[]) {
    bands.forEach((g, i) => {
      if (this.eq[i]) this.eq[i].gain.value = g
    })
  }
  // a new player: from the beginning, looping (deleted and created again at its end)
  async start(bands: number[]) {
    this.stop()
    this.unlock()
    const gen = this.gen
    const c = this.ctx
    const buf = await this.buf
    if (!c || !buf || !this.eq.length || gen !== this.gen) return
    this.setEq(bands)
    this.volume()
    this.unsub ??= subscribeTv(() => this.volume())
    const s = c.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.connect(this.eq[0])
    s.start()
    this.src = s
  }
  stop() {
    this.gen++
    try {
      this.src?.stop()
    } catch {
      /* not started */
    }
    this.src?.disconnect()
    this.src = null
  }
}
const music = new Music()
// test hook (window.__ph.sltv): the music's state
export function sltvMusic() {
  return {
    ctx: music.ctx?.state ?? 'none', playing: !!music.src, gain: music.out?.gain.value,
    eq: music.eq.map(b => b.gain.value), t: music.ctx?.currentTime,
  }
}

// ---- the application state ----
export type SltvView = {
  mode: 0 | 2                 // 0 menu, 2 demo (0x100a1484)
  section: number             // the shown step's section (-1 while the first step loads)
  left: Node | null           // the candidates (0x41ac / 0x41a8)
  right: Node | null
  chosen: Node | null         // 0x4190
  step: number                // 0x4198
  total: number               // 0x419c
  green: number               // list#155's value: 3 Next, 8 Store (0x41a0)
}
let view: SltvView | null = null
const subs = new Set<() => void>()
function publish() {
  subs.forEach(f => f())
  repaint()
}
export function useSltv() {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
    () => view,
  )
}

// decoded pictures, kept once loaded
const images = new Map<string, Promise<void>>()
function loadImage(name: string) {
  let p = images.get(name)
  if (!p) {
    const im = new Image()
    im.src = `${IMG}${name}`
    p = im.decode().catch(() => undefined)
    images.set(name, p)
  }
  return p
}
export const sltvImage = (n: Node | null, t = tree) => (n && t && n.img >= 0 ? `${IMG}${t.uris[n.img]}` : '')

let tree: Tree | null = null
let app: Sltv | null = null

class Sltv {
  t: Tree
  mode: 0 | 2
  parent = 0          // 0x418c
  chosen = -1         // 0x4190
  step = 0
  total = 0
  history: number     // 0x4194
  busy = false        // 0x1480: keys are ignored until the step's players are ready
  seq = 0
  onEnd: (stored: boolean) => void

  constructor(t: Tree, mode: 0 | 2, onEnd: (stored: boolean) => void) {
    this.t = t
    this.mode = mode
    this.onEnd = onEnd
    this.history = getTv().sltvHistory ?? 0
    // the start function (0x6d04a8) counts the available steps along the left children up to the finish
    for (let n = this.t.nodes[0].L; n >= 0; n = this.t.nodes[n].L) {
      const s = this.t.nodes[n].sect
      if (s === 4) break
      if (s !== 0 && sectionAvailable(s)) this.total++
    }
  }
  node(i: number) {
    return i >= 0 ? this.t.nodes[i] : null
  }
  sect(i: number) {
    return this.node(i)?.sect ?? -1
  }

  // the step function (0x6cf24c) and its completion once the players are ready (0x6d0c30)
  async enter(back: boolean) {
    const n = this.t.nodes
    this.busy = true
    if (!back && this.chosen >= 0) this.parent = this.chosen
    while (!sectionAvailable(this.sect(n[this.parent].L))) this.parent = n[this.parent].L
    const L = n[this.parent].L
    const R = n[this.parent].R
    this.chosen = R >= 0 && this.history & (1 << (this.step - 1)) ? R : L
    const section = this.sect(L)
    const cands = SECTIONS[section].images === 2 ? [L, R] : [L]
    const seq = ++this.seq
    await Promise.all(cands.map(c => this.node(c)).filter(c => c && c.img >= 0).map(c => loadImage(this.t.uris[c!.img])))
    if (seq !== this.seq || app !== this) return
    if (section === 0) {
      this.step = 0
      this.history = getTv().sltvHistory ?? 0
    } else if (section === 4) this.step = this.total + 1
    if (SECTIONS[section].music) void music.start(eqOf(this.node(this.chosen)!.params))
    else music.stop()
    view = {
      mode: this.mode, section, left: this.node(L), right: this.node(R), chosen: this.node(this.chosen),
      step: this.step, total: this.total, green: section === 4 ? 8 : 3,
    }
    this.busy = false
    publish()
    // the demo moves on by itself: panel#52 (event 0x41db while the step is below 3) closes after its
    // OSD time-out (JuicePanelVars +0xa = 40) and sets property 0x66. The Juice tick counts 20 ms
    // ticks in fives, so the unit is 100 ms if tic_GetAccurateTime counts milliseconds (inferred;
    // the banner's 6000 would then be a 10-minute safety time-out)
    if (this.mode === 2 && this.step < 3) timer('sltv-demo', 4000, () => this.demoNext())
  }

  // property 0x68: the A / B choice
  pick(right: boolean) {
    if (this.busy || !view || (view.section !== 1 && view.section !== 2)) return
    const n = this.t.nodes[this.parent]
    if (n.R < 0) return
    const bit = 1 << (this.step - 1)
    this.history = right ? this.history | bit : this.history & ~bit
    this.chosen = right ? n.R : n.L
    view = { ...view, chosen: this.node(this.chosen) }
    if (view.section === 2) music.setEq(eqOf(view.chosen!.params))
    publish()
  }
  // property 0x5e: Next, or Store on the finish screen
  green() {
    if (this.busy) return
    const n = this.t.nodes
    if (this.sect(n[this.parent].L) === 4) {
      this.store(n[n[this.parent].L])
      this.leave(true)
      return
    }
    this.next()
  }
  // 0x6cfcbc
  next() {
    this.step++
    music.stop()
    void this.enter(false)
  }
  // property 0x64: Previous
  previous() {
    if (this.busy) return
    const n = this.t.nodes
    if (this.sect(n[this.parent].L) === 0) {
      this.leave(false) // event 0x419e
      return
    }
    if (this.step > 0) this.step--
    while (!sectionAvailable(this.sect(this.parent))) this.parent = n[this.parent].P
    this.parent = n[this.parent].P
    music.stop()
    void this.enter(true)
  }
  // property 0x66 (panel#52 closing in the demo): the demo ends after its second picture step
  demoNext() {
    if (app !== this) return
    if (this.step === 2) this.leave(false)
    else this.next()
  }
  store(final: Node) {
    setTv({ sltvHistory: this.history })
    const pic = pictureOf(final.params)
    setProp(P.brightness, pic.brightness)
    setProp(P.contrast, pic.contrast)
    setProp(P.colour, pic.colour)
    setProp(P.sharpness, pic.sharpness)
    eqOf(final.params).forEach((v, i) => setProp(EQ_PROPS[i], EQ_STORE[i][v] ?? 0))
  }
  leave(stored: boolean) {
    this.seq++
    cancelTimer('sltv-demo')
    music.stop()
    app = null
    view = null
    hide('sltv')
    publish()
    this.onEnd(stored)
  }
}

// ---- the OSD ----
const A_B: Record<number, number> = { 1: W('list', 151), 2: W('list', 152) }
const STEP_PANEL: Record<number, number> = { 1: W('panel', 211), 2: W('panel', 213) }
const STEP_TEXT: Record<number, number> = { 1: W('status', 486), 2: W('status', 489) }
const LEGENDS = { red: 0x64, green: 0x5e, yellow: 0x5f, blue: 0x60 }

function legends(env: TvEnv, v: SltvView) {
  env.overrides.set(LEGENDS.red, 2) // Previous
  env.overrides.set(LEGENDS.green, v.green)
  env.overrides.set(LEGENDS.yellow, 6) // (none)
  env.overrides.set(LEGENDS.blue, 7) // Cancel
}
function abList(env: TvEnv, w: number, v: SltvView) {
  const right = !!v.chosen && v.chosen === v.right
  env.overrides.set(0x68, right ? 5 : 1)
  env.lists.set(w, { focus: right ? 1 : 0, top: 0, expanded: true })
}

class SltvScreen implements Screen {
  name = 'sltv'
  layer = 14
  covers = true
  modal = true

  draw(j: Juice, env: TvEnv) {
    const v = view
    if (!v || v.section < 0) return
    legends(env, v)
    const counter = `${v.step}/${v.total}`
    if (v.mode === 2) {
      // the demo's copy panel#47 (in panel#30): welcome panel#48, picture step panel#49 (the line
      // icon#4, list#13, status#74), legends panel#50
      if (v.section !== 0) {
        env.hidden.add(W('panel', 48))
        env.show(W('panel', 49))
        abList(env, W('list', 13), v)
        env.values.set(W('status', 74), counter)
      }
      j.draw(W('panel', 47), 133, 240, F.FOCUS)
      return
    }
    // the shown step panel has the focus (panel#210 / #215 focus action), the others go
    if (v.section === 0) {
      env.hidden.add(W('panel', 210))
      env.hidden.add(W('panel', 215))
    } else if (v.section === 4) {
      env.hidden.add(W('panel', 209))
      env.hidden.add(W('panel', 210))
      env.show(W('panel', 215))
    } else {
      env.hidden.add(W('panel', 209))
      env.hidden.add(W('panel', 215))
      env.show(W('panel', 210))
      env.show(STEP_PANEL[v.section])
      for (const s of [1, 2]) if (s !== v.section) env.hidden.add(STEP_PANEL[s])
      env.hidden.add(W('panel', 214))
      abList(env, A_B[v.section], v)
      env.values.set(STEP_TEXT[v.section], counter)
    }
    j.draw(W('panel', 208), 133, 240, F.FOCUS)
  }

  // volume, mute and power stay with the TV (they set the music's level too)
  passes = tvKeys

  key(k: RemoteKey) {
    const a = app
    if (!a || tvKeys(k)) return false
    music.unlock()
    if (a.mode === 2) {
      // the demo: key group 0x8097 (red, Menu) sets property 0x67 and ends it (Back and Exit too, as in
      // the other demos: inferred); Left / Right on list#13; the other keys do nothing (inferred)
      if (k === 'Red' || k === 'Settings' || k === 'Exit' || k === 'Back') a.leave(false)
      else if (k === 'Left' || k === 'Right') a.pick(k === 'Right')
      return true
    }
    if (k === 'Left' || k === 'Right') a.pick(k === 'Right')
    else if (k === 'Green' || k === 'Enter') a.green()
    else if (k === 'Red') a.previous()
    else if (k === 'Blue' && !a.busy) a.leave(false)
    return true
  }
}

function begin(mode: 0 | 2, onEnd: (stored: boolean) => void) {
  music.unlock()
  cancelTimer('sltv-demo')
  view = { mode, section: -1, left: null, right: null, chosen: null, step: 0, total: 0, green: 3 }
  show(new SltvScreen())
  publish()
  void loadTree().then(t => {
    if (!view || app) return
    tree = t
    app = new Sltv(t, mode, onEnd)
    void app.enter(true)
  })
}

// TV menu > TV settings > Settings assistant > Start now (node 142): the TV menu goes while the
// assistant runs (panel#218 takes the focus); at the end the menu returns on the Settings assistant
// item (event 0x4215 has no panel rule in the build; the menu-mode rules of 0x41a3 / 0x41a4 focus
// panel#131: inferred)
export function startSltv(onStart: () => void, onEnd: () => void) {
  onStart()
  begin(0, () => onEnd())
}

// Features > Demo > Settings assistant (list#8 value 3, event 0x4220): panel#30 hides the TV menu and
// the demo strip and sets property 0x65; the demo shows the welcome screen and two picture steps,
// 4 s each, and ends (event 0x4221: the strip and the demo list come back)
export function startSltvDemo(onStart: () => void, onEnd: () => void) {
  onStart()
  begin(2, () => onEnd())
}

// standby ends the assistant without storing (inferred)
subscribeTv(() => {
  if (getTv().power !== 'on' && view) {
    const a = app
    if (a) a.leave(false)
    else {
      view = null
      hide('sltv')
      publish()
    }
    hide('menu')
  }
})
