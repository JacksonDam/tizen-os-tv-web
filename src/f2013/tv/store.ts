import { useSyncExternalStore } from 'react'
import { DEFAULT_LINEUP, type Channel } from '../../tv/channels'

// Mocked hardware and state of the 2013 TV (F-series, T-MST12DEUC): power, input source, tuner
// channels, volume, and the Menu settings values (keyed by a settings id the Menu owns).
// Persisted per browser, separately from the 2025 exhibit. The channel lineup is the museum's shared
// fictional lineup (src/tv/channels.ts) with its stand-in video loops.

export type SourceId = string

export type Source = {
  id: SourceId
  title: string            // what the TV calls the input
  device?: string          // the connected device's name (Anynet+ / edited name)
  video: string            // stand-in video loop in public/video ('' = no signal)
}

// Inputs of the mocked set; screen modules may replace this list (registerSources) with the firmware's.
export let SOURCES: Source[] = [
  { id: 'TV', title: 'TV', video: '' },
  { id: 'HDMI1', title: 'HDMI1/DVI', device: 'Game Console', video: 'loop-life.mp4' },
  { id: 'HDMI2', title: 'HDMI2', device: 'Set-top Box', video: 'loop-bars.mp4' },
]
export function registerSources(list: Source[]) {
  SOURCES = list
}

export type TvState = {
  power: 'on' | 'standby'
  source: SourceId
  channels: Channel[]
  channel: number          // index into channels
  prevChannel: number      // for PRE-CH
  volume: number           // 0..100
  muted: boolean
  settings: Record<string, string | number>
  setupDone: boolean       // first-time setup (Plug & Play) completed
  network: NetworkState    // the mocked network connection (see ./online.ts)
  smartHub: SmartHubState  // Smart Hub terms and account (see ./online.ts)
  switchSeq: number        // bumped by switchSource()
  tuneSeq: number          // bumped by tuneChannel()
}

const KEY = 'museum.2013.state.v1'

// The museum's TVs start online: connected to the fictional "Harbour View" Wi-Fi (the 2025 exhibit's
// neighbourhood, src/screens/connections/network.ts) with the Smart Hub terms agreed.
export type NetworkState = { type: 'wireless' | 'wired' | 'none'; ssid: string | null; ip: string }
export type SmartHubState = { agreed: boolean; account: string | null }
export const ONLINE_DEFAULT: { network: NetworkState; smartHub: SmartHubState } = {
  network: { type: 'wireless', ssid: 'Harbour View', ip: '192.168.0.23' },
  smartHub: { agreed: true, account: null },
}

const initial: TvState = {
  power: 'on',
  source: 'TV',
  channels: DEFAULT_LINEUP,
  channel: 0,
  prevChannel: 0,
  volume: 10,
  muted: false,
  settings: {},
  setupDone: true,
  network: ONLINE_DEFAULT.network,
  smartHub: ONLINE_DEFAULT.smartHub,
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

// Back to factory state (factory reset).
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

// ---- Menu settings values ----

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

export function switchSource(id: SourceId) {
  setTv(s => ({ source: id, switchSeq: s.switchSeq + 1 }))
}

// Tune to a channel by index (wraps around); switches the input to TV.
export function tuneChannel(index: number) {
  setTv(s => {
    if (!s.channels.length) return {}
    const i = ((index % s.channels.length) + s.channels.length) % s.channels.length
    return { source: 'TV', channel: i, prevChannel: s.channel, tuneSeq: s.tuneSeq + 1 }
  })
}
