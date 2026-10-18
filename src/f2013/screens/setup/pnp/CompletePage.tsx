import { useEffect, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { F13 } from '../../../assets'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { Wizard } from '../wizard/Wizard'
import { PNP_SMARTHUB_STEP, PNP_STEP, PNP_TOTAL, type PageProps } from './steps'
import { pnp } from './state'
import { S } from './strings'

// Step 11: Setup complete! without a network (window 0x783, CPlugPlaySmartHubCompleteActionWindow;
// spec/setup.md 3.5). Intro M 0x8e7 centred in 1600x180 at (160,260) (t_SetIntoText @025abc04); the
// rotating cube MenuAnimation/08_PlugPlay/01_ending/08_plugplay_end_00..37 (38 frames in 3400 ms,
// looping) at (664,296) (t_SetIntroAnimationImage @025ac600); OK button 440x128 at (740,916)
// (t_CreateCloseButton @025ac374) with the focus; Previous only (navi type 1). OK, RETURN and EXIT end
// Plug & Play (m_CloseButtonInputCallback @025acd48 -> t_ProcessExit @025ad5c4); Left/Up go to Previous.

const FRAMES = 38
const FRAME_MS = 3400 / FRAMES
const END = `${F13}/setup/pnp/ending`

// preload the animation so it does not flicker on the first loop
let preloaded = false
function preload() {
  if (preloaded || typeof Image === 'undefined') return
  preloaded = true
  for (let i = 0; i < FRAMES; i++) new Image().src = `${END}/08_plugplay_end_${String(i).padStart(2, '0')}.png`
}

export function CompletePage({ hiding, go, onDone }: PageProps & { onDone: () => void }) {
  const [focus, setFocus] = useState<'ok' | 'prev'>('ok')
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    preload()
    const t = setInterval(() => setFrame(f => (f + 1) % FRAMES), FRAME_MS)
    return () => clearInterval(t)
  }, [])

  useRemote(key => {
    if (hiding) return true
    if (key === 'Exit' || key === 'Back') {
      onDone()
      return true
    }
    if (focus === 'ok') {
      if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        onDone()
      } else if (key === 'Left' || key === 'Up') {
        setFocus('prev')
        playUi(16)
      }
      return true
    }
    if (key === 'Right' || key === 'Down') {
      setFocus('ok')
      playUi(16)
    } else if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      go(pnp.channelSource === 'Set-top box' ? 'configure' : 'autotune')
    }
    return true
  })

  return (
    <Wizard
      title={S.completeTitle}
      step={PNP_STEP.complete}
      total={PNP_TOTAL}
      smartHubStep={PNP_SMARTHUB_STEP}
      prev="normal"
      buttons={[{ label: S.ok }]}
      focus={focus === 'ok' ? 0 : 'prev'}
      hiding={hiding}
      pageKey="complete"
    >
      <div className="pnp-complete">{S.completeNoNetwork}</div>
      <img className="pnp-cube" src={`${END}/08_plugplay_end_${String(frame).padStart(2, '0')}.png`} alt="" />
    </Wizard>
  )
}
