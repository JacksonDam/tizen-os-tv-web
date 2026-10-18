// Smart Hub (exeDSP CHomePanelApp): the SMART HUB key opens it over the TV picture.
import { getForeground, openApp, registerApp, registerHotkey } from '../../shell'
import { SmartHub } from './SmartHub'
import './OnTvPanel'
import './MultimediaPanel'
import './MMBrowser'
import './MoviesPanel'
import './Movies2013'

registerApp({ id: 'smarthub', component: SmartHub, z: 200 })

registerHotkey('Home', () => {
  if (getForeground()?.id === 'smarthub') return true
  openApp('smarthub')
  return true
})
