import { getSetting, setSetting } from '../../../tv/store'
import { COUNTRIES, LANGUAGES } from './strings'

// What the Plug & Play pages chose. Kept for the run (going back shows the earlier choices) and written
// to the TV settings: 'menuLanguage' (the UI stays English), 'country' (read by the Smart Hub),
// 'networkType' ('Wireless' | 'Wired' | 'No Network').

export type ChannelSource = 'Aerial' | 'Set-top box'
export type NetworkType = 'Wireless' | 'Wired' | 'No Network'

export const pnp = {
  language: 0,
  country: COUNTRIES.indexOf('United Kingdom'),
  channelSource: 'Aerial' as ChannelSource,
  stbSource: '' as string,         // input chosen in the Source row (Set-top box only)
  networkType: 'Wireless' as NetworkType,
}

// A new run starts from the defaults (the firmware resets them at the start of a power-on PnP:
// CMenuWindowManager::t_InitDefaultCountry; network type Wireless as in the reference footage).
export function resetPnp() {
  pnp.language = 0
  pnp.country = COUNTRIES.indexOf('United Kingdom')
  pnp.channelSource = 'Aerial'
  pnp.stbSource = ''
  pnp.networkType = 'Wireless'
}

export function saveLanguage() {
  setSetting('menuLanguage', LANGUAGES[pnp.language])
}

export function saveConfigure() {
  setSetting('country', COUNTRIES[pnp.country])
  setSetting('networkType', pnp.networkType)
}

export function currentCountry() {
  return getSetting<string>('country', 'United Kingdom')
}
