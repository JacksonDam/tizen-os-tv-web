import { useRemote } from '../../../../input/remote'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { useTv } from '../../../tv/store'
import { argb } from '../common'
import { deviceName, inputInfo } from '../sources'
import { Button } from './EditName'
import { Nine, Text } from './parts'

// Source > Tools > Information (CSourceInfoTVWnd): a CDefaultWindow at SOURCE_INFORMATION_WND_X/Y/W/H
// with title/colon/value rows (SOURCE_INFORMATION_ITEM_*) and an OK button (SOURCE_INFORMATION_BUTTON_*).
// TV: the channel counts per category (m_SetAllChannelCategoryInfoList 0x029a7d8c: All, TV, Radio,
// Data/Other; Analogue only with analogue channels). External inputs (m_SetLagacyDeviceInfoList
// 0x029a8710): Device Type and Resolution of the incoming signal.
const I = {
  X: 508, Y: 188, W: 904, H: 704, TITLE_H: 100,
  LIST_Y: 122, ITEM_H: 72, FONT: 36,
  TITLE_X: 60, TITLE_W: 776, COLON_X: 456, COLON_W: 26, VALUE_X: 470, VALUE_W: 388,
  BTN_X: 320, BTN_Y: 616, BTN_W: 264, BTN_H: 80,
}

export function InfoWindow({ inputId, onClose }: { inputId: string; onClose: () => void }) {
  const chs = useTv(s => s.channels)
  const it = inputInfo(inputId)
  let rows: [string, string][]
  if (inputId === 'TV') {
    const n = (k: string) => String(chs.filter(c => c.kind === k).length)
    rows = [['All', String(chs.length)], ['TV', n('tv')], ['Radio', n('radio')], ['Data/Other', n('data')]]
  } else {
    // Resolution of the mocked HDMI devices' signal (inferred format and value: 1080p60 stand-ins).
    rows = [['Device Type', deviceName(inputId)], ['Resolution', it?.video ? '1920x1080@60Hz' : '']]
  }
  useRemote(key => {
    if (key === 'Enter' || key === 'Back' || key === 'Exit' || key === 'Info') {
      playUi(key === 'Back' ? UI_SOUND.BACK : UI_SOUND.SELECT)
      onClose()
    }
    return true
  })
  return (
    <div style={{ position: 'absolute', left: I.X, top: I.Y, width: I.W, height: I.H }}>
      <Nine src="AppCM/act_popup_shadow.bmp" x={-16} y={-16} w={I.W + 32} h={I.H + 32} t={23} r={23} b={23} l={23} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)' }} />
      <Nine src="AppCM/act_window_bg.bmp" x={0} y={0} w={I.W} h={I.H} t={93} r={24} b={69} l={24} />
      <Text x={0} y={0} w={I.W} h={I.TITLE_H} size={40} color={argb(0xff7ddcff)} h_align={1}>Information</Text>
      {rows.map(([t, v], k) => (
        <div key={t}>
          <Text x={I.TITLE_X} y={I.LIST_Y + k * I.ITEM_H} w={I.COLON_X - I.TITLE_X} h={I.ITEM_H} size={I.FONT} color="#fff">{t}</Text>
          <Text x={I.COLON_X} y={I.LIST_Y + k * I.ITEM_H} w={I.COLON_W} h={I.ITEM_H} size={I.FONT} color="#fff">:</Text>
          <Text x={I.VALUE_X} y={I.LIST_Y + k * I.ITEM_H} w={I.VALUE_W} h={I.ITEM_H} size={I.FONT} color="#fff">{v}</Text>
        </div>
      ))}
      <Button x={I.BTN_X} y={I.BTN_Y} w={I.BTN_W} h={I.BTN_H} label="OK" focused />
    </div>
  )
}
