import { useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { DEVICE_CARE as D } from './supportData'
import { SelfDiagnosis } from '../diag/SelfDiagnosis'
import { SelfDiagnosisAll, prepareRun, type SDAllMode } from '../diag/SelfDiagnosisAll'
import { ManageStorage } from '../diag/ManageStorage'
import { KeyLayer } from '../diag/ui'
import { SmartHubReset } from '../diag/SmartHubReset'
import { SD_APP_ID, type SDItem } from '../diag/sdData'
import './device-care.css'

// Device Care (com.samsung.SelfDiagnosis, spec2/device-sources-home.md A.5, spec3/diag.md): full-screen
// FLUX app. Checking (2.1 s) -> Home -> [Start Device Care] Progress (10 checks, about 16.5 s) -> No issues;
// Home's option row opens Manage Storage and Self Diagnosis (stacked views), Request Support (disabled)
// and Reset Smart Hub (org.tizen.smarthub-reset). It was launched with exitmenu=1, so leaving it returns
// to live TV. The test apps come back with args: view=selfdiag (focus=<item>), view=sdall (action=...)
// or view=home (focus=reset), like SDLaunchControl's launch_mech / UserData.

const TIME_SCALE = 1 // 0.5 = twice as fast (all timers below are multiplied by it)
const RES = `${TV}/support`

type View = 'checking' | 'home' | 'progress' | 'result' | 'storage' | 'selfdiag' | { sdall: SDAllMode }

function initialStack(args?: Record<string, string>): View[] {
  if (args?.view === 'selfdiag') return ['home', 'selfdiag']
  if (args?.view === 'sdall') return ['home', 'selfdiag', { sdall: { type: 'all', resume: args.action as 'Complete' | 'Skip' | 'Stop' } }]
  if (args?.view === 'home') return ['home']
  return ['checking']
}

export function DeviceCare({ onExit, args, launch }: AppProps) {
  const [stack, setStack] = useState<View[]>(() => initialStack(args))
  const view = stack[stack.length - 1]
  const setView = (v: View) => setStack(s => [...s.slice(0, -1), v])
  const push = (v: View) => setStack(s => [...s, v])
  const pop = () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  const [toast, setToast] = useState(0) // bumps to (re)show "This function isn't available."
  const [resetting, setResetting] = useState(false) // org.tizen.smarthub-reset over Device Care
  const [focusName, setFocusName] = useState(args?.view === 'selfdiag' ? args.focus : undefined)
  // Home option button that opened the current sub-view (lastSelectedButton)
  const [homeFocus, setHomeFocus] = useState(() => (args?.view === 'home' && args.focus === 'reset' ? 3 : args?.view ? 1 : -1))

  const launchTest = (item: SDItem, extra: Record<string, string>) =>
    launch(item.app!, { launchedFrom: SD_APP_ID, ...extra })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(0), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Exit/Home are not captured: the app closes (Home lets the TV open the Smart Hub). Rendered as the
  // first child so the views above it see keys first (KeyLayer).
  const rootKeys = (key: RemoteKey) => {
    if (key === 'Home') return false
    if (key === 'Exit') onExit('live')
    return true
  }

  return (
    <div className="dc" style={{ backgroundImage: `url(${RES}/i_img_bg_tile.webp)` }}>
      <KeyLayer handler={rootKeys} />
      {/* C_Header_01 on the Device Care views only; Self Diagnosis and Manage Storage have their own tops */}
      {(view === 'checking' || view === 'home' || view === 'progress' || view === 'result') && (
        <div className="dc__header">
          <div className="dc__header-title">{D.title}</div>
        </div>
      )}
      {view === 'checking' && <Checking onDone={() => setView('home')} onBack={() => onExit('live')} />}
      {view === 'home' && (
        <Home
          initialFocus={homeFocus}
          onStart={() => setView('progress')}
          onBack={() => onExit('live')}
          onUnavailable={() => setToast(t => t + 1)}
          onOption={(id, i) => {
            setHomeFocus(i)
            if (id === 'storage') push('storage')
            else if (id === 'selfdiag') {
              setFocusName(undefined)
              push('selfdiag')
            } else if (id === 'reset') setResetting(true)
          }}
        />
      )}
      {view === 'progress' && <Progress onDone={() => setView('result')} onBack={() => setView('home')} />}
      {view === 'result' && <Result onDone={() => setView('home')} />}
      {view === 'storage' && <ManageStorage onBack={pop} />}
      {view === 'selfdiag' && (
        <SelfDiagnosis
          focusName={focusName}
          onBack={pop}
          onRunItem={item => push({ sdall: { type: 'individual', item } })}
          onLaunch={item => launchTest(item, { DiagnosisType: 'Individual' })}
          onTestAll={() => {
            prepareRun()
            push({ sdall: { type: 'all' } })
          }}
        />
      )}
      {typeof view === 'object' && (
        <SelfDiagnosisAll
          key={JSON.stringify(view.sdall.type === 'individual' ? view.sdall.item.name : view.sdall)}
          mode={view.sdall}
          onClose={() => {
            if (view.sdall.type === 'individual') setFocusName(view.sdall.item.name)
            pop()
          }}
          onLaunch={(item, current, total) =>
            launchTest(item, { DiagnosisType: 'DiagnoseAll', currentDiagnosisCount: String(current), totalDiagnosisCount: String(total) })
          }
          onSignalInfo={() => launch('signal-info', { PrevSubmenu: SD_APP_ID, DiagnosisType: 'Individual' })}
          onUpdateNow={() => launch('swu', { MainAppType: 'UpgradeSearch' })}
        />
      )}
      {resetting && <SmartHubReset onDone={() => setResetting(false)} />}
      {toast > 0 && <div key={toast} className="dc-toast">{D.unavailable}</div>}
    </div>
  )
}

// ---- C_ProgressCircle_02 (Regular): ring 6.3 % of the diameter, track white 10 %, #33ADFF arc from 12 o'clock ----

function Ring({ size, value, className }: { size: number; value: number; className: string }) {
  const stroke = size * (24.34 / 384)
  const r = size / 2 - stroke / 2
  const c = 2 * Math.PI * r
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#33adff"
        strokeWidth={stroke}
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

// ---- Checking view (A.5.3): +1 % every 20 ms, one more 100 ms tick, then Home ----

function Checking({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const t = setTimeout(value < 100 ? () => setValue(v => v + 1) : onDone, (value < 100 ? 20 : 100) * TIME_SCALE)
    return () => clearTimeout(t)
  }, [value, onDone])
  useRemote(key => {
    if (key === 'Back') onBack()
    else if (key === 'Home' || key === 'Exit') return false
    return true
  })
  return (
    <div className="dc-checking">
      <Ring className="dc-checking__ring" size={128} value={value} />
      <div className="dc-checking__text">{D.checking}</div>
    </div>
  )
}

function StatusBlock({ className }: { className: string }) {
  return (
    <div className={className}>
      <img className="dc-status__icon" src={`${RES}/device_care_good_icon.svg`} alt="" />
      <div className="dc-status__text">{D.great}</div>
    </div>
  )
}

// ---- Home view (A.5.4): status, Start Device Care, option row ----

type HomeProps = {
  initialFocus: number
  onStart: () => void
  onBack: () => void
  onUnavailable: () => void
  onOption: (id: string, index: number) => void
}

function Home({ initialFocus, onStart, onBack, onUnavailable, onOption }: HomeProps) {
  const [focus, setFocus] = useState(initialFocus) // -1 = Start Device Care, 0.. = option buttons
  useMoveSound(focus)
  const last = D.options.length - 1
  useRemote(key => {
    if (key === 'Back') onBack()
    else if (key === 'Home' || key === 'Exit') return false
    else if (focus === -1) {
      if (key === 'Down') setFocus(0)
      else if (key === 'Enter') onStart()
    } else {
      if (key === 'Up') setFocus(-1)
      else if (key === 'Left') setFocus(Math.max(0, focus - 1))
      else if (key === 'Right') setFocus(Math.min(last, focus + 1))
      else if (key === 'Enter') {
        if (D.options[focus].disabled) onUnavailable()
        else onOption(D.options[focus].id, focus)
      }
    }
    return true
  })
  return (
    <>
      <StatusBlock className="dc-status dc-status--home" />
      <div className={`flux-btn dc-btn dc-btn--start ${focus === -1 ? 'is-focused' : ''}`}>{D.start}</div>
      <div className="dc-home__divider" />
      <div className="dc-options">
        {D.options.map((o, i) => (
          <div key={o.id} className={`flux-btn dc-options__btn ${focus === i ? 'is-focused' : ''} ${o.disabled ? 'is-disabled' : ''}`}>
            {o.label}
          </div>
        ))}
      </div>
    </>
  )
}

// ---- Progress view (A.5.5): tick 62 ms while the row index < 8, then 500 ms; all Done; 1 s; result ----

function Progress({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [p, setP] = useState(0) // 0..100, then 110 = all done
  const n = D.items.length
  const step = Math.floor(100 / n)
  useEffect(() => {
    const row = Math.floor(p / step)
    const ms = p >= 110 ? 1000 : p >= 100 ? 500 : row >= 8 || row === n ? 500 : 62
    const t = setTimeout(() => (p >= 110 ? onDone() : setP(p >= 100 ? 110 : p + 1)), ms * TIME_SCALE)
    return () => clearTimeout(t)
  }, [p, step, n, onDone])
  useRemote(key => {
    if (key === 'Back') onBack() // stacked view: back to Home
    else if (key === 'Home' || key === 'Exit') return false
    return true
  })

  // the three ticker rows: [previous Done] [current Processing] [next], or the last three at the end
  const cur = Math.floor(Math.min(p, 100) / step)
  let rows: { text: string; status: string; current?: boolean }[]
  if (cur >= n - 1) {
    const allDone = cur >= n
    rows = [
      { text: D.items[n - 3], status: D.done },
      { text: D.items[n - 2], status: D.done },
      { text: D.items[n - 1], status: allDone ? D.done : D.processing, current: !allDone },
    ]
  } else if (cur === 0) {
    rows = [
      { text: D.items[0], status: D.processing, current: true },
      { text: D.items[1], status: '' },
      { text: D.items[2], status: '' },
    ]
  } else {
    rows = [
      { text: D.items[cur - 1], status: D.done },
      { text: D.items[cur], status: D.processing, current: true },
      { text: D.items[cur + 1], status: '' },
    ]
  }
  const value = Math.min(p, 100)

  return (
    <>
      <div className="dc-progress__caption">{D.inProgress}</div>
      <Ring className="dc-progress__ring" size={320} value={value} />
      <div className="dc-progress__value">{`${value}%`}</div>
      <div className="dc-ticker">
        {rows.map((r, i) => (
          <div key={i} className="dc-ticker__slot">
            {i > 0 && <div className="dc-ticker__divider" />}
            <div className={`dc-ticker__row ${r.current ? 'is-current' : ''}`}>
              <span className="dc-ticker__text">{r.text}</span>
              <span className="dc-ticker__status">{r.status}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ---- No issues (A.5.6): message, status, hint, Done (OK or Back return to Home) ----

function Result({ onDone }: { onDone: () => void }) {
  useRemote(key => {
    if (key === 'Enter' || key === 'Back') onDone()
    else if (key === 'Home' || key === 'Exit') return false
    return true
  })
  return (
    <>
      <div className="dc-result__message">
        {D.complete}
        <br />
        {D.noProblems}
      </div>
      <StatusBlock className="dc-status dc-status--result" />
      <div className="dc-result__hint">{D.hint}</div>
      <div className="flux-btn dc-btn dc-btn--done is-focused">{D.done}</div>
    </>
  )
}
