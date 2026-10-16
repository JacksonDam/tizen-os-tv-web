import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { useSetting, useTv } from '../../tv/store'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { OptionRow } from './ui'
import { TestFrame, finishTest, supportInfo } from './TestFrame'

// Sound Test (org.tizen.sound-test, spec3/diag.md 4.2): CMainView plays the app's test melody
// (res/sounds/self.wav, 31 s, looped) through the current sound output, shows "Sound Output : <output>"
// and "Volume Level : <n>", and asks "The Sound Test is now playing. Does the test sound normal?"
// [Yes] [No] -> CResultView "Sound Test Complete" with the pass/fail mark and [Close]. The melody follows
// the TV volume while it plays.

const RES = `${TV}/support`

const T = {
  title: 'Sound Test',
  output: 'Sound Output',
  volume: 'Volume Level',
  speaker: 'TV Speaker',
  audioOut: 'Audio Out',
  question: 'The Sound Test is now playing. Does the test sound normal?',
  yes: 'Yes',
  no: 'No',
  complete: 'Sound Test Complete',
  normal: 'The test results are normal. If the problem continues, check your external devices and connections.',
  close: 'Close',
}

export function SoundTest(props: AppProps) {
  const [phase, setPhase] = useState<'playing' | 'pass' | 'fail'>('playing')
  const [focus, setFocus] = useState(0)
  const volume = useTv(s => s.volume)
  const output = useSetting<number>('soundoutput', 0)
  const audio = useRef<HTMLAudioElement>(null)
  useMoveSound(`${phase}:${focus}`)

  useEffect(() => {
    const a = audio.current
    if (!a) return
    a.volume = Math.min(1, volume / 100)
  }, [volume, phase])

  const buttons = phase === 'playing' ? [T.yes, T.no] : [T.close]
  const done = phase !== 'playing'
  const result = phase === 'pass' ? 'pass' : 'fail'

  useRemote(key => {
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons.length - 1, f + 1))
    else if (key === 'Enter') {
      if (!done) {
        setPhase(focus === 0 ? 'pass' : 'fail')
        setFocus(0)
      } else finishTest(props, 'Sound', 'Complete', result)
    } else return false
    return true
  })

  return (
    <TestFrame app={props} item="Sound" title={done ? T.complete : T.title} onBack={done ? () => finishTest(props, 'Sound', 'Complete', result) : undefined}>
      {!done && (
        <>
          {/* the melody autoplays: the user has already pressed keys to get here (browser autoplay rule) */}
          <audio ref={audio} src={`${RES}/sound_test.m4a`} autoPlay loop />
          <div className="st__info">
            <div>
              <span className="st__label">{`${T.output} : `}</span>
              <span className="st__value">{output === 1 ? T.audioOut : T.speaker}</span>
            </div>
            <div>
              <span className="st__label">{`${T.volume} : `}</span>
              <span className="st__value">{volume}</span>
            </div>
          </div>
          <div className="tf__message tf__message--low">{T.question}</div>
        </>
      )}
      {done && (
        <>
          <img className="sda__mark" src={`${RES}/self_diagnosis/${phase === 'pass' ? 'icon_sd_success.svg' : 'icon_sd_fail.svg'}`} alt="" />
          <div className={`sda__guide ${phase === 'pass' ? 'sda__guide--pass' : 'sda__guide--fail'}`}>
            {phase === 'pass' ? T.normal : <div>{supportInfo()}</div>}
          </div>
        </>
      )}
      <OptionRow labels={buttons} focus={focus} />
    </TestFrame>
  )
}
