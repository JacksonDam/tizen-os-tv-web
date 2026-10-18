import { useEffect, useRef, useState } from 'react'
import { PH } from './assets'
import { currentChannel, currentSource, useTv } from './store'

// Channel banner (on tune), volume bar (on volume change) and mute badge, drawn over the picture in
// the Philips OSD style. Kept simple and translucent, as on the 2009 set.

function useFlash(dep: unknown, ms: number) {
  const [on, setOn] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Initialised to the current dep so the first mount (and React 18 StrictMode's double-invoked
  // effect, where dep is unchanged) does not flash; only a real change to dep does.
  const last = useRef(dep)
  useEffect(() => {
    if (last.current === dep) return
    last.current = dep
    setOn(true)
    clearTimeout(t.current)
    t.current = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(t.current)
  }, [dep, ms])
  return on
}

export function ChannelBanner() {
  const tuneSeq = useTv(s => s.tuneSeq)
  const switchSeq = useTv(s => s.switchSeq)
  const ch = useTv(currentChannel)
  const src = useTv(currentSource)
  const source = useTv(s => s.source)
  const show = useFlash(`${tuneSeq}:${switchSeq}`, 4000)
  if (!show) return null
  if (source !== 'TV') {
    return (
      <div className="ph-banner">
        <div className="ph-banner__src">{src.title}</div>
        {src.device && <div className="ph-banner__dev">{src.device}</div>}
      </div>
    )
  }
  if (!ch) return null
  return (
    <div className="ph-banner">
      <div className="ph-banner__num">{ch.number}</div>
      <div className="ph-banner__name">{ch.name}</div>
      <div className="ph-banner__badge">{ch.delivery === 'ATV' ? 'Analogue' : 'Digital'}</div>
    </div>
  )
}

export function VolumeBar() {
  const volume = useTv(s => s.volume)
  const muted = useTv(s => s.muted)
  const show = useFlash(`${volume}:${muted}`, 2500)
  if (!show) return null
  if (muted) {
    return (
      <div className="ph-vol">
        <img className="ph-vol__mute" src={`${PH}/img/led_red.png`} alt="" />
        <span>Mute</span>
      </div>
    )
  }
  return (
    <div className="ph-vol">
      <span className="ph-vol__label">Volume</span>
      <div className="ph-vol__track">
        <div className="ph-vol__fill" style={{ width: `${volume}%` }} />
      </div>
      <span className="ph-vol__num">{volume}</span>
    </div>
  )
}

export function Standby() {
  const power = useTv(s => s.power)
  if (power === 'on') return null
  return <div className="ph-standby" />
}
