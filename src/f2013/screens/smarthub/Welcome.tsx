import { useState } from 'react'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { IMG, STR } from './data'

// Smart Hub setup, Welcome page (CHomeWizardWindowManager::PreparePNP scenario 0x523,
// CHomeWizardWelcomeWindow; keys in IfKeyPress @02c14290). Reached with Enter on a panel's
// "Set Up Smart Hub" / "Start Now" button. The page sits in the shared wizard frame (CWizardWidget):
// AppCM/wizard_bg.bmp stretched over the screen and the title box; no step dots on this page.
export function Welcome({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  const [btn, setBtn] = useState<0 | 1>(0) // Start is focused first

  useRemote(key => {
    switch (key) {
      case 'Left':
        if (btn === 1) {
          playUi(UI_SOUND.MOVE)
          setBtn(0)
        } else playUi(UI_SOUND.NOKEY)
        return true
      case 'Right':
        if (btn === 0) {
          playUi(UI_SOUND.MOVE)
          setBtn(1)
        } else playUi(UI_SOUND.NOKEY)
        return true
      case 'Enter':
        if (btn === 0) {
          playUi(UI_SOUND.SELECT)
          onStart()
        } else {
          playUi(UI_SOUND.CANCEL)
          onExit()
        }
        return true
      case 'Back':
      case 'Exit':
        playUi(UI_SOUND.CANCEL)
        onExit()
        return true
      case 'VolumeUp':
      case 'VolumeDown':
      case 'Mute':
      case 'Power':
        return false
      default:
        return true // any other key is ignored, without a sound
    }
  })

  return (
    <div className="sh-wiz">
      <img className="sh-wiz__bg" src={`${IMG}/wizard/wizard_bg.png`} alt="" />
      {/* title box 60,96 1800x84, size 64, centred, 0xFF5FF9FF (wizard frame values at 1280 x1.5) */}
      <div className="sh-wiz__title">{STR.welcome}</div>
      {/* detail text 160,284 1600x56, size 40, white, centred */}
      <div className="sh-wiz__text">{STR.welcomeText}</div>
      {/* HomePanel/wizard/start_welcome.PNG (397x365) drawn 596x548 at 664,312 */}
      <img className="sh-wiz__cube" src={`${IMG}/wizard/start_welcome.PNG`} alt="" />
      {[STR.start, STR.exit].map((label, i) => (
        <div key={label} className="sh-wiz__btn" style={{ left: i === 0 ? 524 : 948 }}>
          <img src={`${IMG}/wizard/wizard_btn_${btn === i ? 'sel' : 'nor'}.png`} alt="" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
