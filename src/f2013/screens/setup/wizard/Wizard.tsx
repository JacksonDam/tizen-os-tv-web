import { useEffect, useState, type ReactNode } from 'react'
import { F13 } from '../../../assets'
import './wizard.css'

// The Plug & Play wizard frame (CPlugPlayWizardWindow : CMenuWizardWindowBase, drawn by CWizardWidget):
// full-screen blue gradient, centred title, step indicator at the top right, Previous/Next circles at
// mid-height with a text bubble, optional bottom buttons. The OSD is 1280x720
// (AppConfig::D_OSD_RESOLUTION 0x500): every firmware value and image is drawn x1.5 here
// (spec/setup.md 2).

export const WIZ = `${F13}/setup/wizard`

export type NavState = 'hidden' | 'normal' | 'disabled'
// what has the focus: the page content, a navigation circle or bottom button i
export type WizFocus = 'content' | 'prev' | 'next' | 'skip' | 'close' | number

export type WizardProps = {
  title: string
  step: number             // current step, 1-based
  total: number            // CPlugPlayUtil::GetPlugPlayMaxStep
  smartHubStep?: number    // m_nPlugPlaySmartHubCompleteStep: the cube icon instead of a number
  tvStep?: number          // m_nPlugPlayTVCompleteStep (-1 / undefined = none)
  prev?: NavState
  next?: NavState
  skip?: NavState
  close?: NavState
  buttons?: { label: string; disabled?: boolean }[]
  focus: WizFocus
  bubble?: 'prev' | 'next'  // keep this circle's bubble up while the content has the focus
                            // (CPlugPlayWizardWindow::t_ShowNavigationTextBox)
  hiding?: boolean         // the page content is playing its hide animation
  pageKey: string | number // a new key plays the content's show animation
  children?: ReactNode
}

// CWizardWidget::m_GetStringId @01922208 (g_CommonWStringEng 0x87, 0x7b, 0x90, 0x53)
const BUBBLE: Record<'prev' | 'next' | 'skip' | 'close', string> = {
  prev: 'Previous',
  next: 'Next',
  skip: 'Skip',
  close: 'Exit',
}
// the bubble hides 10 s after the circle got the focus (m_CreateTextBoxAlarm @01922398)
const BUBBLE_MS = 10000

// FUN_019208a8 (step button update): icon steps take no number.
function StepIndicator({ step, total, smartHubStep, tvStep }: Pick<WizardProps, 'step' | 'total' | 'smartHubStep' | 'tvStep'>) {
  const items: ReactNode[] = []
  let icons = 0
  for (let k = 1; k <= total; k++) {
    // x = STEP_BUTTON_X - STEP_BUTTON_GAP * (N - i) = 1234 - 37 * (N - i), y = 16 (1280 space)
    const x = (1234 - 37 * (total - (k - 1))) * 1.5
    if (k === smartHubStep || k === tvStep) {
      icons++
      const img = k === smartHubStep ? 'step_smarthub' : 'step_tv'
      items.push(
        <img key={k} className="wiz-step__icon" style={{ left: x }} src={`${WIZ}/${img}_${k <= step ? 'color' : 'gray'}.png`} alt="" />,
      )
      continue
    }
    const state = k === step ? 'present' : k < step ? 'past' : 'future'
    items.push(
      <div key={k} className={`wiz-step wiz-step--${state}`} style={{ left: x }}>
        {k - icons}
      </div>,
    )
  }
  return <>{items}</>
}

function NavButton({ kind, state, focused, forced = false }: { kind: 'prev' | 'next' | 'skip' | 'close'; state: NavState; focused: boolean; forced?: boolean }) {
  // a bubble shows next to the focused circle until it loses the focus or 10 s pass
  const [bubble, setBubble] = useState(false)
  const shown = focused || forced
  useEffect(() => {
    if (!shown) {
      setBubble(false)
      return
    }
    setBubble(true)
    const t = setTimeout(() => setBubble(false), BUBBLE_MS)
    return () => clearTimeout(t)
  }, [shown, focused])
  if (state === 'hidden') return null
  const file = { prev: 'preview', next: 'next', skip: 'skip', close: 'close' }[kind]
  const img = state === 'disabled' ? 'd' : focused ? 'h' : 'n'
  return (
    <>
      <img className={`wiz-nav wiz-nav--${kind}`} src={`${WIZ}/wizard_indi_${file}_${img}.png`} alt="" />
      {bubble && state !== 'disabled' && <div className={`wiz-bubble wiz-bubble--${kind}`}>{BUBBLE[kind]}</div>}
    </>
  )
}

// x of bottom button i for 1, 2 or 3 buttons (WIZARD_WINDOW_BUTTON_X, _X1/_X2, 3_BUTTONS_X/_X1/_X2)
const BUTTON_X = [[493], [352, 634], [210, 493, 776]]

export function Wizard(p: WizardProps) {
  const closeBelowSkip = p.skip && p.skip !== 'hidden'
  return (
    <div className="wiz">
      <div className="wiz-title">{p.title}</div>
      <StepIndicator step={p.step} total={p.total} smartHubStep={p.smartHubStep} tvStep={p.tvStep} />
      <div key={p.pageKey} className={`wiz-page${p.hiding ? ' wiz-page--hide' : ''}`}>
        {p.children}
        {p.buttons?.map((b, i) => {
          const focused = p.focus === i
          return (
            <div
              key={i}
              className={`wiz-btn${focused ? ' wiz-btn--sel' : ''}${b.disabled ? ' wiz-btn--dim' : ''}`}
              style={{ left: BUTTON_X[p.buttons!.length - 1][i] * 1.5 }}
            >
              <span>{b.label}</span>
            </div>
          )
        })}
      </div>
      <NavButton kind="prev" state={p.prev ?? 'hidden'} focused={p.focus === 'prev'} forced={p.bubble === 'prev'} />
      <NavButton kind="next" state={p.next ?? 'hidden'} focused={p.focus === 'next'} forced={p.bubble === 'next'} />
      <NavButton kind="skip" state={p.skip ?? 'hidden'} focused={p.focus === 'skip'} />
      <div className={closeBelowSkip ? 'wiz-close--low' : undefined}>
        <NavButton kind="close" state={p.close ?? 'hidden'} focused={p.focus === 'close'} />
      </div>
    </div>
  )
}
