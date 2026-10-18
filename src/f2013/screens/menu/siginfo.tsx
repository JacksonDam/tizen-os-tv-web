import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { currentChannel, getTv, tuneChannel, useTv } from '../../tv/store'
import { ActionFrame } from './actionwin'
import { AW, baseKeys, type AWProps } from './kit'
import { IMG } from './parts'
import type { MenuItem } from './types'

// Support > Self Diagnosis > Signal Information (CSignalInformationActionWindow, a
// CMenuListActionWindowBase, signal info type < 2): window 602 wide, height = list window
// (MENU_ACTION_WINDOW_1_ITEM_H 224 + 48 per further item) + INNER_BOX_H 122 + INTRODUCTION_TEXT_H 96,
// centred; M 0x90b at (40,64) 533x96 size 24 row gap 8; inner box (21,168) 565x122 with Menu/signal_icon
// at (168,186) and the level Menu/signal_00..10 at (266,192); the list
// (GetListActionWindowSubItems 0x6ed) from ATSC_LIST_Y 274 + 24: Programme Number, Physical Channel,
// Modulation, SNR, Status; one Close button. CH +/- tune the next channel (t_KeyPressed registers
// keys 0x12 / 0x10) and the values refresh every second.
//
// The values come from the mocked tuner: the multiplex RF channel, "QAM" for the DVB-T/T2 modulation
// (GetMenuItemDataText: modulation types 1/2/0xb/0xe), a steady SNR per multiplex and "Lock"
// (inferred mock measurements; the firmware formats SNR as "%.2f dB").

function signalOf(rf: number | undefined) {
  const snr = 26 + ((rf ?? 0) % 5) * 1.25           // (inferred) mocked measurement
  const level = Math.min(10, Math.round((snr - 14) / 1.6))
  return { snr, level }
}

export function SignalInformation({ item, close, exitMenu }: AWProps & { item: MenuItem }) {
  const ch = useTv(s => currentChannel(s))
  useRemote((k: RemoteKey) => {
    if (k === 'ChannelUp' || k === 'ChannelDown') {
      const s = getTv()
      const n = s.channels.length
      if (n) {
        // next / previous digital TV service in list order (inferred: the TV's channel mode "All")
        let i = s.channel
        for (let j = 0; j < n; j++) {
          i = (i + (k === 'ChannelUp' ? 1 : -1) + n) % n
          if (s.channels[i].delivery === 'DTV') break
        }
        tuneChannel(i)
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
  const digital = !!ch && ch.delivery !== 'ATV'
  const { snr, level } = signalOf(ch?.rf)
  const rows: [string, string][] = [
    ['Programme Number', ch ? String(ch.number) : ''],
    ['Physical Channel', ch?.rf !== undefined ? String(ch.rf) : ''],
    ['Modulation', digital ? 'QAM' : ''],
    ['SNR', digital ? `${snr.toFixed(2)} dB` : ''],
    ['Status', digital ? 'Lock' : 'Unlock'],
  ]
  const W = 602
  const H = 224 + 48 * (rows.length - 1) + 122 + 96
  return (
    <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title={item.t} buttons={['Close']} focus={0}>
      <div className="m13-awin-text" style={{ left: 40, top: 64, width: 533, fontSize: AW.FONT_18, lineHeight: `${AW.FONT_18 + 8}px` }}>
        To check the signal for each channel, press channel up or down on your remote control.
      </div>
      <div className="m13-awin-inner" style={{ left: 21, top: 168, width: 565, height: 122 }} />
      <img src={`${IMG}/siginfo/signal_icon.png`} style={{ left: 168, top: 186 }} alt="" />
      <img src={`${IMG}/siginfo/signal_${String(digital ? level : 0).padStart(2, '0')}.png`} style={{ left: 266, top: 192 }} alt="" />
      {rows.map(([t, v], i) => (
        <div key={t} className="m13-sig-row" style={{ left: 0, top: 274 + 24 + i * 48, width: W, height: 48 }}>
          <span className="m13-sig-title">{t}</span>
          <span className="m13-sig-value">{v}</span>
        </div>
      ))}
    </ActionFrame>
  )
}
