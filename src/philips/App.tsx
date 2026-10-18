import { useEffect, useState, useSyncExternalStore } from 'react'
import { useFallbackKeys, useSystemKeys, type RemoteKey } from '../input/remote'
import { RemotePanel } from '../remote/RemotePanel'
import { Stage } from '../stage/Stage'
import { OsdPlane, useJuice } from './fw/osd'
import { LiveTv } from './LiveTv'
import { SltvPicture } from './SltvPicture'
import { REMOTE_PHILIPS } from './remote'
import { getTv, setTv, subscribeTv, useTv } from './tv/store'
import { strings } from './ui/env'
import { bootUi, tvKey } from './ui/tv'
import { env, paintAll, paintSeq, repaint, screenKey, subscribeScreens } from './ui/screens'

export default function App() {
  const j = useJuice(env)
  const [ready, setReady] = useState(false)
  const lang = useTv(s => s.lang)
  const power = useTv(s => s.power)
  const seq = useSyncExternalStore(subscribeScreens, paintSeq)
  const tv = useSyncExternalStore(subscribeTv, getTv)

  useEffect(() => {
    strings.use(lang).then(() => {
      setReady(true)
      repaint()
    })
  }, [lang])
  useEffect(() => {
    if (j && ready) bootUi(j)
  }, [j, ready])

  useSystemKeys(key => {
    if (key === 'Power') {
      setTv(s => ({ power: s.power === 'on' ? 'standby' : 'on' }))
      return true
    }
    return getTv().power !== 'on'
  })
  useFallbackKeys((key: RemoteKey) => {
    if (getTv().power !== 'on' || !j) return true
    return screenKey(key) || tvKey(key, j)
  })

  return (
    <div className="shell">
      <Stage>
        <LiveTv />
        {power === 'on' && <SltvPicture />}
        {power === 'on' && <OsdPlane juice={ready ? j : null} seq={[seq, tv]} paint={paintAll} />}
        {power !== 'on' && <div className="ph-standby" />}
      </Stage>
      <RemotePanel layout={REMOTE_PHILIPS} />
    </div>
  )
}
