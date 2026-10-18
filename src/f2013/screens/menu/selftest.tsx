import { useEffect, useRef, useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getTv } from '../../tv/store'
import { ActionFrame, AW, baseKeys, MODEL_CODE, SW_VERSION, type AWProps } from './actionwin'
import { IMG } from './parts'
import type { MenuItem } from './types'
import { getValue, setValue } from './values'
import { MessageBox, type MsgBox } from './widgets'

// Support > Self Diagnosis > Picture Test / Sound Test (CSelfTestPictureTestActionWindow,
// CSelfTestSoundTestActionWindow): user-defined 1x1 windows that only carry message boxes, the test
// photo (/mtd_appdata/resource/self.jpg) or the test melody (/mtd_appdata/resource/self.mp3), then
// CSelfTestCompleteActionWindow with the result. The Menu is hidden while a test runs (inferred).

const ST = `${IMG}/selftest`
const PHOTO_MS = 5000          // "for the next 5 seconds" (t_TestMsgYesBtnOKPress alarm 5000)

type TestProps = AWProps & { item: MenuItem }

// Message box keys: Left/Right move between the buttons, OK presses, RETURN closes the test.
function useBoxKeys(n: number, start: number, onPress: (i: number) => void, p: AWProps) {
  const [focus, setFocus] = useState(start)
  useRemote((k: RemoteKey) => {
    if ((k === 'Left' || k === 'Right') && n > 1) {
      const f = Math.max(0, Math.min(n - 1, focus + (k === 'Left' ? -1 : 1)))
      if (f !== focus) {
        setFocus(f)
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      onPress(focus)
      return true
    }
    if (baseKeys(k, p)) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })
  return [focus, setFocus] as const
}

function Box({ box, n, start, onPress, p, bottom }: { box: MsgBox; n: number; start: number; onPress: (i: number) => void; p: AWProps; bottom?: number }) {
  const [focus] = useBoxKeys(n, start, onPress, p)
  return <MessageBox box={box} focus={focus} bottom={bottom} />
}

// ---- Picture Test ----
// t_CreateStartMsgBox: M 0x96a + OK -> the photo for 5 s -> t_Create2ButtonTestMsgBox: M 0x980,
// Yes / No with the focus on No -> result: Yes (the problem is in the photo too) 1, No 0.
export function PictureTest({ item, ...p }: TestProps) {
  const [phase, setPhase] = useState<'start' | 'photo' | 'ask'>('start')
  useEffect(() => {
    if (phase !== 'photo') return
    const t = setTimeout(() => setPhase('ask'), PHOTO_MS)
    return () => clearTimeout(t)
  }, [phase])
  const result = (r: 0 | 1) => p.change?.({ kind: 'custom', item, render: q => <SelfTestResult item={item} result={r} {...q} /> })
  return (
    <>
      {phase === 'photo' && <PhotoKeys {...p} />}
      {phase === 'photo' && <img className="m13-st-photo" src={`${ST}/self.jpg`} alt="" />}
      {phase === 'start' && (
        <Box key="start" n={1} start={0} p={p} onPress={() => setPhase('photo')}
          box={{ text: 'The test photo will now be shown. Please look carefully at the screen for the next 5 seconds.', buttons: ['OK'] }} />
      )}
      {phase === 'ask' && (
        <Box key="ask" n={2} start={1} p={p} onPress={i => result(i === 0 ? 1 : 0)}
          box={{ text: 'Can you still see the problem in this test photo?', buttons: ['Yes', 'No'] }} />
      )}
    </>
  )
}

// While the photo is up only RETURN / EXIT do something.
function PhotoKeys(p: AWProps) {
  useRemote((k: RemoteKey) => {
    if (baseKeys(k, p)) return true
    return k !== 'Home'
  })
  return null
}

// ---- Sound Test ----
// t_ShowSoundTestWnd: the melody plays, the sound information box (Common/infobanner_00 at (14,11),
// "Volume Level" + the volume, size 26, label white / value 0xff86b7e3) and the speaker animation
// (Menu/icon_sound_00/01/02/01, 1000 ms per frame) show, then m_SetMsgBoxTest: M 0x981 Yes / No (focus
// No) 20 px above the screen bottom. With External Speaker selected, m_SetMsgBoxChangeSpeaker asks
// M 0x988 first (warning icon).
const SPEAKER_FRAMES = ['icon_sound_00', 'icon_sound_01', 'icon_sound_02', 'icon_sound_01']

export function SoundTest({ item, ...p }: TestProps) {
  const speakerItem = { id: 0x17b, t: '' }
  const [phase, setPhase] = useState<'speaker' | 'test'>(() => (getValue(speakerItem) === 0 ? 'test' : 'speaker'))
  const [frame, setFrame] = useState(0)
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (phase !== 'test') return
    const tv = getTv()
    const a = new Audio(`${ST}/self.mp3`)
    a.volume = tv.muted ? 0 : Math.min(1, tv.volume / 100)   // (inferred) TV volume scale
    audio.current = a
    a.play().catch(() => {})
    const ani = setInterval(() => setFrame(f => (f + 1) % 4), 1000)
    return () => {
      a.pause()
      clearInterval(ani)
    }
  }, [phase])
  const result = (r: 0 | 1) => p.change?.({ kind: 'custom', item, render: q => <SelfTestResult item={item} result={r} {...q} /> })
  if (phase === 'speaker') {
    return (
      <Box key="spk" n={2} start={1} p={p} bottom={20}
        onPress={i => {
          if (i === 0) {
            setValue(speakerItem, 0)
            setPhase('test')
          } else p.close()   // (inferred) No ends the test
        }}
        box={{ text: 'Do you want to change to the TV Speakers?', buttons: ['Yes', 'No'], icon: `${ST}/icon_warning.png` }} />
    )
  }
  const vol = getTv().volume
  return (
    <>
      <div className="m13-st-info" style={{ left: 14, top: 11, height: 160 }}>
        <div className="m13-st-info-bg" />
        <span>Volume Level</span>
        <span className="m13-st-info-value">{vol}</span>
      </div>
      <img className="m13-st-speaker" src={`${ST}/${SPEAKER_FRAMES[frame]}.png`} style={{ left: 640 - 52, top: 360 - 105 }} alt="" />
      <Box key="test" n={2} start={1} p={p} bottom={20} onPress={i => result(i === 0 ? 1 : 0)}
        box={{ text: 'Can you still hear the problem in this sound test?', buttons: ['Yes', 'No'] }} />
    </>
  )
}

