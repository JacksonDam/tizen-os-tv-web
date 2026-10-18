import { openApp, registerApp, registerHotkey } from '../../../shell'
import { GuideApp } from './GuideApp'

registerApp({ id: 'guide', component: GuideApp, z: 200 })
registerHotkey('Guide', () => openApp('guide'))
