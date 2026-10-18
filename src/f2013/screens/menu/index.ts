import { openApp, registerApp, registerHotkey, registerOverlay } from '../../shell'
import './menu.css'
import './dynamic'
import { MenuApp } from './Menu'
import { applyPicture, applySoundFeedback, MenuEffects } from './effects'

// The MENU key (Settings) opens the Menu (exeDSP CMenuApp::RegisterMenuKey).
registerApp({ id: 'menu', component: MenuApp, z: 300 })
registerHotkey('Settings', () => {
  openApp('menu')
})
registerOverlay({ id: 'menu-effects', z: 0, component: MenuEffects })
applyPicture()
applySoundFeedback()
