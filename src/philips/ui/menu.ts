import type { RemoteKey } from '../../input/remote'
import { clsOf, CLS, F, idxOf, type Juice, W } from '../fw/juice'
import { NavCtl } from '../fw/nav'
import { getTv } from '../tv/store'
import { pictureVideo } from './sources'
import { getProp, setProp, type TvEnv } from './env'
import { ABSENT_PROPS, P } from './props'
import { DEMO_LIST, DEMO_PROP, DEMO_VALUES, demoStripDraw, startDemo } from './demo'
import { hide, repaint, show, type Screen } from './screens'

// TV menu (MENU > Television > TV menu): panel#15 with the navigator nav#1 (146 nodes: TV settings,
// Features, Installation, Software update). Leaf widgets open in the right column; lists and sliders
// change their property as the cursor moves (juicenvc tree control + the widgets' key handlers).

export const TV_MENU_PANEL = W('panel', 15)
export const SW_VERSION = 'Q522E_0.64.79.0'
export const NAV1 = W('nav', 1)

// Navigator nodes of features the 42PFL5603D does not have or that only appear in other countries
// (the TV application hides them through the properties' availability; inferred where the property
// is -1 in the record).
const ABSENT_NODES = new Set<number>([
  43, 44, 45, 46, 47, 48, 49, 50, // Ambilight
  62, // PIP format
  77, // LightGuide brightness
  105, 106, // Time zone (Spain / Australia only)
  134, // Internet upgrade
  101, // second "Language" list (Asia-Pacific sets)
])

// TV settings > Reset smart settings (node 144, panel#132): list#123 on property 0x6a5 (38 Current,
// 48 Standard, 49 Vivid, 50 Movie) previews a preset as the cursor moves, the green key stores it
// (list#125 "Store"), the red key leaves (status#343 "Exit"); list#124 is the focused item's text.
// Preset values: philips/data/rupg/cetv.d/usersettings0.pqu USERSTYLEs (contrast, brightness, colour,
// sharpness on 0..255, scaled to the sliders' 0..100 / 0..10); which style is which preset is inferred
// (1 Vivid: most colour and sharpness, 2 Movie: least, 3 Standard).
const SMART_NODE = 144
const SMART_PROP = 0x6a5
const SMART_VALUES = [38, 48, 49, 50]
const PQU: Record<number, [number, number, number, number]> = {
  48: [255, 128, 128, 128], 49: [255, 117, 140, 178], 50: [204, 128, 140, 76],
}
function smartPreset(v: number): Record<number, number> | undefined {
  const s = PQU[v]
  if (!s) return undefined
  const pc = (x: number) => Math.round((x * 100) / 255)
  return { [P.contrast]: pc(s[0]), [P.brightness]: pc(s[1]), [P.colour]: pc(s[2]), [P.sharpness]: Math.round((s[3] * 10) / 255) }
}
const PICTURE = [P.contrast, P.brightness, P.colour, P.sharpness]

// Features > Demo (node 5, panel#28 with list#8): see demo.ts
const DEMO_NODE = 5

export type LeafHandler = (k: RemoteKey, ctl: MenuScreen) => boolean
// actions for composite leaves (installation, reset, software info) registered by other modules
const actions = new Map<number, (ctl: MenuScreen) => void>()
export function registerMenuAction(node: number, fn: (ctl: MenuScreen) => void) {
  actions.set(node, fn)
}

export class MenuScreen implements Screen {
  name = 'menu'
  covers = true
  layer = 10
  nav: NavCtl
  j: Juice
  onExit: () => void = () => hide('menu')
  smart = 0                              // Reset smart settings: focused preset (index in SMART_VALUES)
  hidden = false                         // a demo or the Settings assistant runs: the TV menu is hidden
  smartSaved: Record<number, number> | null = null

  // keys stop at the menu, except while a demo or the Settings assistant hides it (the keys those
  // leave, volume and mute, go on to the TV)
  get modal() {
    return !this.hidden
  }

  constructor(j: Juice) {
    this.j = j
    this.nav = new NavCtl(j, NAV1)
    this.nav.nodeAvail = n => !ABSENT_NODES.has(n)
    this.nav.pick = prop => (prop === 0x39f ? 104 : prop === 0x36b ? 77 : getProp(prop)) // Installation > Languages submenu
    j.navs.set(NAV1, this.nav)
  }

