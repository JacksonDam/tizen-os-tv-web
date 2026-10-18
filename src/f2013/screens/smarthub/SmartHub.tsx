import { useState } from 'react'
import { closeApp, openApp, type AppProps } from '../../shell'
import { TermsPage } from '../net/Terms'
import { CompletePage } from '../setup/pnp/CompletePage'
import { Hub } from './Hub'
import type { SmartHubParams } from './panels'
import { Welcome } from './Welcome'
import './smarthub.css'

// Smart Hub (exeDSP CHomePanelApp, application 0xbd). A fresh TV with no network and no Samsung
// account opens the panel carousel in its default configuration; Enter on a panel's button restarts the
// application in Smart Hub setup mode (RunApp(0xbd, 0xbd, 0x523)), whose Welcome page is drawn here.
// openApp('smarthub', { page: 'welcome' }) reopens the setup at its Welcome page, as the network
// wizard's "previous" result (code 2) does (CHomeWizardWindowManager::PreparePNP @02c02f90).
// openApp('smarthub', { panel }) opens the carousel with that panel centred (returning from an item a
// panel ran).
//
// Online (spec/online-net2013.md): Start runs the network app's Network Settings wizard in its Smart
// Hub setup scenario (step 1 of 7, the Menu module); once connected its Next / OK comes back here with
// { page: 'terms' } (the network result 0x7100 -> m_ProcessNetworkConnectionResult @02c01640 ->
// RequestDisclaimer), the terms page (step 2, inferred; the frame has 7 steps with the cube as the
// 7th: CSmartHubResetCompleteActionWindow::t_ProcessCreate @02603218). Agreeing ends the setup outside
// Plug & Play with the Menu's window 0x78a (activate data 0x436, HandleEvent 0x119048 @02c03078):
// "Setup complete!" with M 0x8e6, whose OK runs the Smart Hub (app 0xd9, t_ProcessExit @02603104).
type Mode = 'hub' | 'welcome' | 'terms' | 'complete'
export function SmartHub({ close, params }: AppProps) {
  const p = params as SmartHubParams | undefined
  const page = p?.page
  const start: Mode = page === 'welcome' ? 'welcome' : page === 'terms' ? 'terms' : 'hub'
  const [mode, setMode] = useState<Mode>(start)
  const [hubKey, setHubKey] = useState(0)
  if (mode === 'welcome') {
    return (
      <Welcome
        // Start (m_OnStartSetup @02c1412c): Smart Hub closes and the network application opens its
        // Network Settings wizard (app 0x5b, scenario 0x4b1), which the Menu module owns here
        onStart={() => {
          close()
          openApp('menu', { page: 'network-settings', from: 'smarthub' })
        }}
        // Exit (m_OnExitSetup @02c1409c): back to the TV picture
        onExit={close}
      />
    )
  }
  if (mode === 'terms') {
    return (
      <div className="sh-setup">
        <TermsPage
          step={2}
          total={7}
          smartHubStep={7}
          // previous step: the network wizard again (m_ProcessPreviousStep @02c018a0)
          onPrev={() => {
            closeApp('smarthub')
            openApp('menu', { page: 'network-settings', from: 'smarthub' })
          }}
          onNext={() => setMode('complete')}
          onExit={close}
        />
      </div>
    )
  }
  if (mode === 'complete') {
    return (
      <div className="sh-setup">
        <CompletePage
          hiding={false}
          go={() => {}}
          variant="network"
          frame={{ step: 7, total: 7, smartHubStep: 7 }}
          onPrev={() => setMode('terms')}
          onDone={() => {
            // OK runs the Smart Hub (app 0xd9): the carousel opens again, now online
            setHubKey(k => k + 1)
            setMode('hub')
          }}
        />
      </div>
    )
  }
  return <Hub key={hubKey} close={close} onSetup={() => setMode('welcome')} startPanel={hubKey ? undefined : p?.panel} />
}
