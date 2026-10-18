import { useSyncExternalStore, type ComponentType } from 'react'
import type { RemoteKey } from '../input/remote'

// The 2013 exhibit's shell. exeDSP runs one foreground application at a time over the TV picture
// (Smart Hub, Menu, Guide, Channel List, Source...) plus always-present system windows (volume,
// channel banner...). Screen modules register themselves here from src/f2013/screens/*:
//   registerApp      a foreground application, opened with openApp(id)
//   registerOverlay  an always-mounted layer (reads the TV state itself)
//   registerHotkey   what a remote key does while no application consumed it (watching TV)

export type AppProps = { params?: unknown; close: () => void }
export type AppDef = { id: string; component: ComponentType<AppProps>; z?: number }
export type Overlay = { id: string; z: number; component: ComponentType }

const apps = new Map<string, AppDef>()
const overlays: Overlay[] = []
const hotkeys = new Map<RemoteKey, () => boolean | void>()

export function registerApp(def: AppDef) {
  apps.set(def.id, def)
}
export function getApp(id: string) {
  return apps.get(id)
}

export function registerOverlay(o: Overlay) {
  const i = overlays.findIndex(x => x.id === o.id)
  if (i >= 0) overlays.splice(i, 1)
  overlays.push(o)
  overlays.sort((a, b) => a.z - b.z)
}
export function getOverlays() {
  return overlays
}

// The handler returns false to let the key fall through to the default TV behaviour.
export function registerHotkey(key: RemoteKey, fn: () => boolean | void) {
  hotkeys.set(key, fn)
}
export function runHotkey(key: RemoteKey): boolean {
  const fn = hotkeys.get(key)
  if (!fn) return false
  return fn() !== false
}

// ---- the foreground application ----

export type Foreground = { id: string; params?: unknown; seq: number } | null
let fg: Foreground = null
let seq = 0
const subs = new Set<() => void>()

export function openApp(id: string, params?: unknown) {
  if (!apps.has(id)) return false
  fg = { id, params, seq: ++seq }
  subs.forEach(f => f())
  return true
}

// Closes the foreground application (only if it is `id`, when given) and returns to the TV picture.
export function closeApp(id?: string) {
  if (!fg || (id && fg.id !== id)) return
  fg = null
  subs.forEach(f => f())
}

export function getForeground() {
  return fg
}

export function useForeground(): Foreground {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => fg,
  )
}
