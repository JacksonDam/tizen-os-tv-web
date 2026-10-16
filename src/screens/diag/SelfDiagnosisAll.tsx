import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { getTv } from '../../tv/store'
import { TV } from '../../assets'
import { ABOUT_TV } from '../support/supportData'
import { SD, SD_ITEMS, getResult, getRun, setResult, setRun, type SDItem, type SDResult } from './sdData'
import { FluxPopup, OptionRow, Ring, type ListRow } from './ui'

// SelfDiagnosisAll (SDSelfDiagnosisAllView, spec3/diag.md 2.4): runs Automatic items with a percentage
// ring. Individual: one item, Cancel while it runs, then the pass/fail result with its buttons. All: a
// "n/total" step counter, every untested Automatic item in turn ("Complete" for 1 s between items), then
// the Manual items as separate apps (they come back here through Device Care's `sdall` view).

const RES = `${TV}/support/self_diagnosis`
const TICK = 50          // timer interval
const SLOW_TICK = 250    // from 70 % while the result is not in yet
const PAUSE_AT = 95      // waits here until the provider answers
const RESULT_MS = 1500   // mock provider time (STApi.RunSDItemDiagnosis), inferred

export type SDAllMode =
  | { type: 'individual'; item: SDItem }
  | { type: 'all'; resume?: 'Complete' | 'Skip' | 'Stop' }

type Props = {
  mode: SDAllMode
  onClose: () => void                                  // RequestDestroyView: back to Self Diagnosis
  onLaunch: (item: SDItem, current: number, total: number) => void   // Manual item in a Test All run
  onSignalInfo: () => void                             // Check Signal Info (broadcastingmenu signal-information)
  onUpdateNow: () => void                              // SW Version popup > Update Now (SWU)
}

// The mocked data providers: every item passes, except the broadcast signal when no channel is stored
// (no antenna signal to measure, inferred).
function diagnose(name: string): SDResult {
  if (name === 'Signal') return getTv().channels.length ? 'pass' : 'fail'
  return 'pass'
}

function failMessage(): string {
  const f = ABOUT_TV.fields
  return `${SD.problem}\n\n${SD.modelCode(f[0].value)}\n${SD.swVersion(f[2].value)}\n${SD.serial(f[1].value)}`
}

// /tmp/powerhistory.dmp lines ("%d/%02d/%02d" date + "Power On by {0}" text): mock history
function powerHistory(): ListRow[] {
  const d = new Date()
  const fmt = (x: Date) => `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}`
  const y = new Date(d.getTime() - 86400000)
  return [
    { main: `${fmt(d)} Power On by Remote Control` },
    { main: `${fmt(y)} Power Off by Remote Control` },
    { main: `${fmt(y)} Power On by Remote Control` },
  ]
}

