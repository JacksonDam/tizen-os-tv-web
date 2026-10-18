// Power, boot and first-time setup: Plug & Play (app 'pnp') and Auto Tuning (app 'autotune').
// See ~/workplace/samsung-tv-qemu/extract/f13/spec/setup.md.
import { openApp, registerApp, registerHotkey, registerOverlay } from '../../shell'
import { getTv, setTv } from '../../tv/store'
import { AutoTuneApp } from './autotune/AutoTuneApp'
import { BootScreen } from './BootScreen'
import { Pnp } from './pnp/Pnp'
import { saveLastPage } from './pnp/steps'
import { powerOff, powerOn } from './power'

registerOverlay({ id: 'boot', z: 0, component: BootScreen })
registerApp({ id: 'pnp', component: Pnp, z: 500 })
registerApp({ id: 'autotune', component: AutoTuneApp, z: 400 })

// POWER toggles between standby and a cold boot.
registerHotkey('Power', () => {
  if (getTv().power === 'on') powerOff()
  else powerOn()
  return true
})

// ?setup=1 runs Plug & Play at this page load (the boot hands over to it), ?setup=0 cancels a pending
// one. A factory reset (Menu) sets setupDone false, so the next power-on runs it.
if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search).get('setup')
  // out of the box: no network configured, Smart Hub terms not agreed, no account (online round)
  if (q === '1') {
    setTv(s => ({
      setupDone: false,
      network: { ...s.network, type: 'none', ssid: null },
      smartHub: { agreed: false, account: null },
      settings: { ...s.settings, networkType: 'Wireless' },
    }))
  }
  else if (q === '0') setTv({ setupDone: true })
  if (q === '1' || q === '0') saveLastPage(null)   // a fresh run / no run to resume
}

// Test hook for captures: window.__setup.open('autotune') etc.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __setup: object }).__setup = { open: openApp, powerOn, powerOff }
}