// ---- Result: CSelfTestCompleteActionWindow (window size 2 = 602x557 centred, title = the test, one
// Close button; text (33,64) 536 wide, size 24, row gap 6; t_SetCompleteMessage) ----
export function selfTestResultText(testId: number, result: 0 | 1) {
  if (result === 1) {
    return 'Please contact the Samsung Call Centre.' + '\n' +
      'Be ready to provide this information to the advisor.' +
      '\n - ' + 'Model Code' + ' : ' + MODEL_CODE +
      '\n - ' + 'Software Version' + ' : ' + SW_VERSION +
      '\n - ' + 'The serial and version numbers can be found on the sticker on the back or right side of your TV.'
  }
  if (testId === 0x6ea) {
    return 'If the Self Diagnosis Picture Test is OK, your TV may not have a problem. Please follow the steps below:' +
      '\n - ' + 'Check your external devices and connections.' +
      '\n - ' + 'Try picture reset by selecting Menu > Picture > Reset Picture.' +
      '\n - ' + 'Update to the latest software version by selecting Menu > Support > Software Update.' + '\n'
  }
  return 'If the Self Diagnosis Sound Test is OK, please check your external devices and connections.' + '\n' +
    "If the problem persists, refer to the external devices' user manuals."
}

export function SelfTestResult({ item, result, close, exitMenu }: TestProps & { result: 0 | 1 }) {
  useRemote((k: RemoteKey) => {
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      close()
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })
  const W = 602, H = 557
  return (
    <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title={item.t} buttons={['Close']} focus={0}>
      <div className="m13-awin-text" style={{ left: 33, top: 64, width: 536, fontSize: AW.FONT_18, lineHeight: `${AW.FONT_18 + 6}px` }}>
        {selfTestResultText(item.id, result)}
      </div>
    </ActionFrame>
  )
}
