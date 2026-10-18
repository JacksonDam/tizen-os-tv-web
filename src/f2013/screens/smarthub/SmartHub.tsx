import { useState } from 'react'
import { openApp, type AppProps } from '../../shell'
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
export function SmartHub({ close, params }: AppProps) {
  const p = params as SmartHubParams | undefined
  const start = p?.page === 'welcome' ? 'welcome' : 'hub'
  const [mode, setMode] = useState<'hub' | 'welcome'>(start)
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
  return <Hub close={close} onSetup={() => setMode('welcome')} startPanel={p?.panel} />
}
