// TV viewer overlays (CViewerManager windows): channel/info banner, volume, mute, direct tune,
// no-signal and radio screens.
import { registerOverlay } from '../../../shell'
import '../tvview.css'
import { ChannelBanner } from './ChannelBanner'
import './info'
import { SignalStatus } from './SignalStatus'
import { SourceBanner } from './SourceBanner'
import { MuteOsd, VolumeOsd } from './Volume'

registerOverlay({ id: 'banner', z: 40, component: ChannelBanner })
registerOverlay({ id: 'signal', z: 20, component: SignalStatus })
registerOverlay({ id: 'sourceBanner', z: 45, component: SourceBanner })
registerOverlay({ id: 'volume', z: 900, component: VolumeOsd })
registerOverlay({ id: 'mute', z: 890, component: MuteOsd })
