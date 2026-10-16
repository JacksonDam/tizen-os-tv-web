import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { OptionRow } from './ui'
import { TestFrame } from './TestFrame'
import { finishTest, supportInfo } from './testFlow'

// Picture Test (org.tizen.picture-test 0.3, spec3/diag.md 4.1): CMessageView "The test photo will now be
// shown..." [OK] -> CTestImageView: the test photo full screen for 5 s -> "Does the test picture look
// normal?" [Yes] [No] [Show Again] -> CResultView "Picture Test Complete" with the pass/fail mark and
// [Close]. The result goes to Self Diagnosis as "Picture" PASS / FAIL (SendResultValue).
// This FHD stage uses the app's own 1920 test_image.jpg (a 4K/8K panel shows the factory VideoTest photo).

const RES = `${TV}/support`
const IMAGE_MS = 5000

const T = {
  title: 'Picture Test',
  intro: 'The test photo will now be shown. Please look carefully at the screen for the next 5 seconds.',
  ok: 'OK',
  question: 'Does the test picture look normal?',
  yes: 'Yes',
  no: 'No',
  showAgain: 'Show Again',
  complete: 'Picture Test Complete',
  normal: 'The test results are normal. If the problem continues, check your external devices and connections.',
  close: 'Close',
}

type Phase = 'intro' | 'image' | 'confirm' | 'pass' | 'fail'

export function PictureTest(props: AppProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [focus, setFocus] = useState(0)
  useMoveSound(`${phase}:${focus}`)

  useEffect(() => {
    if (phase !== 'image') return
    const t = setTimeout(() => {
      setFocus(0)
      setPhase('confirm')
    }, IMAGE_MS)
    return () => clearTimeout(t)
  }, [phase])

  const buttons = phase === 'intro' ? [T.ok] : phase === 'confirm' ? [T.yes, T.no, T.showAgain] : phase === 'image' ? [] : [T.close]
  const done = phase === 'pass' || phase === 'fail'

  useRemote(key => {
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons.length - 1, f + 1))
    else if (key === 'Enter') {
      if (phase === 'intro') setPhase('image')
      else if (phase === 'confirm') {
        if (focus === 0) setPhase('pass')
        else if (focus === 1) setPhase('fail')
        else setPhase('image')
        setFocus(0)
      } else if (done) finishTest(props, 'Picture', 'Complete', phase === 'pass' ? 'pass' : 'fail')
    } else return false // Back, Exit, Home: the frame
    return true
  })

  return (
    <TestFrame
      app={props}
      item="Picture"
      title={done ? T.complete : T.title}
      onBack={done ? () => finishTest(props, 'Picture', 'Complete', phase === 'pass' ? 'pass' : 'fail') : undefined}
    >
      {(phase === 'intro' || phase === 'confirm') && <div className="tf__message">{phase === 'intro' ? T.intro : T.question}</div>}
      {done && (
        <>
          <img className="sda__mark" src={`${RES}/self_diagnosis/${phase === 'pass' ? 'icon_sd_success.svg' : 'icon_sd_fail.svg'}`} alt="" />
          <div className={`sda__guide ${phase === 'pass' ? 'sda__guide--pass' : 'sda__guide--fail'}`}>
            {phase === 'pass' ? T.normal : <div>{supportInfo()}</div>}
          </div>
        </>
      )}
      {buttons.length > 0 && <OptionRow labels={buttons} focus={focus} />}
      {phase === 'image' && <img className="pt__image" src={`${RES}/picture_test.jpg`} alt="" />}
    </TestFrame>
  )
}
