import { useCallback, useEffect, useRef, useState } from 'react'
import { Stage } from './stage/Stage'
import { Home } from './screens/home/Home'
import { AllSettings } from './screens/allsettings/AllSettings'
import { LiveVideo } from './screens/livetv/LiveVideo'
import {
  ChannelBanner, InfoBanner, NoSignal, PowerOn, SourceBanner, SourceSwitch, VolumeOsd,
} from './screens/livetv/Overlays'
import { RemotePanel } from './remote/RemotePanel'
import { APPS } from './apps/registry'
import './apps'
import { onAnyKey, useFallbackKeys, useSystemKeys, type RemoteKey } from './input/remote'
import { getTv, setTv, tuneChannel, useTv } from './tv/store'
import { playFeedback } from './tv/sound'

// The TV: live picture at the bottom; the Smart Hub (csfs), the All Settings card and full-screen apps
// above it; tv-viewer's and volume-app's overlays on top. Keys the apps do not consume reach the TV here.

type Hub = { visible: boolean; key: number; entry?: 'devices' | 'settings' }
type RunningApp = { id: string; args?: Record<string, string>; from?: string }
type Roll = 'up' | 'down' | 'none'
const TARGETS: Record<string, string | undefined> = { allsettings: undefined, support: 'support', network: 'connection' }

