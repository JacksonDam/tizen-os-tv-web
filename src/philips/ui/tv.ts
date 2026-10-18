import type { RemoteKey } from '../../input/remote'
import type { Juice } from '../fw/juice'
import { getTv, setTv, tune } from '../tv/store'
import { openHome } from './home'
import { openMenu } from './menu'
import { repaint } from './screens'

// The TV layer: keys no OSD screen took (watching TV).

let booted = false
export function bootUi(j: Juice) {
  if (booted) return
  booted = true
  const q = new URLSearchParams(location.search)
  const at = q.get('menu')
  if (at !== null) openMenu(j, at ? at.split('.').map(Number) : [])
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
  }
  return false
}
