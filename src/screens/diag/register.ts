// Registers the Device Care test apps (Self Diagnosis) and the Tips and User Guides apps.
import { registerApp } from '../../apps/registry'
import { patchRows, registerMenuPatch } from '../allsettings/menu'
import { PictureTest } from './PictureTest'
import { SoundTest } from './SoundTest'
import { SmartHubConnectionTest } from './SmartHubConnectionTest'
import { HdmiTroubleshooting } from './HdmiTroubleshooting'
import { SignalInfo } from './SignalInfo'
import { RemoteGuide } from './RemoteGuide'

registerApp('picture-test', PictureTest)                         // org.tizen.picture-test
registerApp('sound-test', SoundTest)                             // org.tizen.sound-test
registerApp('smarthub-connection-test', SmartHubConnectionTest)  // org.tizen.smarthub-connection-test
registerApp('hdmi-troubleshooting', HdmiTroubleshooting)         // com.samsung.tv.hdmi-troubleshooting
registerApp('signal-info', SignalInfo)                           // com.samsung.tv.broadcastingmenu ID=signal-information
registerApp('remote-guide', RemoteGuide)                         // com.samsung.tv.remoteguide

// Settings > Support > Tips and User Guides
registerMenuPatch(m =>
  patchRows(m, {
    'connection-guide': { launch: { app: 'connection-guide' } },
    'remote-key-guide': { launch: { app: 'remote-guide' } },
    'e-manual': { launch: { app: 'emanual' } },
  }),
)
