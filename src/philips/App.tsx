import { useEffect, useState } from 'react'
import { useFallbackKeys, useSystemKeys, type RemoteKey } from '../input/remote'
import { RemotePanel, type RemoteSection } from '../remote/RemotePanel'
import { Stage } from '../stage/Stage'
import { ChannelBanner, Standby, VolumeBar } from './Banner'
import { LiveTv } from './LiveTv'
import { PhilipsMenu } from './Menu'
import { getTv, setTv, SOURCES, switchSource, tuneChannel, useTv } from './store'
import './philips.css'

// The Philips 2008 standard remote (NA): POWER, SOURCE, MENU, GUIDE, INFO, the cursor pad with OK,
// BACK and EXIT, the colour keys, the digit pad and the CH / VOL rockers.
const REMOTE_PHILIPS: RemoteSection[] = [
  { type: 'row', buttons: [
    { key: 'Power', label: 'Power', kbd: 'P', cls: 'rc-btn--power' },
    { key: 'Source', label: 'Source', kbd: 'S' },
  ] },
  { type: 'row', buttons: [
    { key: 'Settings', label: 'Menu', kbd: 'Q' },
    { key: 'Guide', label: 'Guide', kbd: 'G' },
    { key: 'Info', label: 'Info', kbd: 'I' },
  ] },
  { type: 'dpad' },
  { type: 'row', buttons: [
    { key: 'Back', label: 'Back', kbd: 'Esc' },
    { key: 'Exit', label: 'Exit', kbd: 'X' },
  ] },
  { type: 'rockers' },
  { type: 'digits' },
  { type: 'row', buttons: [
    { key: 'Mute', label: 'Mute', kbd: 'M' },
    { key: 'ChannelList', label: 'Pre-Ch', kbd: 'L' },
  ] },
  { type: 'colours' },
]

// Default TV behaviour for keys that the menu did not consume (watching TV).
function defaultKey(key: RemoteKey): boolean {
  const s = getTv()
  if (s.power !== 'on') return key === 'Power'
  switch (key) {
    case 'ChannelUp':
      tuneChannel(s.channel + 1)
      return true
    case 'ChannelDown':
      tuneChannel(s.channel - 1)
      return true
    case 'Source': {
      const i = SOURCES.findIndex(x => x.id === s.source)
      switchSource(SOURCES[(i + 1) % SOURCES.length].id)
      return true
    }
    case 'Info':
      // re-show the channel banner
      setTv(st => ({ tuneSeq: st.tuneSeq + 1 }))
      return true
    default:
      return false
  }
}

export default function App() {
  const power = useTv(s => s.power)
  const [menu, setMenu] = useState(false)

  useSystemKeys(key => {
    if (key === 'Power') {
      setTv(s => ({ power: s.power === 'on' ? 'standby' : 'on' }))
      return true
    }
    if (getTv().power !== 'on') return true
    if (key === 'VolumeUp') setTv(s => ({ volume: Math.min(100, s.volume + 1), muted: false }))
    else if (key === 'VolumeDown') setTv(s => ({ volume: Math.max(0, s.volume - 1), muted: false }))
    else if (key === 'Mute') setTv(s => ({ muted: !s.muted }))
    return true
  })

  // Open the menu with MENU (Settings key). Everything else (channel, source, info) is TV behaviour.
  useFallbackKeys(key => {
    if (getTv().power !== 'on') return true
    if (key === 'Settings') {
      setMenu(true)
      return true
    }
    return defaultKey(key)
  })

  useEffect(() => {
    if (power !== 'on') setMenu(false)
  }, [power])

  return (
    <div className="shell">
      <Stage>
        <LiveTv />
        {power === 'on' && <ChannelBanner />}
        {power === 'on' && <VolumeBar />}
        {power === 'on' && menu && <PhilipsMenu close={() => setMenu(false)} />}
        <Standby />
      </Stage>
      <RemotePanel layout={REMOTE_PHILIPS} />
    </div>
  )
}
