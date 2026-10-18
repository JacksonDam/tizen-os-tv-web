import { useRemote } from '../../../input/remote'
import { openApp, registerApp, type AppProps } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { ColorTag } from './ColorTag'
import { ONTV } from './data'

// On TV > Timeline View (CHomeExecutor::ExecuteSubMenuItem: application 0xba, item 6). That application
// is the On TV service's own (CSmartGuideWrapper hands over to it; its screens are not in exeDSP), so as
// with any application this recreation cannot run, a plain screen stands in: the colour tag Smart Hub
// handed over and the item's name. RETURN goes back to Smart Hub on On TV, EXIT to the TV picture.
export function OnTvTimeline({ close }: AppProps) {
  useRemote(key => {
    if (key === 'Back') {
      playUi(UI_SOUND.BACK)
      openApp('smarthub', { panel: ONTV })
      return true
    }
    if (key === 'Exit') {
      close()
      return true
    }
    return key !== 'VolumeUp' && key !== 'VolumeDown' && key !== 'Mute' && key !== 'Power'
  })
  return (
    <div className="ontl">
      <ColorTag label="Timeline View" panel={ONTV} />
    </div>
  )
}

registerApp({ id: 'ontv-timeline', component: OnTvTimeline, z: 210 })
