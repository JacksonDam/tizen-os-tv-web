import { closeApp } from '../../../shell'
import { getTv, setTv, tuneChannel } from '../../../tv/store'
import { stopMusic } from './music'

// The Plug & Play step table for this set and the end of the run (spec/setup.md 3.1).

export type PnpPage = 'movie' | 'language' | 'configure' | 'autotune' | 'complete'

// indicator position of each page in the step table [1, 3, 4, 5, 7, 8, 9, 10, 11]
// (CPlugPlayUtilTV::m_CalculatePlugPlayMaxStep @023b3a04, GetPlugPlayCurrentStep @018d0464)
export const PNP_STEP: Record<Exclude<PnpPage, 'movie'>, number> = { language: 1, configure: 2, autotune: 3, complete: 9 }
export const PNP_TOTAL = 9
export const PNP_SMARTHUB_STEP = 9   // m_nPlugPlaySmartHubCompleteStep (the cube)
export const PNP_ANI_MS = 250        // MenuOSDInfo::WIZARD_ANI_DURATION

export type PageProps = {
  hiding: boolean
  go: (page: PnpPage) => void
}

// End of Plug & Play without a network (CPlugPlaySmartHubCompleteActionWindow::t_ProcessExit @025ad5c4):
// the Smart Hub terms were not agreed, so the Menu app stops and the TV shows live TV on the channel
// the scan tuned (lowest number), or on the set-top box input. The music stops with the PnP state.
export function finishPnp(stbSource?: string) {
  stopMusic()
  setTv({ setupDone: true })
  const s = getTv()
  if (stbSource) setTv(t => ({ source: stbSource, switchSeq: t.switchSeq + 1 }))
  else if (s.channels.length) tuneChannel(s.source === 'TV' ? s.channel : 0)
  closeApp('pnp')
}
