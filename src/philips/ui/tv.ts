import type { RemoteKey } from '../../input/remote'
import type { Juice } from '../fw/juice'
import { getTv, setTv, subscribeTv, tune } from '../tv/store'
import { openSources, showBanner, updateMessage, volumeChanged } from './overlays'
import { openGuide } from './guide'
import { openChannelList } from './chlist'
import { openHome } from './home'
import { openMenu } from './menu'
import { W } from '../fw/juice'
import { repaint, show } from './screens'

// The TV layer: keys no OSD screen took (watching TV).

let booted = false
export function bootUi(j: Juice) {
  if (booted) return
  booted = true
  const q = new URLSearchParams(location.search)
  const at = q.get('menu')
  if (at !== null) openMenu(j, at ? at.split('.').map(Number) : [])
  // debug: ?show=<class>:<index>[:<flags>] draws one widget tree
  const dbg = q.get('show')
  if (dbg) {
    const [c, i, f] = dbg.split(':')
    show({ name: 'debug', layer: 99, draw: jj => jj.draw(W(c as 'panel', +i), 0, 0, +(f ?? 1)) })
  }
  // react to the mocked hardware: zapping shows the banner and the picture messages, volume the bar
  let last = getTv()
  subscribeTv(() => {
    const s = getTv()
    if (s.zapSeq !== last.zapSeq) {
      showBanner()
      updateMessage()
    }
    if (s.volSeq !== last.volSeq) volumeChanged()
    if (s.power !== last.power && s.power === 'on') updateMessage()
    last = s
  })
  updateMessage()
  repaint()
  ;(window as unknown as { __ph: object }).__ph = { j, getTv }
}

export function tvKey(k: RemoteKey, j: Juice): boolean {
  const s = getTv()
  switch (k) {
    case 'Settings':
      openHome(j)
      return true
    case 'ChannelUp':
      tune(s.channel + 1)
      return true
    case 'ChannelDown':
      tune(s.channel - 1)
      return true
    case 'PreCh':
      tune(s.prevChannel)
      return true
    case 'VolumeUp':
      setTv(t => ({ volume: Math.min(100, t.volume + 1), muted: false, volSeq: t.volSeq + 1 }))
      return true
    case 'VolumeDown':
      setTv(t => ({ volume: Math.max(0, t.volume - 1), muted: false, volSeq: t.volSeq + 1 }))
      return true
    case 'Mute':
      setTv(t => ({ muted: !t.muted, volSeq: t.volSeq + 1 }))
      return true
    case 'Source':
      openSources()
      return true
    case 'Info':
      showBanner(true)
      return true
    case 'Guide':
      openGuide()
      return true
    case 'Enter':
    case 'ChannelList':
      openChannelList()
      return true
  }
  return false
}
