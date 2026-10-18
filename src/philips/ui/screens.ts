import type { RemoteKey } from '../../input/remote'
import type { Juice } from '../fw/juice'
import { TvEnv } from './env'

// The OSD screens: each draws its widget trees through the Juice port and handles keys. The stack is
// drawn bottom-up (overlays such as the volume bar stay on top of menus, like the OSD manager's
// priority field, JuiceOsdManagers children +8).

export interface Screen {
  name: string
  layer: number                       // draw order (higher on top)
  draw(j: Juice, env: TvEnv): void
  key?(k: RemoteKey): boolean         // true = consumed
  modal?: boolean                     // keys stop here even if not consumed
  covers?: boolean                    // full-screen: the picture's banner and messages are not drawn
  osd?: number                        // the osdman#0 child panel this screen is (OSD manager rules)
}

// The OSD manager (osdman#0, juiceosdmanc__iskirt_ShowOsd 0x8e618c): per OSD the panels it removes,
// the panels whose presence blocks it (state 1 / state 0) and the panels it suspends until it goes
// (rule tables at 0x10025a08, one {counts, lists} record per child; only the OSDs built here listed).
const OSD_RULES: Record<number, [number[], number[], number[], number[]]> = {
  294: [[], [], [], [296]],                            // mute icon
  296: [[303, 304, 305, 326, 327], [], [294, 330, 329, 328], []], // banner
  303: [[296, 304, 305, 326, 327], [], [], []],        // picture format
  304: [[296, 303, 305, 326, 327], [], [], []],        // input list
  305: [[296, 303, 304, 326, 327], [], [], []],        // channel list
  326: [[296, 303, 304, 305, 327, 330, 329, 328], [], [], []], // quick access
  327: [[], [296, 303, 304, 305, 326], [], []],        // volume bar
  328: [[330, 329], [], [], []],                       // messages
  329: [[330, 328], [], [], []],
  330: [[329, 328], [], [], []],
}
const suspendedBy = new Map<string, Screen[]>()
export function suspendedUnder(name: string) {
  return suspendedBy.get(name) ?? []
}
export function setSuspended(name: string, list: Screen[]) {
  if (list.length) suspendedBy.set(name, list)
  else suspendedBy.delete(name)
}

export const env = new TvEnv()

let screens: Screen[] = []
let seq = 0
const subs = new Set<() => void>()
function changed() {
  seq++
  subs.forEach(f => f())
}
export function repaint() {
  changed()
}
export function paintSeq() {
  return seq
}
export function subscribeScreens(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

// returns false when the OSD manager does not let the OSD show
export function show(s: Screen): boolean {
  const r = s.osd !== undefined ? OSD_RULES[s.osd] : undefined
  if (r) {
    const vis = (p: number) => screens.find(x => x.osd === p && x.name !== s.name)
    if ([...r[1], ...r[3]].some(vis)) return false
    for (const p of r[0]) {
      const v = vis(p)
      if (v) hide(v.name)
    }
    const sus: Screen[] = []
    for (const p of r[2]) {
      const v = vis(p)
      if (v) {
        sus.push(v)
        screens = screens.filter(x => x !== v)
      }
    }
    setSuspended(s.name, [...suspendedUnder(s.name), ...sus])
  }
  screens = [...screens.filter(x => x.name !== s.name), s].sort((a, b) => a.layer - b.layer)
  changed()
  return true
}
export function hide(name: string) {
  const n = screens.length
  screens = screens.filter(x => x.name !== name)
  // the OSDs it suspended come back (and go through the rules again)
  const sus = suspendedUnder(name)
  suspendedBy.delete(name)
  for (const x of sus) show(x)
  if (screens.length !== n || sus.length) changed()
}
export function isShown(name: string) {
  return screens.some(s => s.name === name)
}
export function get<T extends Screen>(name: string): T | undefined {
  return screens.find(s => s.name === name) as T | undefined
}
export function hideAll(keep: (s: Screen) => boolean = () => false) {
  screens = screens.filter(keep)
  changed()
}

export function paintAll(j: Juice) {
  const covered = screens.some(s => s.covers)
  for (const s of screens) {
    if (covered && (s.name === 'message' || s.name === 'banner')) continue
    env.hidden = new Set()
    env.shown = new Set()
    env.disabled = new Set()
    env.overrides = new Map()
    env.values = new Map()
    env.gridState = new Map()
    env.cells = new Map()
    env.texts = new Map()
    s.draw(j, env)
  }
  env.hidden = new Set()
  env.shown = new Set()
}

// keys: topmost screen first
export function screenKey(k: RemoteKey): boolean {
  for (let i = screens.length - 1; i >= 0; i--) {
    const s = screens[i]
    if (s.key?.(k)) {
      changed()
      return true
    }
    if (s.modal) return true
  }
  return false
}

// one-shot timers owned by screens (OSD time-outs)
const timers = new Map<string, ReturnType<typeof setTimeout>>()
export function timer(name: string, ms: number, fn: () => void) {
  clearTimeout(timers.get(name))
  timers.set(name, setTimeout(() => {
    timers.delete(name)
    fn()
  }, ms))
}
export function cancelTimer(name: string) {
  clearTimeout(timers.get(name))
  timers.delete(name)
}
