import { useEffect, useRef, useState } from 'react'
import { onAnyKey, useRemote, type RemoteKey } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { RG, type RGPage } from './remoteGuideData'
import { MarkerLottie } from './MarkerLottie'
import { FluxScreen, KeyLayer, OptionRow } from './ui'
import { fromSD, finishTest } from './TestFrame'
import { SD } from './sdData'

// Remote Control Guide (com.samsung.tv.remoteguide 1.5.4, spec3/diag.md 5): data-driven pages from
// Config/*.json (remoteGuideData.ts). Normal entry (Settings > Support > Tips and User Guides): the index
// (TType1: remote picture + category columns of page buttons), then TType2 guide pages: the remote Lottie
// with the key's effect highlight looping, a tooltip at the key, and the screen Lottie; pressing the real
// key plays the screen animation, then the next page opens. Left/Right (the step indicator) move between
// pages. ENTRY=SelfDiagnosis runs the key test instead: press each key within 10 s.

const RES = `${TV}/support/remoteguide`
const REMOTE = `${RES}/remoteguide_remote_black.json`
const EFFECT = `${RES}/remoteguide_effect_black_white.json`
const SCREEN = `${RES}/remoteguide_screen.json`
const SOLAR = `${RES}/remoteguide_solar_black.json`
const T = RG.text
const COUNTDOWN = 10 // SELF_DIAG_CONTAINER_SKIN_TESTING_TEXTBOX_COUNTDOWN_DEFAULT

// ButtonTypeE by buttonConfig.actionType
const BUTTON = [T.COM_SID_CLOSE, T.TV_SID_ASSISTANT_CAMAR_GOT_IT, T.TV_SID_REMOTEKEY_CBAPR_MORE_FEATURE, T.COM_SID_CLOSE,
  T.COM_SID_ACCESSIBILITY_CAFEB_OK, 'Cancel', T.COM_SID_CLOSE, T.COM_SID_SKIP]

const PAGES: RGPage[] = RG.categories.flatMap(c => c.pages)

// Tooltip anchor: KeyPosDef (u from the 64 u remote frame top); x is the frame's left edge (XOffset 0)
function tooltipTop(page: RGPage, selfDiag: boolean) {
  const pos = (selfDiag ? RG.selfDiagKeyPos : RG.keyPos)[page.keyPos ?? ''] ?? 22
  return pos * 8
}

export function RemoteGuide(props: AppProps) {
  return fromSD(props.args) || props.args?.ENTRY === 'SelfDiagnosis' ? <RemoteTest {...props} /> : <Guide {...props} />
}

// ---------------- normal guide ----------------

