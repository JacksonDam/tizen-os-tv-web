import { useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { setSetting } from '../../tv/store'
import { ActionFrame } from './actionwin'
import { baseKeys, type AWProps } from './kit'
import type { MenuItem } from './types'
import { PinBoxes } from './widgets'

// System > Change PIN after the PIN (CVChipChangePinActionWindow, MenuOSDInfo VCHIP_CHANGEPIN_*):
// window 602x405 centred, title = the item, "Enter New PIN" (M 0x2a5) at y 77 and "Confirm New PIN"
// (M 0x220) at y 209 (32 high, size 24), four boxes each (x 65 + 117 i, y 112 / 242). A mismatch shows
// the "again" layout (602x498: M 0x78c at (8,77) 586x64 size 26, texts at 173 / 304, boxes at 208 / 336);
// a match saves the PIN and shows the complete window (602x282, M 0x42a at (34,66) 538x149 size 24).
// One Close button (t_SetWindowButton 1).

export function ChangePin({ item, close, exitMenu }: AWProps & { item: MenuItem }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [again, setAgain] = useState(false)
  const [done, setDone] = useState(false)
  useRemote((k: RemoteKey) => {
    if (!done && k.startsWith('Digit')) {
      playUi(UI_SOUND.OSK_KEYPAD)
      const d = k.slice(5)
      if (first.length < 4) setFirst(first + d)
      else if (second.length < 4) {
        const s = second + d
        if (s.length < 4) setSecond(s)
        else if (s === first) {
          setSetting('menu.pin', s)
          setDone(true)
        } else {
          setFirst('')
          setSecond('')
          setAgain(true)
        }
      }
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      close()
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })
  const W = 602
  if (done) {
    const H = 282
    return (
      <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title={item.t} buttons={['Close']} focus={0}>
        <div className="m13-awin-text" style={{ left: 34, top: 66, width: 538, height: 149, fontSize: 24 }}>PIN is changed successfully.</div>
      </ActionFrame>
    )
  }
  const H = again ? 498 : 405
  const [t1, t2, b1, b2] = again ? [173, 304, 208, 336] : [77, 209, 112, 242]
  return (
    <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title={item.t} buttons={['Close']} focus={-1}>
      {again && <div className="m13-cpin-text" style={{ left: 8, top: 77, width: 586, height: 64, fontSize: 26 }}>Incorrect PIN. Please check and try again.</div>}
      <div className="m13-cpin-text" style={{ left: 0, top: t1, width: W, height: 32 }}>Enter New PIN</div>
      <PinBoxes x={65} y={b1} digits={first.length} active={first.length < 4} />
      <div className="m13-cpin-text" style={{ left: 0, top: t2, width: W, height: 32 }}>Confirm New PIN</div>
      <PinBoxes x={65} y={b2} digits={second.length} active={first.length === 4} />
    </ActionFrame>
  )
}
