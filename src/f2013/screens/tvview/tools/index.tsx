import { openApp, registerApp, registerHotkey } from '../../../shell'
import { ToolsApp } from './ToolsApp'

registerApp({ id: 'tools', component: ToolsApp, z: 200 })
registerHotkey('Tools', () => openApp('tools'))