function Guide({ onExit }: AppProps) {
  const [page, setPage] = useState(-1) // -1 = index
  const [col, setCol] = useState(0)
  const [row, setRow] = useState(0)
  const [onButton, setOnButton] = useState(false)
  const [playing, setPlaying] = useState(false)
  useMoveSound(`${page}:${col}:${row}:${onButton}`)

  const p = page >= 0 ? PAGES[page] : null
  const go = (i: number) => {
    setPlaying(false)
    if (i < 0) setPage(-1)
    else if (i < PAGES.length) setPage(i)
  }

  // the practice key: any key, including the system ones (volume, mute) that never reach useRemote
  const pageRef = useRef(p)
  pageRef.current = p
  useEffect(
    () =>
      onAnyKey(k => {
        const cur = pageRef.current
        if (!cur || playing) return
        if (cur.keys.some(x => x.key === k && !x.long)) setPlaying(true)
      }),
    [playing],
  )

  useRemote(key => {
    // a guide page grabs its practice keys (RemoteKeyController.GrabKeys), Home included
    if (p && p.keys.some(x => x.key === key)) return true
    if (key === 'Home') return false
    if (!p) {
      const cat = RG.categories[col]
      if (onButton) {
        if (key === 'Up') setOnButton(false)
        else if (key === 'Enter') onExit('settings')
      } else if (key === 'Left' && col > 0) {
        setCol(col - 1)
        setRow(r => Math.min(r, RG.categories[col - 1].pages.length - 1))
      } else if (key === 'Right' && col < RG.categories.length - 1) {
        setCol(col + 1)
        setRow(r => Math.min(r, RG.categories[col + 1].pages.length - 1))
      } else if (key === 'Up') setRow(Math.max(0, row - 1))
      else if (key === 'Down') {
        if (row < cat.pages.length - 1) setRow(row + 1)
        else setOnButton(true)
      } else if (key === 'Enter') go(PAGES.indexOf(cat.pages[row]))
      else if (key === 'Back') onExit('settings')
      return true
    }
    // guide page (practice keys are handled by onAnyKey): Left/Right = Previous/Next, Back = index
    if (key === 'Left') go(page - 1)
    else if (key === 'Right' && page < PAGES.length - 1) go(page + 1)
    else if (key === 'Back') go(-1)
    else if (key === 'Enter' && p.template === 'StackUp1') go(page + 1)
    else if (key === 'Enter') go(-1) // More Features: back to the index (RestorePage)
    return true
  })

  const exitKeys = (key: RemoteKey) => {
    if (key === 'Exit') onExit('live')
    return key !== 'Home'
  }

  if (!p) {
    return (
      <FluxScreen className="rg">
        <KeyLayer handler={exitKeys} />
        <div className="rg__title">{RG.index.title}</div>
        <div className="rg__subtitle">{RG.index.subtitle}</div>
        <MarkerLottie className="rg__index-remote" src={REMOTE} still={0} />
        <div className="rg__columns">
          {RG.categories.map((c, ci) => (
            <div key={c.title} className="rg__column">
              <div className="rg__category">{c.title}</div>
              {c.pages.map((pg, ri) => (
                <div key={pg.file} className={`flux-btn rg__page-btn ${!onButton && ci === col && ri === row ? 'is-focused' : ''}`}>
                  {pg.name}
                </div>
              ))}
            </div>
          ))}
        </div>
        <OptionRow labels={[BUTTON[3]]} focus={onButton ? 0 : null} />
      </FluxScreen>
    )
  }

  const screenRange = p.keys[0]?.screen
  return (
    <FluxScreen className="rg">
      <KeyLayer handler={exitKeys} />
      <div className="rg__steps">
        <span className="rg__step rg__step--prev">{`‹ ${T.COM_SID_PREVIOUS}`}</span>
        {page < PAGES.length - 1 && <span className="rg__step rg__step--next">{`${T.COM_SID_NEXT} ›`}</span>}
      </div>
      <div className="rg__title">{p.title}</div>
      <div className="rg__subtitle">{p.subtitle}</div>
      {p.template === 'StackUp1' ? (
        <>
          <MarkerLottie key={p.file} className="rg__solar" src={SOLAR} range={['0', '0']} still={0} />
          <div className="rg__guide">{p.guide}</div>
          <OptionRow labels={[BUTTON[1]]} focus={0} />
        </>
      ) : (
        <>
          <div className="rg__body">
            <MarkerLottie className="rg__remote" src={REMOTE} still={0} />
            {p.effect && <MarkerLottie key={p.file} className="rg__remote rg__effect" src={EFFECT} range={[p.effect[0]!, p.effect[1]!]} />}
            {p.tooltip && (
              <div className="rg__tooltip" style={{ top: tooltipTop(p, false) }}>
                {p.tooltip}
              </div>
            )}
          </div>
          <div className="rg__skin">
            {screenRange?.[0] && (
              <MarkerLottie
                key={`${p.file}:${playing}`}
                className="rg__screen"
                src={SCREEN}
                range={playing ? [screenRange[0], screenRange[1]!] : null}
                still={screenRange[0]}
                loop={false}
                onDone={() => go(page + 1 < PAGES.length ? page + 1 : -1)}
              />
            )}
          </div>
          <OptionRow labels={[BUTTON[2]]} focus={0} />
        </>
      )}
    </FluxScreen>
  )
}

// ---------------- Self Diagnosis: the key test ----------------