  leafWidget() {
    const n = this.nav.focusedNode()
    return n === undefined ? 0 : this.nav.widget(n)
  }

  draw(j: Juice, env: TvEnv) {
    if (this.hidden) return
    env.hidden.add(W('panel', 22)) // PIN entry
    // Features > Demo: the demos this set offers; the strip panel#29 while the list has the focus
    const inDemo = this.nav.leaf && this.nav.focusedNode() === DEMO_NODE
    env.allowedValues.set(DEMO_LIST, new Set(DEMO_VALUES))
    if (!DEMO_VALUES.includes(getProp(DEMO_PROP))) setProp(DEMO_PROP, DEMO_VALUES[0])
    const ids = j.listValueIds(DEMO_LIST)
    env.lists.set(DEMO_LIST, { focus: Math.max(0, ids.indexOf(getProp(DEMO_PROP))), top: 0, expanded: true })
    // Software update > Current software info (panel#117): the version property 0x29, built by
    // cehtvversions__verstor_GetSwVersion as 5 characters, "_" and "%u.%u.%u.%u" (the NVM path;
    // characters and numbers of this update, Q522E 0.64.79.0); no release notes text (property 0x2a)
    // Installation > Channel installation > Rearrange (panel#102): its channel grid dgrid#6 (property
    // 0x347, cells status#279 number 0x349, status#281 name 0x312) is the only child the panel
    // activates by itself; the legends, rename and recorder panels wait for the application
    const chs = getTv().channels
    env.gridState.set(W('dgrid', 6), { count: chs.length, focus: -1, top: 0 })
    env.cells.set(W('status', 279), r => chs[r]?.number)
    env.cells.set(W('status', 281), r => chs[r]?.name)
    env.values.set(W('status', 318), SW_VERSION)
    env.values.set(W('status', 319), '')
    // Reset smart settings: its legends and item text only while it is entered
    const inSmart = this.nav.leaf && this.nav.focusedNode() === SMART_NODE
    // (panel#133 does not activate with panel#132; the application shows it)
    if (inSmart) env.show(W('panel', 133))
    env.overrides.set(SMART_PROP, SMART_VALUES[inSmart ? this.smart : 0])
    env.lists.set(W('list', 123), { focus: inSmart ? this.smart : 0, top: 0, expanded: true })
    this.prepareLeaf(env)
    j.draw(TV_MENU_PANEL, 0, 0, F.FOCUS)
    if (inDemo) demoStripDraw(j)
  }

  // list leaves show their values with the current one marked; the focused row follows the cursor
  prepareLeaf(env: TvEnv) {
    const w = this.leafWidget()
    if (!w || clsOf(w) !== CLS.list) return
    const cur = this.j.listValueIndex(w)
    const st = env.lists.get(w)
    if (!st || !this.nav.leaf) env.lists.set(w, { focus: cur, top: st?.top ?? 0, expanded: true })
    for (const [k] of env.lists) if (k !== w && clsOf(k) === CLS.list && this.isNavLeaf(k)) env.lists.delete(k)
  }
  isNavLeaf(w: number) {
    for (let i = 0; i < this.nav.nodeCount(); i++) if (this.nav.widget(i) === w) return true
    return false
  }

  key(k: RemoteKey): boolean {
    const nav = this.nav
    if (this.hidden) return false
    if (k === 'Settings' || k === 'Exit') {
      if (this.smartSaved) for (const p of PICTURE) setProp(p, this.smartSaved[p]) // preview not stored
      this.smartSaved = null
      this.onExit()
      return true
    }
    if (nav.leaf) return this.leafKey(k)
    switch (k) {
      case 'Up': nav.moveFocus(-1); return true
      case 'Down': nav.moveFocus(1); return true
      case 'Right':
      case 'Enter': {
        const n = nav.focusedNode()
        if (n === undefined) return true
        const act = actions.get(n)
        if (act && (k === 'Enter' || !nav.isMenu(n))) {
          act(this)
          return true
        }
        if (nav.isMenu(n) || this.enterable(n)) nav.enter()
        return true
      }
      case 'Left':
      case 'Back':
        if (!nav.back()) {
          if (k === 'Back') this.onExit()
        }
        return true
    }
    return false
  }

