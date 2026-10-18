// The online Apps, Games and Social panels of the 2013 Smart Hub and the full-screen applications they
// open (area apps2013; spec samsung-tv-qemu/extract/f13/spec/online-apps2013.md).
import { openApp, registerApp } from '../../../../shell'
import { APPS } from '../../data'
import { registerOnlinePanel } from '../../panels'
import { AppsPanel } from '../apps/AppsPanel'
import { MoreApps } from '../apps/MoreApps'
import { AppRunner } from './AppRunner'
import { HubTest } from './HubTest'
import './hubapps.css'

registerApp({ id: 'hubapp', component: AppRunner, z: 210 })
registerApp({ id: 'moreapps', component: MoreApps, z: 210 })

registerOnlinePanel(APPS, AppsPanel, {
  // the Apps sub menu: item 0 "More Apps" (CHomeExecutor::m_GetSubMenuItemEnum(6, 0) = 2 -> app 0x4d)
  submenu: (index, launch) => {
    if (index !== 0) return false
    launch(() => openApp('moreapps', { from: APPS }))
    return true
  },
})

// Development harness: one panel body full screen over its panel background, without the carousel
// (window.__setup.open('hubtest', { panel: 3 })).
if (import.meta.env.DEV) {
  registerApp({ id: 'hubtest', component: HubTest, z: 205 })
  ;(window as unknown as { __hub: (panel: number) => void }).__hub = panel => openApp('hubtest', { panel })
}
