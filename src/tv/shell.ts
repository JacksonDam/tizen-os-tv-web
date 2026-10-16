import { useSyncExternalStore, type ComponentType } from 'react'
import type { RemoteKey } from '../input/remote'

// The TV shell's API for feature modules (App.tsx implements it): start apps, open the Smart Hub or
// Settings, return to the picture, power. Also the registries App.tsx reads: overlays drawn over
// everything, TV-key handlers, and what the TV shows when it powers on.

export type ShellApi = {
  launch: (app: string, args?: Record<string, string>) => void  // full-screen app (APPS registry)
  showHub: (entry?: 'devices' | 'settings') => void              // Smart Hub (entry: open on a sidebar item)
  openSettings: (target?: string) => void                         // All Settings, optionally on a category
  toLive: () => void                                              // close every UI, show the picture
  standby: () => void                                             // power off to standby
  restart: () => void                                             // power cycle (standby, then power on)
}

const noop = () => {}
export const shell: ShellApi = {
  launch: noop, showHub: noop, openSettings: noop, toLive: noop, standby: noop, restart: noop,
}

// ---- what is on screen, for overlays that only show over certain views ----

export type ShellView = {
  live: boolean           // the picture with no UI above it (hub, settings and apps closed)
  hub: boolean            // Smart Hub visible
  settings: boolean       // All Settings card visible
  app: string | null      // running full-screen app id
}
let view: ShellView = { live: false, hub: true, settings: false, app: null }
const subs = new Set<() => void>()

export function setShellView(v: ShellView) {
  if (v.live === view.live && v.hub === view.hub && v.settings === view.settings && v.app === view.app) return
  view = v
  subs.forEach(f => f())
}
export function getShellView() {
  return view
}
export function useShellView(): ShellView {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => view,
  )
}

// ---- overlays: components App draws above the apps and below the volume OSD, while the TV is on ----
// Each overlay decides when it is visible (return null otherwise) and takes keys with useRemote while
// it is up. Lower `z` draws first.

export type Overlay = { id: string; z: number; component: ComponentType }
export const OVERLAYS: Overlay[] = []
export function registerOverlay(id: string, component: ComponentType, z = 0) {
  OVERLAYS.push({ id, z, component })
  OVERLAYS.sort((a, b) => a.z - b.z)
}

// ---- TV keys: handlers tried (newest first) for keys no app consumed, before tv-viewer's own ----
// Return true when the key was handled (e.g. Guide launches the guide).

type KeyHandler = (key: RemoteKey) => boolean
export const TV_KEY_HANDLERS: KeyHandler[] = []
export function registerTvKeyHandler(fn: KeyHandler) {
  TV_KEY_HANDLERS.unshift(fn)
}

// ---- power on: what the TV shows after the Power key turns it on ----
// Hooks run by priority (highest first); the first non-null answer wins. Default: the Smart Hub.

export type PowerOnTarget = { app: string; args?: Record<string, string> } | 'hub' | 'live'
type PowerOnHook = { priority: number; fn: () => PowerOnTarget | null }
export const POWER_ON_HOOKS: PowerOnHook[] = []
export function registerPowerOnHook(fn: () => PowerOnTarget | null, priority = 0) {
  POWER_ON_HOOKS.push({ priority, fn })
  POWER_ON_HOOKS.sort((a, b) => b.priority - a.priority)
}
export function powerOnTarget(): PowerOnTarget {
  for (const h of POWER_ON_HOOKS) {
    const t = h.fn()
    if (t) return t
  }
  return 'hub'
}

// ---- PIN prompt: the TV's PIN pad (feat/setup registers it) for rows and apps that ask for the PIN ----
// requestPin resolves true once the right PIN is entered, false when the user backs out. Without a
// registered PIN pad it resolves true.

export type PinRequest = { title?: string; message?: string }
let pinPrompt: ((r: PinRequest) => Promise<boolean>) | null = null
export function registerPinPrompt(fn: (r: PinRequest) => Promise<boolean>) {
  pinPrompt = fn
}
export function requestPin(r: PinRequest = {}): Promise<boolean> {
  return pinPrompt ? pinPrompt(r) : Promise.resolve(true)
}
