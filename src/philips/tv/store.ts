import { useSyncExternalStore } from 'react'
import { defaultLineup, type TvChannel } from './lineup'

// Mocked hardware and settings of the 42PFL5603D/12: power, input, the installed channels, volume,
// and the TV application's property values (japiX properties, keyed by the firmware's property ids,
// see ../ui/props.ts). Persisted per browser, separately from the other exhibits.

export type TvState = {
  power: 'on' | 'standby'
  source: string             // 'TV' or an input id (../ui/sources.ts)
  channels: TvChannel[]
  channel: number            // index into channels
  prevChannel: number
  volume: number             // 0..100 (property 0x588)
  muted: boolean
  lang: string               // menu language file (fw/strings.ts LANGUAGES)
  props: Record<number, number>
  zapSeq: number             // bumped on every channel/input change (banner, messages)
  volSeq: number
}

const KEY = 'museum.philips-eu.state.v1'

const initial = (): TvState => ({
  power: 'on',
  source: 'TV',
  channels: defaultLineup(),
  channel: 0,
  prevChannel: 0,
  volume: 20,
  muted: false,
  lang: 'en',
  props: {},
  zapSeq: 0,
  volSeq: 0,
})

function load(): TvState {
  const s = initial()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...s, ...JSON.parse(raw), power: 'on' }
  } catch {
    /* storage unavailable: start fresh */
  }
  return s
}

let state: TvState = load()
const subs = new Set<() => void>()

export function getTv() {
  return state
}
export function setTv(p: Partial<TvState> | ((s: TvState) => Partial<TvState>)) {
  state = { ...state, ...(typeof p === 'function' ? p(state) : p) }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  subs.forEach(f => f())
}
export function subscribeTv(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export function useTv<T>(sel: (s: TvState) => T): T {
  return useSyncExternalStore(subscribeTv, () => sel(state))
}

export function currentChannel(s = state): TvChannel | undefined {
  return s.source === 'TV' ? s.channels[s.channel] : undefined
}
export function tune(index: number) {
  setTv(s => {
    if (!s.channels.length) return {}
    const i = ((index % s.channels.length) + s.channels.length) % s.channels.length
    return { source: 'TV', channel: i, prevChannel: s.source === 'TV' ? s.channel : s.prevChannel, zapSeq: s.zapSeq + 1 }
  })
}
export function setSource(id: string) {
  setTv(s => ({ source: id, zapSeq: s.zapSeq + 1 }))
}
export function resetTv() {
  state = initial()
  setTv({})
}