export default function App() {
  const [hub, setHub] = useState<Hub>({ visible: true, key: 0 })
  const [settings, setSettings] = useState<null | { target?: string }>(null)
  // a full-screen app (Device Care, channel scan, channel list...): `from` = settings category to return to
  const [app, setApp] = useState<RunningApp | null>(null)
  const [booting, setBooting] = useState(false)
  const power = useTv(s => s.power)

  // overlays: each counter re-arms its overlay; 0 = hidden
  const [chBanner, setChBanner] = useState<{ seq: number; roll: Roll }>({ seq: 0, roll: 'none' })
  const [info, setInfo] = useState(0)
  const [sourceBanner, setSourceBanner] = useState(0)
  const [switching, setSwitching] = useState(false)
  const [volume, setVolume] = useState(0)
  const [digits, setDigits] = useState('')
  const roll = useRef<Roll>('none')

  // OK plays the select sound while an app UI is on screen (FLUX plays it on key press).
  const uiVisible = useRef(false)
  uiVisible.current = hub.visible || !!settings || !!app
  useEffect(
    () =>
      onAnyKey(k => {
        if (k === 'Enter' && uiVisible.current && getTv().power === 'on') playFeedback('select')
      }),
    [],
  )
  // Home plays home_open the first time it opens the Smart Hub after power-on.
  const homeSounded = useRef(false)

  const showHub = (entry?: Hub['entry']) => {
    setSettings(null)
    setApp(null)
    setInfo(0)
    setHub(h => ({ visible: true, key: h.key + 1, entry }))
  }
  const hideHub = () => setHub(h => ({ ...h, visible: false }))

  // ---- system keys: volume, mute, power (volume-app and the power manager work over every app) ----
  useSystemKeys(key => {
    const tv = getTv()
    if (key === 'Power') {
      if (tv.power === 'on') setTv({ power: 'standby' }) // no power-off sound on a home TV
      else {
        setTv({ power: 'on' })
        homeSounded.current = false
        setBooting(true)
        showHub()
      }
      return true
    }
    if (tv.power !== 'on') return true
    if (key === 'Mute') setTv({ muted: !tv.muted })
    else if (key === 'VolumeUp') setTv({ volume: Math.min(100, tv.volume + 1), muted: false })
    else if (key === 'VolumeDown') setTv({ volume: Math.max(0, tv.volume - 1), muted: false })
    setVolume(v => v + 1)
    return true
  })

  // ---- TV keys the apps above did not consume (tv-viewer) ----
  const digitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useFallbackKeys((key: RemoteKey) => {
    const tv = getTv()
    if (tv.power !== 'on') return true
    const live = !hub.visible && !settings && !app
    switch (key) {
      case 'Home':
        if (!hub.visible) {
          if (!homeSounded.current) playFeedback('home_open')
          homeSounded.current = true
          showHub()
        }
        return true
      case 'ChannelUp':
      case 'ChannelDown':
        roll.current = key === 'ChannelUp' ? 'up' : 'down'
        tuneChannel(tv.source === 'TV' ? tv.channel + (key === 'ChannelUp' ? 1 : -1) : tv.channel)
        return true
      case 'Info':
        if (live) {
          if (tv.source === 'TV') setInfo(i => (i ? 0 : i + 1))
          else setSourceBanner(b => b + 1)
        }
        return true
      case 'Back':
      case 'Exit':
        if (key === 'Exit' && !live) {
          // Exit leaves whatever app is up for the picture
          hideHub()
          setSettings(null)
          setApp(null)
          return true
        }
        if (live) {
          const shown = info > 0 || sourceBanner > 0 || chBanner.seq > 0
          setInfo(0)
          setSourceBanner(0)
          setChBanner(b => ({ ...b, seq: 0 }))
          if (key === 'Back' && shown) playFeedback('back') // Back in the live-TV banners plays back.wav
        }
        return true
      case 'ChannelList':
        if (APPS['channel-list']) launch('channel-list')
        return true
      case 'Source':
        showHub('devices')
        return true
      case 'Settings':
        showHub('settings')
        return true
      default:
        if (key.startsWith('Digit')) {
          // direct number entry: digits show in the channel banner, tune 3 s after the last digit
          hideHub()
          const d = (digits + key.slice(5)).slice(-4)
          setDigits(d)
          clearTimeout(digitTimer.current)
          digitTimer.current = setTimeout(() => commitDigits(d), 3000)
          return true
        }
        return false
    }
  })

  const commitDigits = (d: string) => {
    setDigits('')
    const i = getTv().channels.findIndex(c => c.number === Number(d))
    if (i >= 0) {
      roll.current = 'none'
      tuneChannel(i)
    }
  }
  useEffect(() => () => clearTimeout(digitTimer.current), [])

  const launch = (id: string, args?: Record<string, string>, from?: string) => {
    if (!APPS[id]) return
    hideHub()
    setSettings(null)
    setInfo(0)
    setApp({ id, args, from })
  }
  const exitApp = (then: 'live' | 'hub' | 'settings' = 'live') => {
    const from = app?.from
    setApp(null)
    if (then === 'hub') showHub()
    else if (then === 'settings') setSettings({ target: from })
  }

  // A channel was tuned (CH keys, number entry, channel list, scan): leave any UI and show the banner.
  const tuneSeq = useTv(s => s.tuneSeq)
  const lastTune = useRef(tuneSeq)
  useEffect(() => {
    if (tuneSeq === lastTune.current) return
    lastTune.current = tuneSeq
    setHub(h => ({ ...h, visible: false }))
    setSettings(null)
    setApp(null)
    setInfo(0)
    setSourceBanner(0)
    setChBanner(b => ({ seq: b.seq + 1, roll: roll.current }))
    roll.current = 'none'
  }, [tuneSeq])

  // An input was selected (switchSource): switch screen (at least 600 ms), then the input's banner.
  const switchSeq = useTv(s => s.switchSeq)
  const lastSwitch = useRef(switchSeq)
  useEffect(() => {
    if (switchSeq === lastSwitch.current) return
    lastSwitch.current = switchSeq
    setHub(h => ({ ...h, visible: false }))
    setSettings(null)
    setApp(null)
    setInfo(0)
    setChBanner(b => ({ ...b, seq: 0 }))
    setSwitching(true)
  }, [switchSeq])
  const switchDone = useCallback(() => {
    setSwitching(false)
    if (getTv().source === 'TV') setChBanner(b => ({ seq: b.seq + 1, roll: 'none' }))
    else setSourceBanner(b => b + 1)
  }, [])

  const live = power === 'on' && !hub.visible && !settings && !app
  const on = power === 'on'

  return (
    <div className="shell">
      <Stage>
        <LiveVideo />
        {live && <NoSignal onChannelScan={() => launch('channel-search')} />}
        {on && hub.visible && (
          <Home
            key={hub.key}
            entry={hub.entry}
            onHideHub={hideHub}
            onLaunch={target => {
              hideHub()
              setSettings({ target: TARGETS[target] })
            }}
          />
        )}
        {on && settings && (
          <AllSettings target={settings.target} onClose={() => setSettings(null)} onLaunchApp={launch} />
        )}
        {on && app && APPS[app.id] && (() => {
          const A = APPS[app.id]
          return <A key={app.id} args={app.args} onExit={exitApp} launch={(id, args) => launch(id, args, app.from)} />
        })()}
        {on && switching && <SourceSwitch onDone={switchDone} />}
        {on && live && (chBanner.seq > 0 || digits) && (
          <ChannelBanner seq={chBanner.seq} roll={chBanner.roll} digits={digits} />
        )}
        {on && live && info > 0 && <InfoBanner seq={info} onHidden={() => setInfo(0)} />}
        {on && live && !switching && sourceBanner > 0 && (
          <SourceBanner seq={sourceBanner} onHidden={() => setSourceBanner(0)} />
        )}
        {on && volume > 0 && <VolumeOsd seq={volume} />}
        {booting && <PowerOn onDone={() => setBooting(false)} />}
        {!on && <div className="standby" />}
      </Stage>
      <RemotePanel />
    </div>
  )
}
