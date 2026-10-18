// INFO banner (CViewerInfoWndAce): what INFO shows while watching TV. Spec: spec/tvview-info.md.
import { registerHotkey, registerOverlay } from '../../../../shell'
import { getTv } from '../../../../tv/store'
import { emit } from '../bus'
import { InfoBanner, requestInfo } from './InfoBanner'

registerOverlay({ id: 'info', z: 60, component: InfoBanner })

// INFO while watching: the banner for the tuned channel. On an external input INFO shows the source
// banner (CViewerSource) instead.
registerHotkey('Info', () => {
  if (getTv().source !== 'TV') {
    emit('banner')
    return
  }
  requestInfo('toggle')
})
