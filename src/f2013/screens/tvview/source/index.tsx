import { openApp, registerApp, registerHotkey } from '../../../shell'
import { SourceApp } from './SourceApp'

registerApp({ id: 'source', component: SourceApp, z: 200 })
registerHotkey('Source', () => openApp('source'))