export function SelfDiagnosisAll({ mode, onClose, onLaunch, onSignalInfo, onUpdateNow }: Props) {
  const all = mode.type === 'all'
  const [item, setItem] = useState<string>(mode.type === 'individual' ? mode.item.name : '')
  const [value, setValue] = useState(0)
  const [phase, setPhase] = useState<'running' | 'complete' | 'result' | 'idle'>('idle')
  const [result, setResultState] = useState<SDResult | null>(null)
  const [popup, setPopup] = useState<null | 'skip' | 'history' | 'sw'>(null)
  const [focus, setFocus] = useState(0)
  const [, setTick] = useState(0)
  const pending = useRef<SDResult | null>(null)
  useMoveSound(focus)

  // start: the first item of the run, or carry on after a manual app came back (once: StrictMode runs
  // mount effects twice and the run is shared state)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (mode.type === 'individual') {
      start(mode.item.name)
      return
    }
    const run = getRun()
    if (!run) return onClose()
    if (mode.resume === 'Stop') {
      setRun(null)
      return onClose()
    }
    next()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Automatic items, then Manual ones (ContinueStageTwoDiagnosis)
  function next() {
    const run = getRun()!
    if (run.auto.length) {
      const name = run.auto.shift()!
      run.done++
      setRun(run)
      start(name)
    } else if (run.manual.length) {
      const name = run.manual.shift()!
      run.done++
      setRun(run)
      const it = SD_ITEMS.find(i => i.name === name)!
      onLaunch(it, run.done, run.total)
    } else {
      setRun(null)
      onClose()
    }
  }

  function start(name: string) {
    setItem(name)
    setValue(0)
    setResultState(null)
    setPhase('running')
    pending.current = null
    setTick(t => t + 1)
  }

  // the provider answers RESULT_MS after the item starts
  useEffect(() => {
    if (phase !== 'running') return
    const t = setTimeout(() => {
      pending.current = diagnose(item)
    }, RESULT_MS)
    return () => clearTimeout(t)
  }, [phase, item])

  // progress timer (OnTimer)
  useEffect(() => {
    if (phase !== 'running' || popup) return
    const ready = pending.current !== null
    if (value >= 100) {
      const r = pending.current ?? 'pass'
      setResult(item, r)
      setResultState(r)
      if (all) {
        setPhase('complete')
      } else {
        setPhase('result')
        setFocus(0)
      }
      return
    }
    if (value === PAUSE_AT && !ready) {
      const t = setTimeout(() => setTick(x => x + 1), TICK)
      return () => clearTimeout(t)
    }
    const ms = value >= 70 && !ready ? SLOW_TICK : TICK
    const t = setTimeout(() => setValue(v => v + 1), ms)
    return () => clearTimeout(t)
  })

  // "Complete" for 1 s, then the next item
  useEffect(() => {
    if (phase !== 'complete') return
    const t = setTimeout(next, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const buttons: string[] =
    phase === 'result'
      ? [
          ...(item === 'PowerStatus' ? [SD.checkHistory] : []),
          ...(item === 'SWVersion' ? [SD.checkSwVersion] : []),
          ...(item === 'Signal' ? [SD.checkSignalInfo] : []),
          SD.close,
        ]
      : !all && phase === 'running'
        ? [SD.cancel]
        : []

  useRemote(key => {
    if (key === 'Home') return false
    if (key === 'Back') {
      if (all && phase === 'running') setPopup('skip')
      else if (!all) onClose()
      return true
    }
    if (!buttons.length) return true
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons.length - 1, f + 1))
    else if (key === 'Enter') {
      const b = buttons[Math.min(focus, buttons.length - 1)]
      if (b === SD.cancel || b === SD.close) onClose()
      else if (b === SD.checkHistory) setPopup('history')
      else if (b === SD.checkSwVersion) setPopup('sw')
      else if (b === SD.checkSignalInfo) onSignalInfo()
    }
    return true
  }, !popup)

  const label = SD_ITEMS.find(i => i.name === item)?.label ?? ''
  const run = getRun()
  const pass = phase === 'result' && result === 'pass'
  const guide =
    phase === 'complete'
      ? SD.complete
      : phase === 'result'
        ? result === 'pass'
          ? item === 'PowerStatus' || item === 'SWVersion'
            ? SD.testComplete
            : SD.resultsNormal
          : failMessage()
        : SD.checking

  return (
    <div className="sda">
      {all && run && (
        <div className="sda__step">
          <span className="sda__step-current">{run.done}</span>
          <span className="sda__step-slash">/</span>
          <span className="sda__step-total">{run.total}</span>
        </div>
      )}
      <div className="sda__name">{label}</div>
      {phase === 'result' ? (
        <>
          <img className="sda__mark" src={`${RES}/${pass ? 'icon_sd_success.svg' : 'icon_sd_fail.svg'}`} alt="" />
          <div className={`sda__guide ${pass ? 'sda__guide--pass' : 'sda__guide--fail'}`}>{guide}</div>
        </>
      ) : (
        phase !== 'idle' && (
          <>
            <div className="sda__ring">
              <Ring size={320} value={value} kind="line" />
              <div className="sda__percent">{`${value}%`}</div>
            </div>
            <div className="sda__guide">{guide}</div>
          </>
        )
      )}
      {buttons.length > 0 && <OptionRow labels={buttons} focus={popup ? null : Math.min(focus, buttons.length - 1)} />}

      {popup === 'skip' && (
        <FluxPopup
          message={SD.skipOrStop}
          buttons={[SD.skip, SD.stop, SD.cancel]}
          onBack={() => setPopup(null)}
          onSelect={b => {
            setPopup(null)
            if (b === 0) {
              setResult(item, undefined) // SKIPPED: not counted
              next()
            } else if (b === 1) {
              setRun(null)
              onClose()
            }
          }}
        />
      )}
      {popup === 'history' && (
        <FluxPopup rows={powerHistory()} buttons={[SD.close]} onBack={() => setPopup(null)} onSelect={() => setPopup(null)} />
      )}
      {popup === 'sw' && (
        <FluxPopup
          rows={[{ main: SD.softwareVersion, sub: ABOUT_TV.fields[2].value }]}
          buttons={[SD.updateNow, SD.close]}
          onBack={() => setPopup(null)}
          onSelect={b => (b === 0 ? onUpdateNow() : setPopup(null))}
        />
      )}
    </div>
  )
}

// SDSelfDiagnosisAllView.PrepareItemForDiagnosisAll: the untested items, Automatic first; HDMI Test is a
// Manual hand-off here (no CEC line test on this TV) and goes first among the Manual ones.
export function prepareRun() {
  const auto: string[] = []
  const manual: string[] = []
  for (const it of SD_ITEMS) {
    if (getResult(it.name)) continue
    if (it.name === 'HDMITroubleshooting') manual.unshift(it.name)
    else if (it.type === 'Automatic') auto.push(it.name)
    else manual.push(it.name)
  }
  setRun({ auto, manual, total: auto.length + manual.length, done: 0 })
}
