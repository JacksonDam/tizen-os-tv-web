import { useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { Wizard, type WizFocus } from '../setup/wizard/Wizard'
import { CONNECT_MS, connectWireless, findAp, N, NET_IMG, signalIcon, type Ap } from './data'
import './net.css'

// Network Settings > a wireless network > (security key) > the connection test
// (CNetworkGBResultActionWindow, NetworkOSDInfo in the 1280x720 OSD, drawn in the wizard frame).
//  - message (t_CreateMessage @02ee52f8): N 0x47 "Checking wireless network connection…" while the test
//    runs; on success (test result 5, t_OnEvent @02ee977c) N 0xaf "Your wireless network and Internet
//    connection are setup and ready to use."; white, NETWORK_FONT_SIZE_20 (26), centred at y 157,
//    58 high, 2 rows at most, row gap 6
//  - picture 490x153 at (400,242) (NETWORK_RESULT_ALLSHARE_ONLY_X_CENTER, NETWORK_RESULT_IMAGE_Y):
//    the TV - router - internet animation (GetHelpAllShareOnlyAniImage: network_settings_test_1..3,
//    250 ms alarm) while connecting, network_settings_test_4 on success (m_SetConnectingAniImage
//    @02ee686c state 5)
//  - the access point's signal icon at (632,269) and its name at (517,384) 208x26, NETWORK_FONT_SIZE_18
//    (t_CreateHelpArea @02ee559c, t_SetSignalImage @02ee5b48)
//  - help (186,402) 906x210, NETWORK_FONT_SIZE_20, 0xf7ff8f, row gap 5: N 0x66 on success
//  - buttons (t_CreateButtons @02eec610): Common/wizard_btn_nor / _sel 246x85, NETWORK_FONT_SIZE_17;
//    "Stop" (N 0x57) while connecting, then "OK" (N 0x1f) at (517,610) with the focus.
// In Smart Hub setup (the network app run by the Smart Hub's Start, CNetworkSetupItemAce::
// IsSmartHubSetup) the frame shows step 1 of 7 with the cube as step 7 and the navigation circles
// (Create: CWizardWidget::Create(.., 7, 3), SetSmartHubStep(7), SetCurrentStep(1),
// EnableNavigationButton(1, 2)).

const TEST = ['network_settings_test_1', 'network_settings_test_2', 'network_settings_test_3']

export type ConnectResultProps = {
  ssid: string
  smartHubSetup?: boolean
  onOk: () => void        // OK after success (Menu: back to the list; Smart Hub setup: on to the terms)
  onStop: () => void      // Stop while connecting / RETURN: back to the network list
  onExit?: () => void     // EXIT
  onPrev?: () => void
}

export function ConnectResult({ ssid, smartHubSetup, onOk, onStop, onExit, onPrev }: ConnectResultProps) {
  const [done, setDone] = useState(false)
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState<WizFocus>(0)
  const ap: Ap | undefined = findAp(ssid)
  useEffect(() => {
    const ani = setInterval(() => setFrame(f => (f + 1) % TEST.length), 250)
    const t = setTimeout(() => {
      clearInterval(ani)
      connectWireless(ssid)
      setDone(true)
      setFocus(0)
    }, CONNECT_MS)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [ssid])

  useRemote((k: RemoteKey) => {
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (focus === 'prev') onPrev?.()
      else if (focus === 'next') onOk()
      else if (done) onOk()
      else onStop()
      return true
    }
    if (smartHubSetup && (k === 'Left' || k === 'Right')) {
      const order: WizFocus[] = ['prev', 0, 'next']
      const i = order.indexOf(focus) + (k === 'Left' ? -1 : 1)
      if (i >= 0 && i < order.length && (order[i] !== 'next' || done)) {
        setFocus(order[i])
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k === 'Back') {
      onStop()
      return true
    }
    if (k === 'Exit' || k === 'Settings') {
      ;(onExit ?? onStop)()
      return true
    }
    return k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute' && k !== 'Power'
  })

  return (
    <Wizard
      title={N.networkSettings}
      step={smartHubSetup ? 1 : 0}
      total={smartHubSetup ? 7 : 0}
      smartHubStep={smartHubSetup ? 7 : undefined}
      prev={smartHubSetup ? 'normal' : undefined}
      next={smartHubSetup ? (done ? 'normal' : 'disabled') : undefined}
      focus={focus}
      pageKey="net-result"
    >
      <div className="n13-osd n13-net">
        <div className="n13-net__msg" style={{ left: 0, top: 157, width: 1280, height: 58 }}>
          {done ? N.readyToUse : N.checkingWireless}
        </div>
        <img src={`${NET_IMG}/${done ? 'network_settings_test_4' : TEST[frame]}.png`} style={{ left: 400, top: 242 }} alt="" />
        {ap && <img src={signalIcon(ap)} style={{ left: 632 - 8, top: 269 - 8 }} alt="" />}
        <div className="n13-net__ap" style={{ left: 517, top: 384, width: 208, height: 26 }}>{ssid}</div>
        <div className="n13-net__help" style={{ left: 186, top: 402, width: 906, height: 210 }}>{done ? N.connectedInternet : ''}</div>
        <div className={`n13-net__wbtn${focus === 0 ? ' n13-net__wbtn--sel' : ''}`} style={{ left: 517, top: 610 }}>
          {done ? N.ok : N.stop}
        </div>
      </div>
    </Wizard>
  )
}
