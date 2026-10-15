import { useEffect, useRef, useState } from 'react'
import { TV } from '../../assets'
import { currentChannel, currentSource, getTv, useTv, type SourceId } from '../../tv/store'
import { hhmm, programmeAt, type Channel } from '../../tv/channels'
import { playSound } from '../../tv/sound'
import './overlays.css'

// Live-TV system overlays: tv-viewer's channel banner, info banner, source switch screen and source
// banner, volume-app's volume bar and mute badge, and the No Signal screen. Geometry, timing and art:
// extract/ui/spec2/livetv.md (and device-sources-home.md B.8).

const LT = `${TV}/livetv`

// Remounting with a new `seq` re-arms a component; this keeps a shown/fading state per show cycle.
function useHideAfter(ms: number, seq: unknown, fadeMs: number) {
  const [phase, setPhase] = useState<'shown' | 'hiding' | 'hidden'>('shown')
  useEffect(() => {
    setPhase('shown')
    const a = setTimeout(() => setPhase('hiding'), ms)
    const b = setTimeout(() => setPhase('hidden'), ms + fadeMs)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [ms, seq, fadeMs])
  return phase
}

function progressOf(start: Date, end: Date, now = new Date()) {
  return Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())))
}

// ---- Channel banner (CH+/CH-, number keys, tune): 768x168 at the right edge (§1) ----

type Roll = 'up' | 'down' | 'none'

