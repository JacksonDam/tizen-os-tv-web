import { useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { ActionFrame } from './actionwin'
import { baseKeys, type AWProps } from './kit'
import { IMG } from './parts'
import { getValue, setValue } from './values'

// Sound > Sound Effect > Equaliser (CSoundModeEqualizerActionWindow, a CMenuListActionWindowBase):
// window 602 x EQUALIZER_ACTION_WINDOW_H 488 centred, title M 0x2aa, buttons Reset (M 0x471) and Close.
// List from MENU_ACTION_WINDOW_LIST_Y 56 with a 24 px margin, six rows of 50
// (GetListActionWindowSubItems 0x143: Balance, 100Hz, 300Hz, 1kHz, 3kHz, 10kHz; values 0..100, step
// 5 per Left/Right = t_ProcessKey m_nStep 5). CMenuActionWindowEqualizerSliderRenderer: title x 42
// (size 24), left marker at x 227 (53 wide), slider x 280 (253 x 50, track inset by the 16 px thumb
// offset, Menu/control_progress fill), right marker at x 533: Balance draws "L" / "R" (M 0x998 / 0x997),
// the bands Menu/icon_subtraction / icon_addition (_s while focused).

const ROWS: [number, string][] = [[0x144, 'Balance'], [0x145, '100Hz'], [0x146, '300Hz'], [0x147, '1kHz'], [0x148, '3kHz'], [0x149, '10kHz']]
const STEP = 5

export function Equaliser({ close, exitMenu }: AWProps) {
  const [focus, setFocus] = useState<number>(0)     // 0..5 rows, 6 Reset, 7 Close
  const [, redraw] = useState(0)
  const item = (i: number) => ({ id: ROWS[i][0], t: ROWS[i][1], v: [0, 100, STEP] as [number, number, number] })
  useRemote((k: RemoteKey) => {
    if (k === 'Up' || k === 'Down') {
      let f = focus
      if (k === 'Up') f = focus >= 6 ? 5 : focus - 1
      else f = focus < 5 ? focus + 1 : focus === 5 ? 6 : focus
      if (f >= 0 && f !== focus) {
        setFocus(f)
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k === 'Left' || k === 'Right') {
      if (focus < 6) {
        const it = item(focus)
        const v = getValue(it)
        const nv = Math.max(0, Math.min(100, v + (k === 'Left' ? -STEP : STEP)))
        if (nv !== v) {
          setValue(it, nv)
          playUi(UI_SOUND.MOVE)
          redraw(x => x + 1)
        }
      } else {
        const f = k === 'Left' ? 6 : 7
        if (f !== focus) {
          setFocus(f)
          playUi(UI_SOUND.MOVE)
        }
      }
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (focus === 6) {
        ROWS.forEach((_r, i) => setValue(item(i), 50))
        redraw(x => x + 1)
      } else if (focus === 7) close()
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })
  const W = 602, H = 488
  return (
    <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title="Equaliser" buttons={['Reset', 'Close']} focus={focus - 6}>
      {ROWS.map(([id, t], i) => {
        const f = focus === i
        const v = getValue(item(i))
        const thumb = 280 + 16 + Math.round((253 - 32) * v / 100)
        return (
          <div key={id} className="m13-eq-row" style={{ left: 0, top: 56 + 24 + i * 50, width: W, height: 50 }}>
            {f && <div className="m13-eq-focus" />}
            <div className="m13-eq-title" style={{ color: f ? '#fdd911' : '#fff' }}>{t}</div>
            {i === 0 ? (
              <>
                <div className="m13-eq-mark" style={{ left: 227 }}>L</div>
                <div className="m13-eq-mark" style={{ left: 533 }}>R</div>
              </>
            ) : (
              <>
                <img className="m13-eq-icon" src={`${IMG}/icon_subtraction${f ? '_s' : ''}.png`} style={{ left: 227 + 20 }} alt="" />
                <img className="m13-eq-icon" src={`${IMG}/icon_addition${f ? '_s' : ''}.png`} style={{ left: 533 + 20 }} alt="" />
              </>
            )}
            <div className="m13-cbar-track" style={{ position: 'absolute', left: 280 + 16, top: 21, width: 253 - 32 }} />
            <div className="m13-cbar-fill" style={{ position: 'absolute', left: 280 + 16, top: 21, width: Math.max(0, thumb - 296) }} />
            {f && <img className="m13-cbar-thumb" src={`${IMG}/control_progress_box_highlight.png`} style={{ position: 'absolute', left: thumb - 33, top: 8, width: 66, height: 33 }} alt="" />}
          </div>
        )
      })}
    </ActionFrame>
  )
}