function RemoteTest(props: AppProps) {
  const [phase, setPhase] = useState<'pre' | 'test' | 'summary'>('pre')
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(COUNTDOWN)
  const [failed, setFailed] = useState<string[]>([])
  const [ok, setOk] = useState(false)
  const p = RG.selfDiag[i]

  // countdown per key; a missed key counts as a failure
  useEffect(() => {
    if (phase !== 'test' || ok) return
    if (left <= 0) {
      setFailed(f => [...f, p.keyName])
      advance()
      return
    }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left, ok])

  const advance = () => {
    setOk(false)
    setLeft(COUNTDOWN)
    if (i + 1 < RG.selfDiag.length) setI(i + 1)
    else setPhase('summary')
  }

  // the key under test (any key, system ones included)
  const state = useRef({ phase, p, ok })
  state.current = { phase, p, ok }
  useEffect(
    () =>
      onAnyKey(k => {
        const s = state.current
        if (s.phase !== 'test' || s.ok) return
        if (s.p.keys.some(x => x.key === k)) {
          setOk(true)
          setTimeout(advance, 700)
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i],
  )

  const result = failed.length ? 'fail' : 'pass'
  useRemote(key => {
    if (phase === 'test') {
      // every key is a test key (Home included); Exit leaves
      if (key === 'Exit') props.onExit('live')
      return true
    }
    if (key === 'Home') return false
    if (phase === 'pre') {
      if (key === 'Enter') setPhase('test')
      else if (key === 'Back') finishTest(props, 'RemoteControl', 'Stop')
      return true
    }
    if (phase === 'summary') {
      if (key === 'Enter' || key === 'Back') finishTest(props, 'RemoteControl', 'Complete', result)
      return true
    }
    return true
  })

  const pre = RG.preSuccess
  return (
    <FluxScreen className="rg">
      {props.args?.DiagnosisType === 'DiagnoseAll' && (
        <div className="sda__step">
          <span className="sda__step-current">{props.args?.currentDiagnosisCount}</span>
          <span className="sda__step-slash">/</span>
          <span className="sda__step-total">{props.args?.totalDiagnosisCount}</span>
        </div>
      )}
      <div className="rg__title">{pre.title}</div>
      {phase === 'pre' && (
        <>
          <div className="rg__subtitle">{T.TV_SID_DEVCARE_MIX_CDJUN_IS_PAIRED_PLEASE_PROCEED_WITH_THE_TEST.replace('{0}', T.TV_SID_MBR_SMART_REMOTE)}</div>
          <MarkerLottie className="rg__index-remote rg__index-remote--center" src={REMOTE} still={0} />
          <OptionRow labels={[BUTTON[4]]} focus={0} />
        </>
      )}
      {phase === 'test' && (
        <>
          <div className="rg__body rg__body--test">
            <MarkerLottie className="rg__remote" src={REMOTE} still={0} />
            {p.effect && <MarkerLottie key={p.file} className="rg__remote rg__effect" src={EFFECT} range={[p.effect[0]!, p.effect[1]!]} />}
            <div className="rg__tooltip" style={{ top: tooltipTop(p, true) }}>
              {p.tooltip}
            </div>
          </div>
          <div className="rg__skin rg__skin--test">
            <div className={`rg__countdown ${ok ? 'is-ok' : ''}`}>{ok ? '' : left}</div>
            {ok && <img className="rg__ok" src={`${TV}/support/self_diagnosis/icon_sd_success.svg`} alt="" />}
            <div className="rg__test-guide">{T.TV_SID_REMOTEKEY_MIX_CBSEP_PRESS_COLON.replace('{0}', p.keyName)}</div>
            <div className="rg__test-count">{`${i + 1} / ${RG.selfDiag.length}`}</div>
          </div>
        </>
      )}
      {phase === 'summary' && (
        <>
          <img className="sda__mark" src={`${TV}/support/self_diagnosis/${result === 'pass' ? 'icon_sd_success.svg' : 'icon_sd_fail.svg'}`} alt="" />
          <div className={`sda__guide ${result === 'pass' ? 'sda__guide--pass' : 'sda__guide--fail'}`}>
            {result === 'pass'
              ? T.TV_SID_DEVCARE_CDJUL_THE_TEST_RESULTS_ARE_NORMAL
              : `${T.COM_TV_SID_FAIL}: ${failed.join(', ')}\n\n${SD.problem}`}
          </div>
          <OptionRow labels={[BUTTON[6]]} focus={0} />
        </>
      )}
    </FluxScreen>
  )
}