export function ChannelBanner({ seq, roll, digits }: { seq: number; roll: Roll; digits: string }) {
  const ch = useTv(currentChannel)
  // hides 2.0 s after the last key or tune, then fades out over 0.2 s
  const phase = useHideAfter(digits ? 3200 : 2000, `${seq}:${digits}`, 200)
  const [prev, setPrev] = useState<{ n: number; key: number } | null>(null)
  const last = useRef<number | undefined>(undefined)

  // keep the previous number for the roll animation
  useEffect(() => {
    if (ch && last.current !== undefined && last.current !== ch.number && roll !== 'none') {
      setPrev({ n: last.current, key: seq })
    }
    last.current = ch?.number
  }, [ch, seq, roll])

  if (phase === 'hidden' || (!ch && !digits)) return null
  const p = ch ? programmeAt(ch) : null
  return (
    <div className={`chb ${phase === 'hiding' ? 'is-hiding' : ''}`}>
      <img className="chb__bg" src={`${LT}/ch_bg_default.webp`} alt="" />
      <img className="chb__light" src={`${LT}/ch_img_lighting.webp`} alt="" />
      {digits ? (
        <div className="chb__digits">{digits}</div>
      ) : (
        ch && (
          <div className="chb__row">
            <div className="chb__text">
              <div className="chb__name">{ch.name}</div>
              <div className="chb__prog">{p?.title ?? ''}</div>
              {p && (
                <div className="chb__progress">
                  <span style={{ width: `${progressOf(p.start, p.end) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="chb__num">
              {prev && prev.key === seq && (
                <span key={`p${seq}`} className={`chb__n chb__n--out-${roll}`}>{prev.n}</span>
              )}
              <span key={`n${seq}`} className={`chb__n ${roll !== 'none' ? `chb__n--in-${roll}` : ''}`}>{ch.number}</span>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ---- Info banner (Info key): 1920x230 plate at the top (§3) ----

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function dateTime(d = new Date()) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hhmm(d)}`
}

export function InfoBanner({ seq, onHidden }: { seq: number; onHidden: () => void }) {
  const ch = useTv(currentChannel)
  const phase = useHideAfter(10000, seq, 850)
  useEffect(() => {
    if (phase === 'hidden') onHidden()
  }, [phase, onHidden])
  if (!ch || phase === 'hidden') return null
  return <TopPlate hiding={phase === 'hiding'}>{<InfoContent ch={ch} />}</TopPlate>
}

function InfoContent({ ch }: { ch: Channel }) {
  const p = programmeAt(ch)
  return (
    <>
      <div className="info__logo">
        <img src={`${LT}/info_ch_long_default_w.webp`} alt="" />
        <span>{ch.number}</span>
      </div>
      <div className="info__prog">
        <div className="info__title">{p.title}</div>
        <div className="info__ch">
          {ch.number} {ch.name}
        </div>
        <div className="info__time">
          <span>
            {hhmm(p.start)} - {hhmm(p.end)}
          </span>
          <span className="info__bar">
            <span style={{ width: `${progressOf(p.start, p.end) * 100}%` }} />
          </span>
        </div>
      </div>
      <div className="info__right">
        <div className="info__icons">
          <img src={`${LT}/${ch.hd ? 'r_icon_xs_hd_b' : 'r_icon_xs_sd_b'}.webp`} alt="" />
          <img src={`${LT}/r_icon_xs_169_b.webp`} alt="" />
          {ch.kind === 'tv' && <img src={`${LT}/r_icon_xs_dolby_dd_plus.webp`} alt="" />}
          <img src={`${LT}/r_icon_xs_ttx_b.webp`} alt="" />
        </div>
        <div className="info__date">{dateTime()}</div>
      </div>
    </>
  )
}

// Show: fade in 283 ms with zoom 1 -> 1.02, then 1.02 -> 1 over 817 ms; hide: fade + zoom 0.99, 850 ms.
function TopPlate({ hiding, children }: { hiding: boolean; children: React.ReactNode }) {
  return (
    <div className={`plate ${hiding ? 'is-hiding' : ''}`}>
      <img className="plate__bg" src={`${LT}/infobanner_bg.png`} alt="" />
      {children}
    </div>
  )
}

// ---- Source switch screen and source banner (§5, device-sources-home.md B.8) ----

const SOURCE_ICON: Record<SourceId, { xl: string; l: string }> = {
  TV: { xl: 'r_icon_device_xl_tv.webp', l: 'r_icon_device_l_tv.webp' },
  HDMI1: { xl: 'r_icon_device_xl_gamepad.webp', l: 'r_icon_device_l_gamepad.webp' },
  HDMI2: { xl: 'r_icon_device_xl_cablebox.webp', l: 'r_icon_device_l_cablebox.webp' },
}

// Full-screen rgb(17,17,17) with the input icon in a circle and its name, held at least 600 ms.
export function SourceSwitch({ onDone }: { onDone: () => void }) {
  const source = useTv(currentSource)
  useEffect(() => {
    const t = setTimeout(onDone, 700)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="ssw">
      <div className="ssw__circle">
        <img src={`${LT}/i_icon_circle_bg.svg`} alt="" />
        <img className="ssw__icon" src={`${LT}/${SOURCE_ICON[source.id].xl}`} alt="" />
      </div>
      <div className="ssw__name">{source.device ?? source.title}</div>
    </div>
  )
}

// Top plate for an external input: icon disc, name + type, resolution, info icons and the time; 5 s.
export function SourceBanner({ seq, onHidden }: { seq: number; onHidden: () => void }) {
  const source = useTv(currentSource)
  const phase = useHideAfter(5000, seq, 200)
  useEffect(() => {
    if (phase === 'hidden') onHidden()
  }, [phase, onHidden])
  if (phase === 'hidden') return null
  return (
    <TopPlate hiding={phase === 'hiding'}>
      <div className="srcb__disc">
        <img src={`${LT}/info_source_long_default_w.webp`} alt="" />
        <img className="srcb__icon" src={`${LT}/${SOURCE_ICON[source.id].l}`} alt="" />
      </div>
      <div className="srcb__info">
        {source.device && <span className="srcb__name">{source.device}</span>}
        <span className="srcb__type">{source.title}</span>
      </div>
      <div className="srcb__res">3840x2160 @60Hz</div>
      <div className="srcb__icons">
        <img src={`${LT}/r_icon_xs_uhd_b.webp`} alt="" />
        <img src={`${LT}/r_icon_xs_hdr_b.webp`} alt="" />
      </div>
      <div className="srcb__time">{hhmm(new Date())}</div>
    </TopPlate>
  )
}

// ---- Volume bar and mute badge (org.tizen.volume-app, §4) ----

export function VolumeOsd({ seq }: { seq: number }) {
  const volume = useTv(s => s.volume)
  const muted = useTv(s => s.muted)
  // the bar hides 2.0 s after the last key (fade 0.2 s); the mute badge after 1.833 s (fade 0.5 s)
  const phase = useHideAfter(muted ? 1833 : 2000, seq, muted ? 500 : 200)
  if (phase === 'hidden') return null
  if (muted) {
    return (
      <div className={`mute ${phase === 'hiding' ? 'is-hiding' : ''}`}>
        <img src={`${LT}/vol_bg_circle.png`} alt="" />
        <img className="mute__icon" src={`${LT}/vol_icon_mute.svg`} alt="" />
      </div>
    )
  }
  const pct = volume
  const h = Math.round((368 * volume) / 100)
  const tone = pct < 16 ? 'low' : pct > 84 ? 'high' : 'mid' // contrast flip as the fill passes under
  return (
    <div className={`vol vol--${tone} ${phase === 'hiding' ? 'is-hiding' : ''}`}>
      <img className="vol__bg" src={`${LT}/vol_bg_full.png`} alt="" />
      <div className="vol__pill">
        <div className="vol__fill" style={{ height: h }} />
      </div>
      <img className="vol__stroke" src={`${LT}/vol_img_bgoutstroke.png`} alt="" />
      <div className="vol__num">{volume}</div>
      <img className="vol__shadow" src={`${LT}/vol_icon_default_shadow.webp`} alt="" />
      <img className="vol__icon" src={`${LT}/vol_icon_default.svg`} alt="" />
      <div className="vol__name">TV Speaker</div>
    </div>
  )
}

// ---- No Signal (§6): TV with no channels stored ----

export function NoSignal({ onChannelScan }: { onChannelScan: () => void }) {
  const empty = useTv(s => s.source === 'TV' && s.channels.length === 0)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!empty) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 3000) // appears after 3 s without a signal
    return () => clearTimeout(t)
  }, [empty])
  if (!empty || !shown) return null
  return (
    <div className="nosig">
      <NoSignalBackground />
      <div className="nosig__col">
        <div className="nosig__icon">
          <img src={`${LT}/i_icon_circle_bg.svg`} alt="" />
          <img className="nosig__src" src={`${LT}/r_icon_device_xl_tv.webp`} alt="" />
        </div>
        <div className="nosig__name">TV</div>
        <div className="nosig__title">Channel Scan Required</div>
        <div className="nosig__desc">Press the 'Channel Scan' button to watch Live TV.</div>
      </div>
      <div className="nosig__buttons">
        <button className="flux-btn is-focused nosig__btn" onClick={onChannelScan}>
          Channel Scan
        </button>
      </div>
    </div>
  )
}

// SPhysics_NoSignal: soft teal particles drifting out from the centre over a navy field whose tint
// changes every 10 s (background.webp, then flat colours 01-06).
const TINTS = ['#091C31', '#191B39', '#07223E', '#042829', '#01222A', '#0E152D']

function NoSignalBackground() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tint, setTint] = useState(-1)
  useEffect(() => {
    const t = setInterval(() => setTint(i => (i + 1) % TINTS.length), 10000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const c = canvas.current!
    const g = c.getContext('2d')!
    const sprite = new Image()
    sprite.src = `${LT}/particle.webp`
    type P = { x: number; y: number; vx: number; vy: number; s: number; a: number; life: number; age: number }
    const ps: P[] = []
    const BURSTS: [number, number, number][] = [
      [0, 500, 15], [0, 300, 10], [50, 150, 7], [100, 250, 10], [150, 200, 7],
      [200, 300, 7], [300, 350, 15], [300, 400, 7], [300, 500, 10],
    ]
    const burst = () => {
      for (const [rMin, rMax, maxSize] of BURSTS) {
        for (let k = 0; k < 10; k++) {
          const ang = Math.random() * Math.PI * 2
          const r = rMin + Math.random() * (rMax - rMin)
          const x = 960 + Math.cos(ang) * r
          const y = 540 + Math.sin(ang) * r
          const f = 0.035 * (0.5 + Math.random() * 0.5)
          ps.push({ x, y, vx: (x - 960) * f, vy: (y - 540) * f * 1.25, s: (0.5 + Math.random() * maxSize) * 6, a: 0, life: 800 + Math.random() * 200, age: 0 })
        }
      }
    }
    let frame = 0
    let raf = 0
    const tick = () => {
      if (frame % 40 === 0 && ps.length < 600) burst()
      frame++
      g.clearRect(0, 0, 1920, 1080)
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.age++
        p.x += p.vx * 0.05
        p.y += p.vy * 0.05
        p.vx *= 0.995
        p.vy *= 0.995
        p.s *= 1.0006
        if (p.age < p.life * 0.8) p.a = Math.min(0.35, p.a + 0.02)
        else p.a -= 0.03
        if (p.a <= 0 && p.age > 10) {
          ps.splice(i, 1)
          continue
        }
        if (sprite.complete) {
          g.globalAlpha = p.a
          g.drawImage(sprite, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="nosig__bg" style={{ backgroundColor: tint < 0 ? '#06172B' : TINTS[tint] }}>
      <img className={`nosig__bgimg ${tint >= 0 ? 'is-off' : ''}`} src={`${LT}/background.webp`} alt="" />
      <canvas ref={canvas} width={1920} height={1080} />
    </div>
  )
}

// ---- Power on (org.tizen.welcome-mode "main" group) ----
// A white frame behind two black halves; the halves slide apart and the white fades over 1.1 s,
// cubic-bezier(0.630952, 0.036, 0, 0.992). The Luxo boot chime plays only when Welcome Sound
// (db/menu/sound/welcome_sound, default off) is on.
export function PowerOn({ onDone }: { onDone: () => void }) {
  const [run, setRun] = useState(false)
  useEffect(() => {
    if (getTv().settings['welcome-sound']) playSound('luxo_power_on')
    const a = requestAnimationFrame(() => requestAnimationFrame(() => setRun(true)))
    const t = setTimeout(onDone, 1300)
    return () => {
      cancelAnimationFrame(a)
      clearTimeout(t)
    }
  }, [onDone])
  return (
    <div className={`power-on ${run ? 'is-run' : ''}`}>
      <div className="power-on__white" />
      <div className="power-on__half power-on__half--top" />
      <div className="power-on__half power-on__half--bottom" />
    </div>
  )
}
