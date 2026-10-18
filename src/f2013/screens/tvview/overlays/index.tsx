// TV viewer overlays (CViewerManager windows): channel/info banner, volume, mute, direct tune,
// no-signal and radio screens.
import { registerOverlay } from '../../../shell'
import '../tvview.css'
import { ChannelBanner } from './ChannelBanner'
import './info'

registerOverlay({ id: 'banner', z: 40, component: ChannelBanner })
