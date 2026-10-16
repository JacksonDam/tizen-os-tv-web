import { useEffect, useRef, useState } from 'react'
import type { AppProps } from '../../apps/registry'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import { setTv, tuneChannel } from '../../tv/store'
import { sortLineup, type Channel } from '../../tv/channels'
import {
  MOCK_SCAN, SCAN_SPEED, countRows, foundAt, highlightAt, makePlan, percentAt, textAt,
  type Antenna, type ChannelTypeChoice, type ScanPlan,
} from './scan'
import './channel-search.css'

// org.tizen.channel-search (spec2/channels.md 2.3-2.8): full-screen native EFL app on the FLUX page
// background. Option page -> progress page (inline stop confirmation) -> result page; pages switch
// instantly (2.9). Close tunes the first stored channel and returns to live TV.

type Phase = { page: 'options' } | { page: 'progress'; plan: ScanPlan } | { page: 'result'; plan: ScanPlan; found: Channel[] }

// Option values survive between launches (the TV keeps them in vconf).
let saved: Record<string, string> = {}

// `embedded`: first-time setup runs the scan as one of its pages (wizard page channel-scan): no option
// page (the antenna was chosen on the TV source page), and Close hands back to the wizard instead of
// tuning live TV.
export type EmbeddedScan = { onDone: () => void }

export function ChannelSearch({ onExit, embedded }: AppProps & { embedded?: EmbeddedScan }) {
  const [phase, setPhase] = useState<Phase>(() =>
    embedded ? { page: 'progress', plan: makePlan('Air', 'Digital & Analog') } : { page: 'options' },
  )
  const [values, setValues] = useState(saved)

  const start = () => {
    const antenna = (values.antenna ?? 'Air') as Antenna
    const type = (values.type ?? 'Digital & Analog') as ChannelTypeChoice
    setPhase({ page: 'progress', plan: makePlan(antenna, type) })
  }
  // Search done, or Stop -> Yes: the MW stores what was found (t_SetModeFinal) and tunes the first
  // service in navigation order. Only the Air list is modelled; other inputs leave it as it is.
  const finish = (plan: ScanPlan, found: Channel[]) => {
    if (plan.antenna === 'Air') setTv({ channels: sortLineup(found), channel: 0 })
    setPhase({ page: 'result', plan, found })
  }
  const close = () => {
    if (embedded) return embedded.onDone()
    tuneChannel(0)
    onExit('live')
  }

  return (
    <div className="cs">
      {phase.page === 'options' && (
        <OptionPage
          values={values}
          onChange={(k, v) => {
            saved = { ...values, [k]: v }
            setValues(saved)
          }}
          onScan={start}
          onExit={() => onExit('live')}
        />
      )}
      {phase.page === 'progress' && <ProgressPage plan={phase.plan} onDone={found => finish(phase.plan, found)} />}
      {phase.page === 'result' && <ResultPage plan={phase.plan} found={phase.found} onClose={close} />}
    </div>
  )
}

// ---- title block (CTitleTextbox, 2.3.1): T60 700 title, T32 sub title, T24 third line ----

function Titles({ type, title, sub, help }: { type: 'options' | 'progress' | 'result'; title: string; sub: string; help?: string }) {
  return (
    <div className={`cs-titles cs-titles--${type}`}>
      <div className="cs-titles__title">{title}</div>
      <div className="cs-titles__sub">{sub}</div>
      {help !== undefined && <div className="cs-titles__help">{help}</div>}
    </div>
  )
}

function Buttons({ labels, focus, disabled }: { labels: string[]; focus: number; disabled?: boolean }) {
  return (
    <div className="cs-buttons">
      {labels.map((b, i) => (
        <div key={b} className={`flux-btn cs-button ${focus === i ? 'is-focused' : ''} ${disabled ? 'is-disabled' : ''}`}>
          {b}
        </div>
      ))}
    </div>
  )
}

