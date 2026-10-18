import { openApp, registerApp, registerHotkey } from '../../../shell'
import { ChannelListApp } from './ChannelListApp'

registerApp({ id: 'chlist', component: ChannelListApp, z: 200 })
registerHotkey('ChannelList', () => openApp('chlist'))
