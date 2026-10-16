import { getTv, setTv, type TvState } from '../../tv/store'
import type { AudioSettings } from './audio/engine'

// Sound settings (sound-dataprovider) as the audio engine reads them. Setting ids are the All Settings
// item ids; the Equalizer bands are 'equalizer/0'..'equalizer/6' and Balance is 'balance' (-10..10).

export const EQ_KEYS = [0, 1, 2, 3, 4, 5, 6].map(i => `equalizer/${i}`)

const num = (s: TvState, k: string, d: number) => {
  const v = s.settings[k]
  return v === undefined ? d : Number(v)
}

export function audioSettings(s: TvState): AudioSettings {
  return {
    volume: s.volume,
    muted: s.muted,
    output: num(s, 'soundoutput', 0),
    soundMode: num(s, 'sound-mode', 1),
    balance: num(s, 'balance', 0),
    eq: EQ_KEYS.map(k => num(s, k, 0)),
    autoVolume: num(s, 'autovolume', 0) === 1,
  }
}

// Reset Sound (menu/sound/resetsound): Sound Mode, Expert Settings, Balance and Equalizer to the
// defaults (vconf db/menu/sound/*); Sound Output stays.
export function resetSound() {
  const reset: Record<string, number> = {
    'sound-mode': 1, balance: 0, autovolume: 0, 'audio-format': 0, 'audio-delay': 0, 'simultaneous-optical': 1,
  }
  for (const k of EQ_KEYS) reset[k] = 0
  setTv(st => ({ settings: { ...st.settings, ...reset } }))
}

export function setSettings(patch: Record<string, number>) {
  setTv(st => ({ settings: { ...st.settings, ...patch } }))
}

export const getNum = (k: string, d: number) => num(getTv(), k, d)
