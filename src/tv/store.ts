import { useSyncExternalStore } from 'react'
import { DEFAULT_LINEUP, type Channel } from './channels'

// Mocked TV hardware and state: power, input source, tuner channels, volume, and the settings values
// shared by Quick Settings and All Settings (keyed by the All Settings item id). Persisted per browser.

export type SourceId = 'TV' | 'HDMI1' | 'HDMI2'

export type Source = {
  id: SourceId
  title: string            // what the TV calls the input
  device?: string          // the connected device's name (CEC), shown as the subtitle
  video: string            // stand-in video loop for this input
}

export const SOURCES: Source[] = [
  { id: 'TV', title: 'TV', video: '' },
  { id: 'HDMI1', title: 'HDMI 1', device: 'Game Console', video: 'loop-life.mp4' },
  { id: 'HDMI2', title: 'HDMI 2', device: 'Set-top Box', video: 'loop-bars.mp4' },
]

export type TvState = {
  power: 'on' | 'standby'
  source: SourceId
  channels: Channel[]
  channel: number          // index into channels
  volume: number           // 0..100
  muted: boolean
  settings: Record<string, string | number>
  switchSeq: number        // bumped by switchSource(): the TV shows the input switch screen and banner
  tuneSeq: number          // bumped by tuneChannel(): the TV leaves any UI for the picture and shows the banner
}

const KEY = 'tizen-os-tv-web.state.v2' // v2: 38-channel lineup

const initial: TvState = {
  power: 'on',
  source: 'TV',
  channels: DEFAULT_LINEUP,
  channel: 0,
  volume: 12,
  muted: false,
  settings: {},
  switchSeq: 0,
  tuneSeq: 0,
}

function load(): TvState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...initial, ...JSON.parse(raw), power: 'on' }
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

export function resetTv() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  state = { ...initial }
  subs.forEach(f => f())
}

function subscribe(f: () => void) {
  subs.add(f)
  return () => subs.delete(f)
}

export function useTv<T>(select: (s: TvState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}

// ---- settings values shared between Quick Settings and All Settings ----

export function getSetting<T extends string | number>(id: string, fallback: T): T {
  const v = state.settings[id]
  return (v === undefined ? fallback : v) as T
}

export function setSetting(id: string, value: string | number) {
  setTv(s => ({ settings: { ...s.settings, [id]: value } }))
}

export function useSetting<T extends string | number>(id: string, fallback: T): T {
  return useTv(s => (s.settings[id] === undefined ? fallback : s.settings[id]) as T)
}

// ---- derived helpers ----

export function currentChannel(s: TvState): Channel | undefined {
  return s.channels[s.channel]
}

export function currentSource(s: TvState): Source {
  return SOURCES.find(x => x.id === s.source) ?? SOURCES[0]
}

// The stand-in video for what is on screen (empty when there is no picture).
export function currentVideo(s: TvState): string {
  if (s.source !== 'TV') return currentSource(s).video
  const ch = currentChannel(s)
  return ch && ch.kind === 'tv' ? ch.video : ''
}

// Select an input (Connected Devices card, Source key...). Selecting TV keeps the current channel.
export function switchSource(id: SourceId) {
  setTv(s => ({ source: id, switchSeq: s.switchSeq + 1 }))
}

// Tune to a channel by index (wraps around); switches the input to TV.
export function tuneChannel(index: number) {
  setTv(s => {
    if (!s.channels.length) return {}
    const i = ((index % s.channels.length) + s.channels.length) % s.channels.length
    return { source: 'TV', channel: i, tuneSeq: s.tuneSeq + 1 }
  })
}