  // leaf widgets the exhibit can operate: lists and sliders of properties
  enterable(node: number) {
    if (node === SMART_NODE || node === DEMO_NODE) return true
    const w = this.nav.widget(node)
    const c = clsOf(w)
    return (c === CLS.list || c === CLS.slider) && !ABSENT_PROPS.has(this.j.prop(w))
  }

  leafKey(k: RemoteKey): boolean {
    const w = this.leafWidget()
    const j = this.j
    const env = j.env as TvEnv
    if (this.nav.focusedNode() === SMART_NODE) return this.smartKey(k)
    if (this.nav.focusedNode() === DEMO_NODE) return this.demoKey(k)
    if (k === 'Left' || k === 'Back' || k === 'Enter') {
      this.nav.back()
      return true
    }
    if (clsOf(w) === CLS.list) {
      const ids = j.listValueIds(w)
      const st = env.lists.get(w) ?? { focus: j.listValueIndex(w), top: 0, expanded: true }
      if (k === 'Up' || k === 'Down') {
        const f = Math.max(0, Math.min(ids.length - 1, st.focus + (k === 'Down' ? 1 : -1)))
        const rows = j.listRows(w)
        let top = st.top
        if (f < top) top = f
        if (f >= top + rows) top = f - rows + 1
        env.lists.set(w, { ...st, focus: f, top })
        setProp(j.prop(w), ids[f])
        return true
      }
      return true
    }
    if (clsOf(w) === CLS.slider) {
      const [lo, hi] = j.sliderRange(w)
      const p = j.prop(w)
      const step = hi - lo > 100 ? 5 : 1
      if (k === 'Up' || k === 'Down') {
        setProp(p, Math.max(lo, Math.min(hi, getProp(p) + (k === 'Up' ? step : -step))))
        return true
      }
      return true
    }
    return true
  }
  // Features > Demo entered: Up / Down choose a demo (list#8), OK starts it (property 0x1c0), the
  // red key ("Exit" on the strip) and Left / Back leave the list
  demoKey(k: RemoteKey): boolean {
    const i = Math.max(0, DEMO_VALUES.indexOf(getProp(DEMO_PROP)))
    if (k === 'Up' || k === 'Down') setProp(DEMO_PROP, DEMO_VALUES[Math.max(0, Math.min(DEMO_VALUES.length - 1, i + (k === 'Down' ? 1 : -1)))])
    else if (k === 'Enter') {
      startDemo(getProp(DEMO_PROP), !!pictureVideo(getTv()), () => {
        this.hidden = true
      }, () => {
        // the end event focuses the demo list and shows the strip again; the TV menu comes back
        // with it (inferred)
        this.hidden = false
        repaint()
      })
    } else if (k === 'Red' || k === 'Left' || k === 'Back') this.nav.back()
    return true
  }

  smartKey(k: RemoteKey): boolean {
    if (!this.smartSaved) {
      this.smartSaved = Object.fromEntries(PICTURE.map(p => [p, getProp(p)]))
      this.smart = 0
    }
    const leave = (restore: boolean) => {
      if (restore && this.smartSaved) for (const p of PICTURE) setProp(p, this.smartSaved[p])
      this.smartSaved = null
      this.smart = 0
      this.nav.back()
    }
    if (k === 'Up' || k === 'Down') {
      this.smart = Math.max(0, Math.min(SMART_VALUES.length - 1, this.smart + (k === 'Down' ? 1 : -1)))
      // the picture previews the focused preset (Current: the stored values)
      const pre = smartPreset(SMART_VALUES[this.smart]) ?? this.smartSaved!
      for (const p of PICTURE) setProp(p, pre[p])
    } else if (k === 'Green' && smartPreset(SMART_VALUES[this.smart])) leave(false) // Store
    else if (k === 'Red' || k === 'Left' || k === 'Back' || k === 'Enter') leave(true)
    return true
  }
}

export function openMenu(j: Juice, at?: number[]) {
  const m = new MenuScreen(j)
  if (at) {
    for (const node of at) {
      const items = m.nav.items(m.nav.cur)
      const k = items.indexOf(node)
      if (k < 0) break
      m.nav.idx = k
      m.nav.enter()
    }
  }
  show(m)
  repaint()
  return m
}

export const menuWidgetIndex = (w: number) => idxOf(w)
