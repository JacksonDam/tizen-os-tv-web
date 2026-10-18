import type { Env, GridState, ListState } from '../fw/juice'
import { dynString } from '../fw/dyn'
import { Strings } from '../fw/strings'
import { getTv, setTv } from '../tv/store'
import { ABSENT_PROPS, DEFAULTS, P } from './props'
import { sourceName } from './sources'

// The TV application's side of the widget engine: strings in the menu language, property values from
// the mocked TV (../tv/store.ts), availability of the model's features, and the per-screen widget
// state (juicew__wid_State) the screens set while they draw.

export const strings = new Strings()

export class TvEnv implements Env {
  hidden = new Set<number>()                       // widgets the drawing screen does not show
  values = new Map<number, string | number>()      // status controls' runtime values
  lists = new Map<number, ListState>()             // list widgets' focus / scroll
  texts = new Map<string, string>()                // caption overrides: `${widget}:${alt}`
  disabled = new Set<number>()                     // widgets drawn but not controllable
  allowedValues = new Map<number, Set<number>>()         // list values the TV allows (per list widget)
  user = ''
  overrides = new Map<number, number>()             // property values a screen shows (its cursor)
  gridState = new Map<number, GridState>()          // dynamic grids' rows
  cells = new Map<number, (row: number) => string | number | undefined>() // grid cell values

  str(id: number) {
    return id > 1940 ? dynString(id, sourceName, i => strings.get(i)) : strings.get(id)
  }
  userString() {
    return this.user
  }
  avail(prop: number) {
    return !ABSENT_PROPS.has(prop)
  }
  ctrl(_prop: number, w: number) {
    return !this.disabled.has(w)
  }
  get(prop: number) {
    return this.overrides.get(prop) ?? getProp(prop)
  }
  range(): [number, number] {
    return [0, 100]
  }
  state(w: number) {
    return this.hidden.has(w) ? 0 : 4
  }
  statusValue(w: number) {
    return this.values.get(w)
  }
  propNumber(prop: number) {
    return this.overrides.get(prop)
  }
  list(w: number) {
    return this.lists.get(w)
  }
  allowed(w: number, v: number) {
    const s = this.allowedValues.get(w)
    return !s || s.has(v)
  }
  grid(w: number) {
    return this.gridState.get(w)
  }
  cell(w: number, row: number) {
    return this.cells.get(w)?.(row)
  }
  textOverride(w: number, alt: boolean) {
    return this.texts.get(`${w}:${alt ? 1 : 0}`)
  }
}

export function getProp(prop: number): number {
  const s = getTv()
  if (prop === P.volume) return s.volume
  return s.props[prop] ?? DEFAULTS[prop] ?? 0
}
export function setProp(prop: number, v: number) {
  if (prop === P.volume) {
    setTv(s => ({ volume: v, muted: false, volSeq: s.volSeq + 1 }))
    return
  }
  setTv(s => ({ props: { ...s.props, [prop]: v } }))
}
