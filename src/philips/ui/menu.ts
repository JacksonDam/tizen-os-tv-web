import type { RemoteKey } from '../../input/remote'
import { clsOf, CLS, F, idxOf, type Juice, W } from '../fw/juice'
import { NavCtl } from '../fw/nav'
import { getProp, setProp, type TvEnv } from './env'
import { ABSENT_PROPS } from './props'
import { hide, repaint, show, type Screen } from './screens'

// TV menu (MENU > Television > TV menu): panel#15 with the navigator nav#1 (146 nodes: TV settings,
// Features, Installation, Software update). Leaf widgets open in the right column; lists and sliders
// change their property as the cursor moves (juicenvc tree control + the widgets' key handlers).

export const TV_MENU_PANEL = W('panel', 15)
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
  modal = true
  nav: NavCtl
  j: Juice
  onExit: () => void = () => hide('menu')

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
    env.hidden.add(W('panel', 22)) // PIN entry
    this.prepareLeaf(env)
    j.draw(TV_MENU_PANEL, 0, 0, F.FOCUS)
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
    if (k === 'Settings' || k === 'Exit') {
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
    const w = this.nav.widget(node)
    const c = clsOf(w)
    return (c === CLS.list || c === CLS.slider) && !ABSENT_PROPS.has(this.j.prop(w))
  }

  leafKey(k: RemoteKey): boolean {
    const w = this.leafWidget()
    const j = this.j
    const env = j.env as TvEnv
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
