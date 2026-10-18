import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { sortLineup, type Channel } from '../../../../tv/channels'
import { F13, VIDEO } from '../../../assets'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { getTv, setTv, tuneChannel } from '../../../tv/store'
import { PNP_SMARTHUB_STEP, PNP_TOTAL } from '../pnp/steps'
import { MessageBox, Popup } from '../wizard/widgets'
import { Wizard, type NavState, type WizFocus } from '../wizard/Wizard'
import { foundAt, makePlan, SCAN_SPEED, SCAN_TIMING, stepAt, type Aerial, type ChannelType, type ScanPlan } from './scanModel'
import { T } from './strings'
import './autotune.css'

// Auto Tuning: channel search app 9 (CChannelSearchApp), EU DVB auto scan
// (CChannelSearchManagerDVBAuto): CAntennaSearchOptionWindow (options) and CAutoTuneProgressDVBWindow
// (scanning, stop prompt, result) in the wizard frame (spec/setup.md 4). CChannelSearchOSDInfo values
// are a 960x540 design: x2 on the stage; bitmaps x1.5.
//   PnP (activate 0x452): step 3 of 9, Previous/Next circles; Next on the options page only when the TV
//     already has channels (t_UpdateNaviButton @02919914); RETURN/EXIT swallowed.
//   Menu (activate 0x45a): no step indicator or circles; the "Press Start" message box first
//     (CTVAppUtil::FlagPinNumberActive @02368440 always returns 0 in this build, so no PIN); RETURN on the
//     options page and Close on the result go back to the Menu.

const SCAN = `${F13}/setup/scan`
const AERIALS: Aerial[] = ['Air', 'Cable']   // CAntennaTypeItem::m_AddAirCableItemToSublist (T2/C tuner)
const TYPES: ChannelType[] = ['Digital & Analogue', 'Digital', 'Analogue']  // data 1 / 3 / 2, default 1
const TYPE_TEXT: Record<ChannelType, string> = { 'Digital & Analogue': T.digitalAnalogue, Digital: T.digital, Analogue: T.analogue }
const ROW_Y = [436, 528]                     // GRID_Y 218 + 46 per row (base) x2
const ANI_FRAME_MS = 500                     // CCAnimatedImageDrawing 5 frames / 2500 ms

export type AutoTuningProps = {
  mode: 'pnp' | 'menu'
  step?: number
  hiding?: boolean
  onPrev?: () => void
  onNext?: () => void
  onClose?: () => void
}

type Phase = 'begin' | 'options' | 'scanning' | 'stopAsk' | 'notCompleted' | 'complete'
type OptFocus = 'list' | 'scan' | 'prev' | 'next'

// options kept while the app runs (Change settings comes back to them)
const opts = { aerial: 'Air' as Aerial, type: 'Digital & Analogue' as ChannelType }

