import { useState } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { currentChannel, currentSource, getTv, setTv, useTv } from '../../tv/store'
import { MUXES } from '../../tv/channels'
import type { AppProps } from '../../apps/registry'
import { SD_APP_ID } from './sdData'
import '../allsettings/all-settings.css'

// Signal Information (com.samsung.tv.broadcastingmenu ID=signal-information, spec3/diag.md 4.5): the
// settings-datafw page signal-information.json drawn by the menu framework in the All Settings card
// over the picture. DVB-T rows from its menutree (the provider names them at runtime: broadcastingmenu.mo),
// "slider.information" rows with a bar, and Signal History. CH up/down retunes and the values follow.
// HDMI inputs show the input's resolution instead. Values are mock (the tuner is mocked).

const T = {
  title: 'Signal Information',
  channel: 'Channel',
  multiplex: 'Multiplex',
  network: 'Network',
  physical: 'Physical Channel',
  frequency: 'Frequency',
  bandwidth: 'Bandwidth',
  modulation: 'Modulation',
  program: 'Program Number',
  serviceId: 'Service ID',
  strength: 'Signal Strength',
  quality: 'Signal Quality',
  ber: 'Bit Error Level (E-6)',
  snr: 'SNR',
  history: 'Signal History',
  hint: 'To check the signal of each channel, press channel up or down on your remote control.',
  resolution: 'Resolution',
  hdmiHint: 'Check the signal of the current external device.',
  noHistory: 'The information below shows the channel numbers that were automatically saved when signal strength was weak.',
}

type Row = { title: string; value?: string; bar?: number; action?: boolean }

function tunerRows(): Row[] {
  const tv = getTv()
  const ch = currentChannel(tv)
  if (!ch || !ch.rf) return [{ title: T.channel, value: '-' }]
  const muxIndex = MUXES.findIndex(m => m.rf === ch.rf)
  const t2 = muxIndex === 0 || muxIndex === 3 // Mux A and D are DVB-T2 (channels.ts)
  const svc = MUXES[muxIndex].services.findIndex(s => s[0] === ch.number)
  // a steady per-mux reading with a little movement (mock)
  const base = [82, 76, 71, 85, 68, 63][muxIndex] ?? 70
  return [
    { title: T.channel, value: `${ch.number} ${ch.name}` },
    { title: T.multiplex, value: `Mux ${String.fromCharCode(65 + muxIndex)}` },
    { title: T.network, value: 'Freeview Air' },
    { title: T.physical, value: String(ch.rf) },
    { title: T.frequency, value: `${ch.freqMHz} MHz` },
    { title: T.bandwidth, value: '8 MHz' },
    { title: T.modulation, value: t2 ? 'DVB-T2 256QAM' : 'DVB-T 64QAM' },
    { title: T.program, value: String(4160 + muxIndex * 64 + svc) },
    { title: T.strength, value: `${base}%`, bar: base },
    { title: T.quality, value: `${base + 10}%`, bar: base + 10 },
    { title: T.ber, value: '0' },
    { title: T.snr, value: `${(24 + (base - 60) / 4).toFixed(1)} dB` },
    { title: T.history, action: true },
  ]
}

export function SignalInfo({ onExit, launch, args }: AppProps) {
  useTv(s => `${s.source}:${s.channel}`) // re-render on retune
  const tv = getTv()
  const isTv = tv.source === 'TV'
  const rows: Row[] = isTv ? tunerRows() : [{ title: T.resolution, value: '1920x1080 / 60p' }]
  const [focus, setFocus] = useState(0)
  const [history, setHistory] = useState(false)
  useMoveSound(focus)

  const leave = () => {
    if (args?.PrevSubmenu === SD_APP_ID) launch('devicecare', { view: 'selfdiag', focus: 'Signal' })
    else onExit('live')
  }

  useRemote((key: RemoteKey) => {
    if (key === 'Home') return false
    if (history) {
      if (key === 'Back' || key === 'Enter') setHistory(false)
      return true
    }
    if (key === 'Up') setFocus(f => Math.max(-1, f - 1))
    else if (key === 'Down') setFocus(f => Math.min(rows.length - 1, f + 1))
    else if (key === 'Back' || (key === 'Enter' && focus === -1)) leave()
    else if (key === 'Enter' && rows[focus]?.action) setHistory(true)
    else if ((key === 'ChannelUp' || key === 'ChannelDown') && isTv && tv.channels.length) {
      // retune in place (no channel banner): the page stays up
      const n = tv.channels.length
      setTv({ channel: (tv.channel + (key === 'ChannelUp' ? 1 : n - 1)) % n })
    } else if (key === 'Exit') onExit('live')
    return true
  })

  // rows: title.value 112 px, divider slot 8 px, inside one group (All Settings layout)
  let y = 8
  const tops = rows.map((_, i) => {
    if (i > 0) y += 8
    const t = y
    y += 112
    return t
  })
  const viewport = 584
  const f = Math.max(0, focus)
  const scroll = Math.max(0, Math.min(tops[f] + 120 - viewport, y + 8 - viewport))

  return (
    <div className="as si">
      <div className="as__panel">
        <div className="as__page">
          <div className="as__top">
            <div className={`as__back ${focus === -1 ? 'is-focused' : ''}`}>
              <span className="as__back-icon" />
            </div>
            <div className="as__title">{history ? T.history : T.title}</div>
          </div>
          <div className="as__viewport">
            {history ? (
              <div className="si__history">{T.noHistory}</div>
            ) : (
              <div className="as__list" style={{ transform: `translateY(${-Math.max(0, scroll)}px)` }}>
                <div className="as__group" style={{ top: 0, height: y + 8 }} />
                {rows.map((r, i) => (
                  <div
                    key={r.title}
                    className={`as-row ${focus === i ? 'is-focused' : ''} ${i > 0 ? 'has-divider' : ''}`}
                    style={{ top: tops[i], height: r.action ? 80 : 112 }}
                  >
                    <div className="as-row__text">
                      <div className="as-row__title">{r.title}</div>
                      {!r.action && <div className="as-row__value">{r.value}</div>}
                    </div>
                    {r.bar !== undefined && (
                      <span className="si__bar">
                        <span className="si__bar-fill" style={{ width: `${r.bar}%` }} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="si__hint">{isTv ? T.hint : T.hdmiHint}</div>
      <span hidden>{currentSource(tv).id}</span>
    </div>
  )
}
