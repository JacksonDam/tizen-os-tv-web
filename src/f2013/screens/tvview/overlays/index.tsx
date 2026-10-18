// TV viewer overlays (CViewerManager windows): channel/info banner, volume, mute, direct tune,
// no-signal and radio screens.
import { registerOverlay } from '../../../shell'
import '../tvview.css'
import { ChannelBanner } from './ChannelBanner'
import './info'
import { MuteOsd, VolumeOsd } from './Volume'

registerOverlay({ id: 'banner', z: 40, component: ChannelBanner })
registerOverlay({ id: 'volume', z: 900, component: VolumeOsd })
registerOverlay({ id: 'mute', z: 890, component: MuteOsd })
