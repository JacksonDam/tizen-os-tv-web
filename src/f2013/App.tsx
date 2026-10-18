import { useEffect } from 'react'
import { useFallbackKeys, useSystemKeys, type RemoteKey } from '../input/remote'
import { RemotePanel, type RemoteSection } from '../remote/RemotePanel'
import { Stage } from '../stage/Stage'
import { LiveTv } from './live/LiveTv'
import './screens'
import { closeApp, getApp, getOverlays, runHotkey, useForeground } from './shell'
import { getTv, setTv, tuneChannel, useTv } from './tv/store'

// The 2013 remote (F-series standard remote): MENU, SMART HUB, TOOLS, RETURN and the A-D keys.
const REMOTE_2013: RemoteSection[] = [
  { type: 'row', buttons: [
    { key: 'Power', label: 'Power', kbd: 'P', cls: 'rc-btn--power' },
    { key: 'Source', label: 'Source', kbd: 'S' },
  ] },
  { type: 'digits' },
  { type: 'row', buttons: [
    { key: 'Mute', label: 'Mute', kbd: 'M' },
    { key: 'ChannelList', label: 'Ch. List', kbd: 'L' },
    { key: 'PreCh', label: 'Pre-Ch', kbd: 'R' },
  ] },
  { type: 'rockers' },
  { type: 'row', buttons: [
    { key: 'Settings', label: 'Menu', kbd: 'Q' },
    { key: 'Home', label: 'Smart Hub', kbd: 'H' },
    { key: 'Guide', label: 'Guide', kbd: 'G' },
  ] },
  { type: 'row', buttons: [
    { key: 'Tools', label: 'Tools', kbd: 'T' },
    { key: 'Info', label: 'Info', kbd: 'I' },
  ] },
  { type: 'dpad' },
  { type: 'row', buttons: [
    { key: 'Back', label: 'Return', kbd: 'Esc' },
    { key: 'Exit', label: 'Exit', kbd: 'X' },
  ] },
  { type: 'colours', labels: ['A', 'B', 'C', 'D'] },
]

// Default TV behaviour for keys that neither an application nor a registered hotkey used.
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
    case 'PreCh':
      tuneChannel(s.prevChannel)
      return true
    default:
      return false
  }
}

function Foreground() {
  const fg = useForeground()
  const def = fg && getApp(fg.id)
  if (!fg || !def) return null
  const C = def.component
  return (
    <div className="f13-app" style={{ zIndex: def.z ?? 100 }}>
      <C key={fg.seq} params={fg.params} close={() => closeApp(fg.id)} />
    </div>
  )
}

export default function App() {
  const power = useTv(s => s.power)

  // Volume, mute and power work over everything; screen modules draw the OSDs from the state.
  useSystemKeys(key => {
    if (key === 'Power') {
      if (runHotkey('Power')) return true
      setTv(s => ({ power: s.power === 'on' ? 'standby' : 'on' }))
      return true
    }
    if (getTv().power !== 'on') return true
    if (runHotkey(key)) return true
    if (key === 'VolumeUp') setTv(s => ({ volume: Math.min(100, s.volume + 1), muted: false }))
    else if (key === 'VolumeDown') setTv(s => ({ volume: Math.max(0, s.volume - 1), muted: false }))
    else if (key === 'Mute') setTv(s => ({ muted: !s.muted }))
    return true
  })
  useFallbackKeys(key => {
    if (getTv().power !== 'on') return true
    return runHotkey(key) || defaultKey(key)
  })

  useEffect(() => {
    if (power !== 'on') closeApp()
  }, [power])

  return (
    <div className="shell">
      <Stage>
        <LiveTv />
        {power === 'on' && getOverlays().map(o => <o.component key={o.id} />)}
        {power === 'on' && <Foreground />}
      </Stage>
      <RemotePanel layout={REMOTE_2013} />
    </div>
  )
}
