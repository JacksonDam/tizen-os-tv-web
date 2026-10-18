import { useSyncExternalStore } from 'react'
import { DEFAULT_LINEUP, type Channel } from '../tv/channels'
import type { Lang } from './menuData'

// Mocked hardware and state of the Philips 42PFL5603D/27 (LC08 platform): power, input source, tuner channels, volume
// and the on-screen menu's setting values (keyed by the firmware menu item id). Persisted per
// browser, separately from the other exhibits. The channel lineup is the museum's shared fictional
// lineup (src/tv/channels.ts) with its stand-in video loops.

export type SourceId = string
export type Source = { id: SourceId; title: string; device?: string; video: string }

// The LC08SP's external inputs (Source Labels menu: AV1-3, HDMI 1-4, HDMI iTV, Side AV). The mocked
// set wires three of them to stand-in loops; the rest have no signal.
export const SOURCES: Source[] = [
  { id: 'TV', title: 'TV', video: '' },
  { id: 'HDMI1', title: 'HDMI 1', device: 'Blu-ray player', video: 'loop-life.mp4' },
  { id: 'HDMI2', title: 'HDMI 2', device: 'Game console', video: 'loop-bars.mp4' },
  { id: 'AV1', title: 'AV1', video: '' },
  { id: 'SIDE', title: 'Side AV', video: '' },
]

export type TvState = {
  power: 'on' | 'standby'
  source: SourceId
  channels: Channel[]
  channel: number
  prevChannel: number
  volume: number
  muted: boolean
  lang: Lang
  settings: Record<number, number> // menu item id -> chosen option index or slider value
  switchSeq: number
  tuneSeq: number
}

const KEY = 'museum.philips.state.v1'

// Default picture settings (the firmware's factory values for the "Standard" picture are read where
// known; the sliders default mid-scale, inferred). Keyed by menu item id (see src/philips/menuData.ts).
const DEFAULT_SETTINGS: Record<number, number> = {
  25: 90, // Contrast
  26: 48, // Brightness
  27: 52, // Color
  29: 40, // Sharpness
  30: 0, // Color temperature -> Normal
  13: 0, // Sleeptimer -> Off
  11: 1, // Mode selection -> Home (inferred: a set installed at home, not in a shop)
}

const initial: TvState = {
  power: 'on',
  source: 'TV',
  channels: DEFAULT_LINEUP,
  channel: 0,
  prevChannel: 0,
  volume: 14,
  muted: false,
  lang: 0,
  settings: { ...DEFAULT_SETTINGS },
  switchSeq: 0,
  tuneSeq: 0,
}

function load(): TvState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      return { ...initial, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings }, power: 'on' }
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return initial
}

let state: TvState = load()
const subs = new Set<() => void>()

export function getTv() {
  return state
}
export function setTv(patch: Partial<TvState> | ((s: TvState) => Partial<TvState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  subs.forEach(f => f())
}

function subscribe(f: () => void) {
  subs.add(f)
  return () => subs.delete(f)
}
export function useTv<T>(select: (s: TvState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}

// ---- menu setting values ----
export function getSetting(id: number, fallback = 0): number {
  const v = state.settings[id]
  return v === undefined ? fallback : v
}
export function setSetting(id: number, value: number) {
  setTv(s => ({ settings: { ...s.settings, [id]: value } }))
}

// ---- derived helpers ----
export function currentChannel(s: TvState): Channel | undefined {
  return s.channels[s.channel]
}
export function currentSource(s: TvState): Source {
  return SOURCES.find(x => x.id === s.source) ?? SOURCES[0]
}
export function currentVideo(s: TvState): string {
  if (s.source !== 'TV') return currentSource(s).video
  const ch = currentChannel(s)
  return ch && ch.kind === 'tv' ? ch.video : ''
}
export function switchSource(id: SourceId) {
  setTv(s => ({ source: id, switchSeq: s.switchSeq + 1 }))
}
export function tuneChannel(index: number) {
  setTv(s => {
    if (!s.channels.length) return {}
    const i = ((index % s.channels.length) + s.channels.length) % s.channels.length
    return { source: 'TV', channel: i, prevChannel: s.channel, tuneSeq: s.tuneSeq + 1 }
  })
}
