import type { Channel } from '../../../tv/channels'
import { getSetting, type TvState } from '../../tv/store'

// The TV's channel navigation mode (CTVAppUtil::GetNavigationInfo): CH +/- and the channel banner's
// position jog move inside the channels of this mode. The Channel List selects it (setting
// 'tv.chMode'); the default is All.
export type ChMode = 'all' | 'tv' | 'radio' | 'data' | 'analogue' | 'fav1' | 'fav2' | 'fav3' | 'fav4' | 'fav5'

export function chMode(): ChMode {
  return getSetting<string>('tv.chMode', 'all') as ChMode
}

function inMode(c: Channel, mode: ChMode): boolean {
  switch (mode) {
    case 'tv':
      return c.kind === 'tv'
    case 'radio':
      return c.kind === 'radio'
    case 'data':
      return c.kind === 'data'
    case 'analogue':
      return c.delivery === 'ATV'
    case 'all':
      return true
    default: {
      // Favourites: the Channel List keeps them as a list of channel numbers ('tv.<mode>') (inferred)
      const raw = getSetting<string>(`tv.${mode}`, '')
      return raw.split(',').includes(String(c.number))
    }
  }
}

// Indices (into s.channels) of the channels in the current navigation mode, in lineup order. An empty
// mode falls back to all channels (inferred: the firmware refuses to switch to an empty mode).
export function navList(s: TvState, mode = chMode()): number[] {
  const out: number[] = []
  s.channels.forEach((c, i) => {
    if (inMode(c, mode)) out.push(i)
  })
  return out.length ? out : s.channels.map((_, i) => i)
}

// The channel mode text under the channel name (CViewerCommon::GetCurChannelModeWString 0x0247d058):
// navigation (0,0) -> TVViewer string 15 'All', (0,1) 376 'TV', (0,2) 307 'Radio', (0,3) 89
// 'Data/Other', (0,7) 17 'Analogue'; favourites (case 5) use the favourites list name.
export function chModeLabel(mode = chMode()): string {
  switch (mode) {
    case 'tv':
      return 'TV'
    case 'radio':
      return 'Radio'
    case 'data':
      return 'Data/Other'
    case 'analogue':
      return 'Analogue'
    case 'all':
      return 'All'
    default:
      return `Favourites ${mode.slice(3)}`
  }
}
