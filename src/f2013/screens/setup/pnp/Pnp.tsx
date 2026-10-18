import { useCallback, useEffect, useRef, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { openApp, type AppProps } from '../../../shell'
import { AutoTuning } from '../autotune/AutoTuning'
import { CompletePage } from './CompletePage'
import { ConfigurePage } from './ConfigurePage'
import { LanguagePage } from './LanguagePage'
import { startMusic, stopMusic } from './music'
import { pnp, resetPnp } from './state'
import { finishPnp, lastPage, PNP_ANI_MS, PNP_SMARTHUB_STEP, PNP_STEP, PNP_TOTAL, saveLastPage, type PnpPage } from './steps'
import { TermsPage } from '../../net/Terms'
import { SwUpdatePage } from '../../net/SwUpdate'
import { online } from '../../net/data'
import { useSmartHub } from '../../../tv/online'
import { WelcomeMovie } from './WelcomeMovie'
import './pnp.css'

// Plug & Play at power-on (spec/setup.md 3). The welcome movie (CMMWelcomeApp, app 0xad), then the
// wizard pages of the step table [1 Language, 3 Configure your TV, 4 Auto Tuning, 5 Clock,
// 7 Smart Hub T&C, 8 Privacy, 9 Universal remote, 10 Software Update, 11 Setup complete!]
// (CPlugPlayUtilTV::m_CalculatePlugPlayMaxStep @023b3a04: home panel set, no auto language). Without
// a network the flow is Language -> Configure your TV -> Auto Tuning -> Setup complete!
// (GetPlugPlayNextStep @023b3c24, m_GetNextClockStep @023b4bf8: no clock step for the United Kingdom,
// steps 7-10 need the network). With Channel Source "Set-top box" Auto Tuning is skipped too.
// Online (the mocked Wi-Fi connected on Configure your TV; spec/online-net2013.md): after Auto Tuning
// m_GetNextClockStep @023b4bf8 goes to the Smart Hub T&C (id 7, app 0xbd: net/Terms.tsx, indicator 5),
// then (CHomeWizardWindowManager::HandleEvent 0x119048) Software Update (id 10, app 0x4a: net/SwUpdate.tsx,
// indicator 8) and Setup complete! with M 0x8e6 (window 0x782), whose OK opens the Smart Hub.
// Privacy (id 8, app 0xbb) shows nothing for this set (inferred: the footage goes from the terms to
// Software Update) and Universal remote (id 9) is only for a set-top box (not built).
//
// ?pnp=language|configure|autotune|complete opens a page directly (captures; skips the movie).

function initialPage(): PnpPage {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('pnp')
  return q === 'language' || q === 'configure' || q === 'autotune' || q === 'terms' || q === 'swu' || q === 'complete' ? q : 'movie'
}

// params { from: 'menu' }: Plug & Play started from the Menu (t_bPlugPlayStartFromMenu): no movie and no
// music, RETURN leaves to the Menu (CPlugPlayWizardWindow::t_ProcessReturn @025adde4).
export function Pnp({ params }: AppProps) {
  const fromMenu = (params as { from?: string } | undefined)?.from === 'menu'
  // a new run starts from the defaults
  const [page, setPage] = useState<PnpPage>(() => (resetPnp(), fromMenu ? 'language' : initialPage()))
  const [hiding, setHiding] = useState(false)
  const agreed = useSmartHub().agreed
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // PnP keeps every key (each page swallows what it does not use); volume and power stay with the
  // system (t_RegisterPnPKey @025adc88). This handler is registered after the pages' (parent effects
  // run last), so it sees keys first and passes them on.
  useRemote(key => {
    if (fromMenu && key === 'Back') {
      openApp('menu')
      return true
    }
    return false
  })

  // the background music runs from the end of the movie to the end of Plug & Play
  // (CPlugPlayUtilTV::StartPlugPlayBackgroundMusic on the welcome player's stop, 0x1824)
  useEffect(() => {
    if (page !== 'movie' && !fromMenu) startMusic()
    if (!fromMenu) saveLastPage(page)
  }, [page, fromMenu])
  useEffect(() => () => stopMusic(), [])
  useEffect(() => () => clearTimeout(timer.current), [])

  // after Auto Tuning (or Configure your TV for a set-top box): the network decides
  // (m_GetNextClockStep: the Smart Hub T&C when the network is enabled, else Setup complete!)
  const afterTuning = (): PnpPage => (online() ? 'terms' : 'complete')

  // page change: the content plays its hide animation, then the next page shows
  const go = useCallback((next: PnpPage) => {
    clearTimeout(timer.current)
    setHiding(true)
    timer.current = setTimeout(() => {
      setHiding(false)
      setPage(next)
    }, PNP_ANI_MS)
  }, [])

  return (
    <div className="pnp">
      {page === 'movie' && <WelcomeMovie onEnd={() => setPage(lastPage())} />}
      {page === 'language' && <LanguagePage hiding={hiding} go={go} />}
      {page === 'configure' && <ConfigurePage hiding={hiding} go={go} />}
      {page === 'autotune' && (
        <AutoTuning
          mode="pnp"
          step={PNP_STEP.autotune}
          hiding={hiding}
          onPrev={() => go('configure')}
          onNext={() => go(afterTuning())}
        />
      )}
      {page === 'terms' && (
        <TermsPage
          step={PNP_STEP.terms}
          total={PNP_TOTAL}
          smartHubStep={PNP_SMARTHUB_STEP}
          hiding={hiding}
          onPrev={() => go(pnp.channelSource === 'Set-top box' ? 'configure' : 'autotune')}
          onNext={() => go('swu')}
        />
      )}
      {page === 'swu' && (
        <SwUpdatePage
          step={PNP_STEP.swu}
          total={PNP_TOTAL}
          smartHubStep={PNP_SMARTHUB_STEP}
          hiding={hiding}
          onPrev={() => go('terms')}
          onNext={() => go('complete')}
        />
      )}
      {page === 'complete' && (
        <CompletePage
          hiding={hiding}
          go={go}
          variant={!online() ? 'noNetwork' : agreed ? 'network' : 'notAgreed'}
          onPrev={() => go(online() ? (agreed ? 'swu' : 'terms') : pnp.channelSource === 'Set-top box' ? 'configure' : 'autotune')}
          onDone={() => finishPnp(pnp.channelSource === 'Set-top box' ? pnp.stbSource : undefined, !fromMenu && online() && agreed)}
        />
      )}
    </div>
  )
}