export function AutoTuning({ mode, step = 3, hiding = false, onPrev, onNext, onClose }: AutoTuningProps) {
  const pnp = mode === 'pnp'
  const [phase, setPhase] = useState<Phase>(pnp ? 'options' : 'begin')
  const [, redraw] = useState(0)

  // ---- options page ----
  const [of, setOf] = useState<OptFocus>('list')
  const [row, setRow] = useState(0)
  const [popup, setPopup] = useState<number | null>(null)

  // ---- scanning ----
  const [plan, setPlan] = useState<ScanPlan | null>(null)
  const [t, setT] = useState(0)
  const elapsed = useRef(0)
  const running = useRef(false)
  const [aniFrame, setAniFrame] = useState(0)
  const [btn, setBtn] = useState(0)            // focused bottom button on the progress page
  const [nav, setNav] = useState<'prev' | 'next' | null>(null)
  const [preview, setPreview] = useState(false)
  const [stored, setStored] = useState<Channel[]>([])

  const startScan = () => {
    const p = makePlan(opts.aerial, opts.type, T.channel)
    setPlan(p)
    elapsed.current = 0
    setT(0)
    setPreview(false)
    setNav(null)
    setBtn(0)
    running.current = true
    setPhase('scanning')
  }

  // the scan clock: advances while scanning (paused by the stop prompt)
  useEffect(() => {
    if (phase !== 'scanning' || !plan) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      elapsed.current += (now - last) * SCAN_SPEED
      last = now
      if (elapsed.current >= plan.totalMs) {
        elapsed.current = plan.totalMs
        finish(plan, 'complete')
      }
      setT(elapsed.current)
    }, 50)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan])

  // antenna animation: 500 ms per frame while scanning, held while the stop prompt shows
  useEffect(() => {
    if (phase !== 'scanning') return
    const id = setInterval(() => setAniFrame(f => (f + 1) % 5), ANI_FRAME_MS)
    return () => clearInterval(id)
  }, [phase])

  // SearchDone: store the lineup sorted by number and tune the lowest-numbered digital channel
  // (t_SetDigitalFirstChannel @028f0584); 700 ms later the progress parts give way to the preview.
  const finish = (p: ScanPlan, result: 'complete' | 'notCompleted') => {
    running.current = false
    const found = sortLineup(foundAt(p, elapsed.current))
    setStored(found)
    setTv({ channels: found, channel: 0, prevChannel: 0 })
    if (found.length) tuneChannel(0)
    setPhase(result)
    setBtn(pnp ? 0 : 2)
    setNav(pnp ? 'next' : null)
    setTimeout(() => setPreview(true), SCAN_TIMING.resultHideMs)
  }

  // ---- keys ----
  useRemote(key => {
    if (phase === 'begin') return false   // the message box (registered before this handler) has them
    if (hiding) return true
    if (phase === 'options') return optionsKey(key)
    return progressKey(key)
  })

  const hasChannels = getTv().channels.length > 0
  const navNext: NavState = pnp ? (phase === 'options' ? (hasChannels ? 'normal' : 'disabled') : phase === 'scanning' || phase === 'stopAsk' ? 'disabled' : 'normal') : 'hidden'
  const navPrev: NavState = pnp ? (phase === 'scanning' || phase === 'stopAsk' ? 'disabled' : 'normal') : 'hidden'

  function optionsKey(key: string) {
    if (popup !== null) return true
    const rowsN = 2
    if (of === 'list') {
      if (key === 'Up') {
        if (row === 0) setOf('scan')
        else setRow(row - 1)
      } else if (key === 'Down') {
        if (row === rowsN - 1) setOf('scan')
        else setRow(row + 1)
      } else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        setPopup(row)
        return true
      } else if (key === 'Back' || key === 'Exit') {
        if (!pnp) onClose?.()
        return true
      } else return true
      playUi(16)
      return true
    }
    if (of === 'scan') {
      if (key === 'Up') {
        setRow(rowsN - 1)
        setOf('list')
      } else if (key === 'Down') {
        setRow(0)
        setOf('list')
      } else if (key === 'Left' && pnp) setOf('prev')
      else if (key === 'Right' && pnp && navNext === 'normal') setOf('next')
      else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        startScan()
        return true
      } else if ((key === 'Back' || key === 'Exit') && !pnp) {
        onClose?.()
        return true
      } else return true
      playUi(16)
      return true
    }
    // navigation circles
    if (key === 'Down') setOf('scan')
    else if ((key === 'Right' && of === 'prev') || (key === 'Left' && of === 'next')) {
      setRow(0)
      setOf('list')
    } else if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (of === 'prev') onPrev?.()
      else onNext?.()
      return true
    } else return true
    playUi(16)
    return true
  }

  function progressKey(key: string) {
    if (phase === 'scanning') {
      if (key === 'Enter' || key === 'Back') {
        // Stop or RETURN: the scan pauses and asks (result 2 -> pause state 0xc)
        playUi(key === 'Back' ? 16 : UI_SOUND.SELECT)
        running.current = false
        setBtn(1)
        setPhase('stopAsk')
      }
      return true
    }
    if (phase === 'stopAsk') {
      if (key === 'Left' || key === 'Right') {
        setBtn(key === 'Left' ? 0 : 1)
        playUi(16)
      } else if (key === 'Enter' || key === 'Exit') {
        const yes = key === 'Exit' || btn === 0
        playUi(UI_SOUND.SELECT)
        if (yes && plan) finish(plan, 'notCompleted')
        else resume()
      } else if (key === 'Back') resume()
      return true
    }
    // result: Change settings / Scan Again (/ Close), navigation circles in PnP
    const buttons = pnp ? 2 : 3
    if (nav) {
      if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        if (nav === 'prev') onPrev?.()
        else onNext?.()
      } else if (key === 'Left' && nav === 'next') {
        setNav(null)
        setBtn(buttons - 1)
        playUi(16)
      } else if (key === 'Right' && nav === 'prev') {
        setNav(null)
        setBtn(0)
        playUi(16)
      }
      return true
    }
    if (key === 'Left') {
      if (btn > 0) setBtn(btn - 1)
      else if (pnp) setNav('prev')
      else return true
      playUi(16)
    } else if (key === 'Right') {
      if (btn < buttons - 1) setBtn(btn + 1)
      else if (pnp) setNav('next')
      else return true
      playUi(16)
    } else if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (btn === 0) {
        setOf('list')
        setRow(0)
        setPhase('options')
      } else if (btn === 1) startScan()
      else onClose?.()
    } else if ((key === 'Back' || key === 'Exit') && !pnp) onClose?.()
    return true
  }

  function resume() {
    running.current = true
    setPhase('scanning')
  }

  // ---- drawing ----
  if (phase === 'begin') {
    return (
      <MessageBox
        text={T.begin}
        buttons={[T.start, T.cancel]}
        timeoutMs={60000}
        onButton={i => (i === 0 ? setPhase('options') : onClose?.())}
      />
    )
  }

  const focusFrame: WizFocus =
    phase === 'options'
      ? of === 'prev' || of === 'next' ? of : 'content'
      : nav ?? 'content'
  return (
    <>
      <Wizard
        title={T.title}
        step={step}
        total={pnp ? PNP_TOTAL : 0}
        smartHubStep={PNP_SMARTHUB_STEP}
        prev={navPrev}
        next={navNext}
        focus={focusFrame}
        hiding={hiding}
        pageKey={phase === 'options' ? 'options' : 'progress'}
      >
        {phase === 'options' ? (
          <Options focus={of} row={row} />
        ) : (
          plan && (
            <Progress
              plan={plan}
              t={t}
              phase={phase}
              frame={aniFrame}
              preview={preview}
              stored={stored}
              buttons={
                phase === 'scanning'
                  ? [T.stop]
                  : phase === 'stopAsk'
                    ? [T.yes, T.no]
                    : pnp ? [T.changeSettings, T.scanAgain] : [T.changeSettings, T.scanAgain, T.close]
              }
              focus={nav ? -1 : btn}
              menu={!pnp}
            />
          )
        )}
      </Wizard>
      {popup !== null && (
        <Popup
          items={popup === 0 ? AERIALS.map(a => (a === 'Air' ? T.air : T.cable)) : TYPES.map(x => TYPE_TEXT[x])}
          value={popup === 0 ? AERIALS.indexOf(opts.aerial) : TYPES.indexOf(opts.type)}
          right={1920 - 1140 - 15.75}
          top={ROW_Y[popup] - 15.75 - 60}
          itemH={72}
          onPick={i => {
            if (popup === 0) opts.aerial = AERIALS[i]
            else opts.type = TYPES[i]
            setPopup(null)
            redraw(n => n + 1)
          }}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}

// Rows (CAutoTuneTitleDataRenderer @02907498/@029070a4): list active: focused row #FDD911, others
// white; list inactive (focus on Scan or a circle): the focused row #FDD911 and the others white, both
// at alpha 0x66. Focus: wizard_highlight 9-slice 1032x148 at (176, row - 28).
function Options({ focus, row }: { focus: OptFocus; row: number }) {
  const rows: [string, string][] = [
    [T.aerial, opts.aerial === 'Air' ? T.air : T.cable],
    [T.channelType, TYPE_TEXT[opts.type]],
  ]
  // help text by focus (CAntennaSearchOptionWindow::t_UpdateHelpText @029194fc)
  const help = focus === 'list' ? (row === 0 ? T.aerialHelp : T.typeHelp) : T.scanHelp
  return (
    <>
      <div className="at-desc" style={{ top: 276 }}>{T.optionsIntro}</div>
      {rows.map(([title, value], i) => {
        const focused = row === i
        const cls = `${focused ? ' at-row--focus' : ''}${focus === 'list' ? '' : ' at-row--dim'}`
        return (
          <div key={i} className={`at-row${cls}`} style={{ top: ROW_Y[i] }}>
            {focused && focus === 'list' && <div className="at-focus" />}
            <span className="at-row__title">{title}</span>
            <span className="at-row__value">{value}</span>
          </div>
        )
      })}
      <div className="at-help">{help}</div>
      <ScanButton label={T.scan} x={760} focused={focus === 'scan'} />
    </>
  )
}

function ScanButton({ label, x, focused }: { label: string; x: number; focused: boolean }) {
  return <div className={`at-btn${focused ? ' at-btn--sel' : ''}`} style={{ left: x }}>{label}</div>
}

// bottom button x (BUTTON_1_X 380; 2_LEFT/2_RIGHT 284/476; 3 buttons 184/380/576 base) x2
const BTN_X = [[760], [568, 952], [368, 760, 1152]]

function Progress({ plan, t, phase, frame, preview, stored, buttons, focus, menu }: {
  plan: ScanPlan
  t: number
  phase: Phase
  frame: number
  preview: boolean
  stored: Channel[]
  buttons: string[]
  focus: number
  menu: boolean
}) {
  const done = phase === 'complete' || phase === 'notCompleted'
  const step = stepAt(plan, t)
  const pct = done && phase === 'complete' ? 100 : step?.pct ?? 0
  const found = done ? stored : foundAt(plan, t)
  const n = (k: Channel['kind']) => found.filter(c => c.kind === k).length
  const desc = phase === 'scanning' ? T.finding : phase === 'stopAsk' ? T.stopAsk : phase === 'complete' ? T.complete : T.notCompleted
  const showProgress = !(done && preview)
  // fill: hidden at 0 %, progress_bar 21x21 at 1 %, then progress_bar_variable 9-slice
  // 22 + (357 - 22) * pct / 100 OSD px wide (m_UpdateProgress @029242cc)
  const fillW = 33 + (536 - 33) * (pct / 100)
  const tableH = plan.digital && plan.analogue ? 348 : plan.digital ? 256 : 100
  const first = stored[0]
  void menu
  return (
    <>
      <div className="at-desc" style={{ top: 236 }}>{desc}</div>
      {showProgress && step && (
        <div className="at-chan">
          <span>{step.label}</span>
          {step.number && <span className={step.found ? 'at-chan__found' : undefined}>{step.number}</span>}
        </div>
      )}
      {showProgress && (
        <>
          <div className="at-bar" />
          {pct === 1 && <img className="at-fill1" src={`${SCAN}/progress_bar.png`} alt="" />}
          {pct >= 2 && <div className="at-fill" style={{ width: fillW }} />}
          <div className="at-pct">{pct}%</div>
        </>
      )}
      <div className="at-table" style={{ height: tableH }}>
        {plan.digital && (
          <>
            <TableRow y={504 - 480} x={328} label={T.digital} value={plan.digital ? String(found.length) : '-'} />
            {[T.tv, T.radio, T.dataOther].map((label, i) => (
              <TableRow key={label} y={556 - 480 + 52 * i} x={384} label={label} value={String(n((['tv', 'radio', 'data'] as const)[i]))} dot />
            ))}
          </>
        )}
        {plan.digital && plan.analogue && <div className="at-line" />}
        {plan.analogue && <TableRow y={(plan.digital ? 752 : 504) - 480} x={328} label={T.analogue} value="0" />}
      </div>
      {showProgress && (
        <img
          className="at-ani"
          src={`${SCAN}/${opts.aerial === 'Air' ? 'air' : 'cable'}_${frame + 1}.png`}
          alt=""
        />
      )}
      {done && preview && first && (
        first.video ? <video className="at-preview" src={`${VIDEO}${first.video}`} autoPlay muted loop playsInline /> : <div className="at-preview" />
      )}
      {buttons.map((b, i) => (
        <ScanButton key={b} label={b} x={BTN_X[buttons.length - 1][i]} focused={focus === i} />
      ))}
    </>
  )
}

function TableRow({ y, x, label, value, dot }: { y: number; x: number; label: string; value: string; dot?: boolean }) {
  return (
    <>
      {dot && <img className="at-dot" src={`${SCAN}/list_dot.png`} alt="" style={{ top: y + 18.5 }} />}
      <div className="at-cell" style={{ top: y, left: x - 292 }}>{label}</div>
      <div className="at-cell at-cell--num" style={{ top: y }}>{value}</div>
    </>
  )
}
