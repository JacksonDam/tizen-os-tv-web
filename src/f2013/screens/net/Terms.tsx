import { useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../../input/remote'
import { setSmartHub } from '../../tv/online'
import { playUi, UI_SOUND } from '../../tv/sound'
import { MessageBox } from '../setup/wizard/widgets'
import { Wizard, type WizFocus } from '../setup/wizard/Wizard'
import { NET_IMG } from './data'
import './net.css'

// The Smart Hub terms page (CHomeWizardWindow on the wizard frame; CHomeWizardWindowManager::
// m_ActivateTerms @02c0282c, m_ProcessNextStep @02c01bec). Shown in Plug & Play (step 5, app 0xbd
// activate 0x520) and in Smart Hub's own setup after the network step. The page first plays the loading
// banner while the disclaimer list is requested from the server (m_PlayLoadingIcon: HomePanel/loading
// 18 frames, 600 ms, 96x96 at (880,448); CHomePnPInfo::RequestDisclaimer), then lists the items the
// server sent (CHomePnPDisclaimerContentItem: title, intro, details, buttons): an "all" check row and,
// per document, its title and summary with a check button and View Details (HomePanel 0x8e).
// Every text of the list comes from Samsung's server (the footage, sAmJMgr1va0 0:56-1:00, shows a Greek
// set's server texts), so this recreation shows neutral stubs there: the page and item titles are the
// documents' names as the firmware's own strings call them (M "Terms & Conditions, Privacy Policy",
// HomePanel 0x80 "... the Terms & Conditions and Privacy Policy"), the rest says it comes from the
// server. The second page the footage shows (supplementary privacy notices, the server's sub list) is
// not sent by the stub server (GetDisclaimerItemSubList empty), so Next goes straight on.
// Next with an item not agreed: HomePanel 0x84 "Before you can set up Smart Hub, you must agree to the
// <<A>> and the <<B>>." (CheckTermsAgreement @02c09048 state 1, ShowCheckMessageBox @02c08740).
// Agreeing (SetTermsAgreement) sets the Smart Hub's agreed state (tv/online.ts setSmartHub).
// Layout: FullHD (stage px). HOME_PNP_WINDOW_POS_X 240, check button x 60, View Details x 360 inside the
// window (t_InitFullHDTermsResolution @02bf8064); the window's y, heights and text sizes are measured
// from the footage (inferred).

const T = `${NET_IMG}/terms`
const LOADING_MS = 1500        // (inferred) the stub server's answer time
const STUB = 'This text is supplied by Samsung’s server and is not part of this recreation.'

type Doc = { title: string; type: 1 | 2 }
const DOCS: Doc[] = [
  { title: 'Terms & Conditions', type: 1 },
  { title: 'Privacy Policy', type: 2 },
]
export const TERMS_TITLE = 'Terms & Conditions, Privacy Policy'   // M (Smart Features > Samsung Account item)

type F = { row: number; col: 0 | 1 } | 'prev' | 'next'     // row 0 = all, 1.. = documents; col 1 = View Details

export type TermsProps = {
  step: number
  total: number
  smartHubStep: number
  hiding?: boolean
  onPrev: () => void
  onNext: () => void        // after agreeing
  onExit?: () => void       // RETURN / EXIT outside Plug & Play
}

export function TermsPage({ step, total, smartHubStep, hiding, onPrev, onNext, onExit }: TermsProps) {
  const [loading, setLoading] = useState(true)
  const [frame, setFrame] = useState(0)
  const [agreed, setAgreed] = useState<boolean[]>(DOCS.map(() => false))
  const [focus, setFocus] = useState<F>({ row: 0, col: 0 })
  const [msg, setMsg] = useState<string | null>(null)
  const [detail, setDetail] = useState<number | null>(null)

  useEffect(() => {
    const ani = setInterval(() => setFrame(f => (f + 1) % 18), 600 / 18)
    const t = setTimeout(() => {
      clearInterval(ani)
      setLoading(false)
    }, LOADING_MS)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [])

  const all = agreed.every(Boolean)
  const next = () => {
    if (!all) {
      const a = DOCS.find(d => d.type === 1)!.title
      const b = DOCS.find(d => d.type === 2)!.title
      setMsg(`Before you can set up Smart Hub, you must agree to the ${a} and the ${b}.`)
      return
    }
    setSmartHub({ agreed: true })
    onNext()
  }

  const move = (f: F) => {
    setFocus(f)
    playUi(UI_SOUND.MOVE)
  }
  useRemote((k: RemoteKey) => {
    if (hiding || msg !== null || detail !== null) return msg === null && detail === null
    if (loading) return k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute' && k !== 'Power'
    if (k === 'Back' || k === 'Exit') {
      if (onExit) onExit()
      return true
    }
    if (focus === 'prev' || focus === 'next') {
      if (k === 'Enter') {
        playUi(UI_SOUND.SELECT)
        if (focus === 'prev') onPrev()
        else next()
      } else if (k === 'Right' && focus === 'prev') move({ row: 0, col: 0 })
      else if (k === 'Left' && focus === 'next') move({ row: DOCS.length, col: 1 })
      return true
    }
    const { row, col } = focus
    if (k === 'Up' && row > 0) move({ row: row - 1, col: row - 1 === 0 ? 0 : col })
    else if (k === 'Down' && row < DOCS.length) move({ row: row + 1, col: row === 0 ? 0 : col })
    else if (k === 'Left') move(row > 0 && col === 1 ? { row, col: 0 } : 'prev')
    else if (k === 'Right') move(row > 0 && col === 0 ? { row, col: 1 } : 'next')
    else if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (row === 0) setAgreed(DOCS.map(() => !all))
      else if (col === 0) setAgreed(a => a.map((v, i) => (i === row - 1 ? !v : v)))
      else setDetail(row - 1)
    }
    return true
  })

  // the list scrolls a document row into view (CHomeSinglelineListWindow, inferred step)
  const scroll = typeof focus === 'object' && focus.row >= 2 ? 230 : 0
  const wfocus: WizFocus = focus === 'prev' ? 'prev' : focus === 'next' ? 'next' : 'content'
  return (
    <>
      <Wizard
        title={TERMS_TITLE}
        step={step}
        total={total}
        smartHubStep={smartHubStep}
        prev={loading ? 'disabled' : 'normal'}
        next={loading ? 'disabled' : 'normal'}
        focus={wfocus}
        bubble={wfocus === 'content' && !loading ? 'next' : undefined}
        hiding={hiding}
        pageKey="terms"
      >
        {loading ? (
          <img className="n13-terms__loading" src={`${NET_IMG}/loading/loading_${String(frame + 1).padStart(2, '0')}.png`} alt="" />
        ) : (
          <div className="n13-terms">
            <div className="n13-terms__intro">{STUB}</div>
            <div className="n13-terms__win">
              <div className="n13-terms__scroll" style={{ transform: `translateY(${-scroll}px)` }}>
                <div className="n13-terms__all">
                  <Check on={all} focused={typeof focus === 'object' && focus.row === 0} />
                  <span className="n13-terms__alltext">Agree</span>
                </div>
                {DOCS.map((d, i) => {
                  const rowF = typeof focus === 'object' && focus.row === i + 1 ? focus.col : -1
                  return (
                    <div key={d.title} className="n13-terms__item" style={{ top: 110 + i * 230 }}>
                      <div className="n13-terms__ititle">{d.title}</div>
                      <div className="n13-terms__idesc">{STUB}</div>
                      <div className={`n13-terms__cbtn${rowF === 0 ? ' n13-terms__cbtn--sel' : ''}`}>
                        <Check on={agreed[i]} focused={false} small />
                        <span>Agree</span>
                      </div>
                      <div className={`n13-terms__vbtn${rowF === 1 ? ' n13-terms__vbtn--sel' : ''}`}>View Details</div>
                    </div>
                  )
                })}
              </div>
            </div>
            {scroll === 0 && <img className="n13-terms__more" src={`${T}/indi_arrow_down_nor_s.png`} alt="" />}
          </div>
        )}
      </Wizard>
      {msg !== null && <MessageBox text={msg} buttons={['OK']} onButton={() => setMsg(null)} />}
      {detail !== null && <MessageBox text={`${DOCS[detail].title}\n${STUB}`} buttons={['OK']} onButton={() => setDetail(null)} />}
    </>
  )
}

function Check({ on, focused, small }: { on: boolean; focused: boolean; small?: boolean }) {
  return (
    <span className={`n13-check${small ? ' n13-check--small' : ''}${focused ? ' n13-check--focus' : ''}`}>
      <img src={`${T}/check_box_n.png`} alt="" />
      {on && <img src={`${T}/check_icon.png`} alt="" />}
    </span>
  )
}
