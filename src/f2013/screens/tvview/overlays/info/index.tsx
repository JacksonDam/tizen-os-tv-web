// INFO banner (CViewerInfoWndAce): what INFO shows while watching TV. Spec: spec/tvview-info.md.
import { registerHotkey, registerOverlay } from '../../../../shell'
import { getTv } from '../../../../tv/store'
import { InfoBanner, requestInfo } from './InfoBanner'

registerOverlay({ id: 'info', z: 60, component: InfoBanner })

// INFO while watching: the banner for the tuned channel. On an external input INFO is the source
// banner's (CViewerSource), not this window: let the key fall through.
registerHotkey('Info', () => {
  if (getTv().source !== 'TV') return false
  requestInfo('toggle')
})
