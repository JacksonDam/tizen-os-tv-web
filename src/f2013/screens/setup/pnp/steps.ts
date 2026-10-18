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
  saveLastPage(null)
  setTv({ setupDone: true })
  const s = getTv()
  if (stbSource) setTv(t => ({ source: stbSource, switchSeq: t.switchSeq + 1 }))
  else if (s.channels.length) tuneChannel(s.source === 'TV' ? s.channel : 0)
  closeApp('pnp')
}

// An interrupted run (power off during Plug & Play) resumes at its last page at the next power-on,
// after the welcome movie (CMenuWindowManager::t_ConvertFirstPlugPlayItemID @02593a7c:
// GetPlugPlayLastItemId; CViewerApp::t_ProcessNormalBoot @0245225c runs the welcome app first).
const LAST_KEY = 'museum.2013.pnp.last'

export function saveLastPage(page: PnpPage | null) {
  try {
    if (page && page !== 'movie') localStorage.setItem(LAST_KEY, page)
    else localStorage.removeItem(LAST_KEY)
  } catch {
    /* storage unavailable */
  }
}

export function lastPage(): Exclude<PnpPage, 'movie'> {
  try {
    const v = localStorage.getItem(LAST_KEY)
    if (v === 'configure' || v === 'autotune' || v === 'complete') return v
  } catch {
    /* storage unavailable */
  }
  return 'language'
}
