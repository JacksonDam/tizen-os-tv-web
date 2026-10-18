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

export function show(s: Screen) {
  screens = [...screens.filter(x => x.name !== s.name), s].sort((a, b) => a.layer - b.layer)
  changed()
}
export function hide(name: string) {
  const n = screens.length
  screens = screens.filter(x => x.name !== name)
  if (screens.length !== n) changed()
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
    env.disabled = new Set()
    env.overrides = new Map()
    env.values = new Map()
    env.gridState = new Map()
    env.cells = new Map()
    env.texts = new Map()
    s.draw(j, env)
  }
  env.hidden = new Set()
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