function CountList({ rows }: { rows: [string, string][] }) {
  return (
    <div className="cs-list">
      {rows.map(([label, value], i) => (
        <div key={label} className={`cs-row ${i > 0 ? 'has-divider' : ''}`}>
          <span className="cs-row__main">{label}</span>
          <span className="cs-row__sub">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ---- option page (CAntennaSearchOptionDVBView, 2.4) ----

type OptRow = { key: string; title: string; options?: string[]; help: string }

const ANTENNA_ROW: OptRow = { key: 'antenna', title: 'Antenna', options: ['Air', 'Cable', 'Satellite'], help: 'Select current connected antenna.' }
const TYPE_ROW: OptRow = {
  key: 'type', title: 'Channel Type', options: ['Digital & Analog', 'Digital', 'Analog'],
  help: 'Select Digital & Analog or Digital or Analog for channel scan.',
}
// Rows per antenna (2.4 table). "Select to Change Option" rows open sub-pages that are not modelled.
const ROWS: Record<Antenna, OptRow[]> = {
  Air: [ANTENNA_ROW, TYPE_ROW],
  Cable: [
    ANTENNA_ROW,
    TYPE_ROW,
    { key: 'operator', title: 'Operator Selection', options: ['Others'], help: 'Select the cable service provider.' },
    { key: 'network', title: 'Network', help: 'Set items about network and Channel signal for channel scan.' },
    { key: 'searchmode', title: 'Search Mode', options: ['Full', 'Network', 'Quick'], help: 'Select how you want to scan for channels.' },
  ],
  Satellite: [
    ANTENNA_ROW,
    { key: 'satellites', title: 'Satellite Selection', help: 'Select the satellites you want to use.' },
    { key: 'scope', title: 'Scan scope', options: ['All Channels', 'Free Channels Only'], help: "Select whether to scan for free channels only, or everything that's available." },
    { key: 'sattype', title: 'Channel Type', options: ['All', 'TV', 'Radio'], help: 'Select whether to search for TV channels only, radio channels only, or both.' },
    { key: 'lnb', title: 'LNB Settings', help: 'Configure your satellite equipment parameters.' },
    { key: 'satcr', title: 'SatCR/Unicable', help: 'Configure single cable installation.' },
  ],
}

const LIST_TOP = 516   // first row: BODY y 480 + 4.5 u padding
const LIST_BOTTOM = 908

type OptionProps = {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onScan: () => void
  onExit: () => void
}

function OptionPage({ values, onChange, onScan, onExit }: OptionProps) {
  const antenna = (values.antenna ?? 'Air') as Antenna
  const rows = ROWS[antenna]
  // Scan is dimmed while the options are invalid: no satellite chosen yet (m_NeedSearchButtonDisabled)
  const scanEnabled = antenna !== 'Satellite'
  const [focus, setFocus] = useState(0) // first row (t_SetDefaultFocus, inferred)
  const [picker, setPicker] = useState<{ row: OptRow; focus: number } | null>(null)
  useMoveSound(focus)
  useMoveSound(picker?.focus, !!picker)
  const valueOf = (r: OptRow) => (r.options ? (values[r.key] ?? r.options[0]) : 'Select to Change Option')
  const onButton = focus === rows.length

  useRemote(key => {
    if (key === 'Home') return false
    if (picker) {
      const opts = picker.row.options ?? []
      if (key === 'Up') setPicker({ ...picker, focus: Math.max(0, picker.focus - 1) })
      else if (key === 'Down') setPicker({ ...picker, focus: Math.min(opts.length - 1, picker.focus + 1) })
      else if (key === 'Enter') {
        onChange(picker.row.key, opts[picker.focus])
        setPicker(null)
      } else if (key === 'Back') setPicker(null)
      return true
    }
    if (key === 'Up') setFocus(onButton ? rows.length - 1 : Math.max(0, focus - 1))
    else if (key === 'Down') setFocus(Math.min(scanEnabled ? rows.length : rows.length - 1, focus + 1))
    else if (key === 'Enter') {
      if (onButton) onScan()
      else if (rows[focus].options) {
        const r = rows[focus]
        setPicker({ row: r, focus: Math.max(0, r.options!.indexOf(valueOf(r))) })
      }
    } else if (key === 'Back' || key === 'Exit') onExit()
    return true
  })

  // keep the focused row inside the BODY
  const scroll = useRef(0)
  if (!onButton) {
    const top = LIST_TOP + focus * 80 - scroll.current
    if (top < LIST_TOP) scroll.current = focus * 80
    else if (top + 80 > LIST_BOTTOM) scroll.current = (focus + 1) * 80 - (LIST_BOTTOM - LIST_TOP)
  }

  const help = onButton ? 'Select Scan to scan for channels.' : rows[focus].help
  const pickerRowTop = picker ? LIST_TOP + rows.indexOf(picker.row) * 80 - scroll.current : 0
  return (
    <>
      <Titles
        type="options"
        title="Scan Channels"
        sub="Select each item and choose the correct setting. Then select Scan to search for channels."
        help={help}
      />
      <div className="cs-list cs-list--scroll">
        <div className="cs-list__inner" style={{ transform: `translateY(${-scroll.current}px)` }}>
          {rows.map((r, i) => (
            <div key={r.key} className={`cs-row ${i > 0 ? 'has-divider' : ''} ${focus === i && !picker ? 'is-focused' : ''}`}>
              <span className="cs-row__main">{r.title}</span>
              <span className="cs-row__sub">{valueOf(r)}</span>
            </div>
          ))}
        </div>
      </div>
      <Buttons labels={['Scan']} focus={onButton && !picker ? 0 : -1} disabled={!scanEnabled} />
      {picker && (
        <>
          <div className="cs-dim" />
          <Picker options={picker.row.options ?? []} focus={picker.focus} value={valueOf(picker.row)} rowTop={pickerRowTop} />
        </>
      )}
    </>
  )
}

// Drop-down option list (COptionDVBSublistWidget, drawn like the All Settings P_ListOption_02):
// right edge on the row's, vertically centred on it.
function Picker({ options, focus, value, rowTop }: { options: string[]; focus: number; value: string; rowTop: number }) {
  const height = 64 + options.length * 72 + (options.length - 1) * 8
  const top = Math.max(24, Math.min(1080 - 24 - height, rowTop + 40 - height / 2))
  return (
    <div className="cs-picker" style={{ top, height }}>
      {options.map((o, i) => (
        <div key={o} className={`cs-picker__row ${i === focus ? 'is-focused' : ''}`}>
          <span>{o}</span>
          {o === value && <img className="cs-picker__check" src={`${TV}/VD_ICONS/i_icon_info_check.svg`} alt="" />}
        </div>
      ))}
    </div>
  )
}

// ---- progress page (CAutoTuneProgressDVBView, 2.5) with the inline stop confirmation (2.6) ----

function ProgressPage({ plan, onDone }: { plan: ScanPlan; onDone: (found: Channel[]) => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [confirm, setConfirm] = useState<number | null>(null) // focused button while "stop?" shows
  useMoveSound(confirm)
  const t = useRef(0)
  const done = useRef(false)
  const finish = useRef(onDone)
  finish.current = onDone

  // The progress timer runs in scan time (SCAN_SPEED x real time) and is frozen while the stop
  // confirmation shows (ecore_timer_freeze). At 100 % it holds for 800 ms, then the result page.
  const frozen = confirm !== null
  useEffect(() => {
    if (frozen) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      t.current += (now - last) * SCAN_SPEED
      last = now
      setElapsed(t.current)
      if (t.current >= plan.totalMs + MOCK_SCAN.holdAt100Ms && !done.current) {
        done.current = true
        finish.current(foundAt(plan, plan.totalMs))
      }
    }, 50)
    return () => clearInterval(id)
  }, [frozen, plan])

  useRemote(key => {
    if (key === 'Home') return false
    if (done.current) return true
    if (confirm === null) {
      if (key === 'Enter' || key === 'Back') setConfirm(0) // Back is consumed by the Stop handler (inferred: as Stop)
      return true
    }
    if (key === 'Left' || key === 'Right') setConfirm(key === 'Left' ? 0 : 1)
    else if ((key === 'Enter' && confirm === 1) || key === 'Back') setConfirm(null)
    else if (key === 'Enter') {
      done.current = true
      onDone(foundAt(plan, t.current))
    }
    return true
  })

  const at = Math.min(elapsed, plan.totalMs)
  const hl = !frozen && highlightAt(plan, at)
  const pct = percentAt(plan, at)
  return (
    <>
      <Titles type="progress" title="Scan Channels" sub={frozen ? 'Do you want to stop scanning?' : 'Scanning for channels...'} />
      <div className={`cs-progress ${hl ? 'is-highlight' : ''}`}>
        <span className="cs-progress__text1">{textAt(plan, at)}</span>
        <span className="cs-progress__text2">{pct}%</span>
        <span className="cs-progress__track">
          <span className="cs-progress__fill" style={{ width: `${pct}%` }} />
        </span>
      </div>
      <CountList rows={countRows(plan, foundAt(plan, at))} />
      {frozen ? <Buttons labels={['Yes', 'No']} focus={confirm} /> : <Buttons labels={['Stop']} focus={0} />}
    </>
  )
}

// ---- result page (CAutoTuneResultDVBView, 2.7) ----

function ResultPage({ plan, found, onClose }: { plan: ScanPlan; found: Channel[]; onClose: () => void }) {
  const [keySeq, setKeySeq] = useState(0)
  // idle timeout (menu setting, 60 s by default): closes like Close (inferred)
  useEffect(() => {
    const id = setTimeout(onClose, 60000)
    return () => clearTimeout(id)
  }, [keySeq, onClose])

  useRemote(key => {
    if (key === 'Home') return false
    setKeySeq(n => n + 1)
    if (key === 'Enter' || key === 'Back' || key === 'Exit') onClose() // Enter on Close = Back
    return true
  })

  const sub = found.length ? `${found.length} channels were found and stored on your TV.` : 'Check the antenna cable connection.'
  return (
    <>
      <Titles type="result" title="Channel Scan Complete!" sub={sub} />
      <CountList rows={countRows(plan, found)} />
      <Buttons labels={['Close']} focus={0} />
    </>
  )
}
