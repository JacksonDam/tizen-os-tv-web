import { useEffect, useMemo, useRef, useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { closeApp, openApp } from '../../shell'
import { useConnected } from '../../tv/online'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getTv } from '../../tv/store'
import { ConnectResult } from '../net/ConnectResult'
import { ADDR, disconnectWireless, findAp, KEY_MAX, KEY_MIN, N, netTypeNow, online, scanResults, setNetType, signalIcon, type Ap } from '../net/data'
import { Osk } from '../net/Osk'
import { Wizard } from '../setup/wizard/Wizard'
import { AW, baseKeys, transparencyAlpha, type AWProps } from './kit'
import { IMG } from './parts'

// Network windows the Menu opens (the network app, exeDSP CNetwork*ActionWindow, NetworkOSDInfo in the
// 1280x720 OSD; texts g_NetworkWStringEng). The mocked set has built-in Wi-Fi and an Ethernet port
// (NetworkUtility::IsEthernetSupportedModel / IsInternalWifiModel) with no cable plugged in, and the
// museum's fictional Wi-Fi neighbourhood in range (net/data.ts): Wired tests fail the way the firmware
// reports it; Wireless connects to a chosen network and the tests pass.
// The network type is the setting 'networkType' ('Wireless' | 'Wired' | 'No Network', written by
// Plug & Play); "No Network" leaves the network manager on Wireless (inferred). The connection is the
// store's network state (tv/online.ts).

const NET = `${IMG}/net`

export type NetType = 'Wireless' | 'Wired'
const netType = netTypeNow

// ---------------------------------------------------------------------------------------------
// Network > Network Status (CNetworkStatusActionWindow): CDefaultWindow (232,69) 816x581, title
// "Network Status" size 26. A connection test runs first (message "Checking ... connection",
// connection picture animating network_settings_1/2/3 every 250 ms, one Cancel button), then the
// result: message (29,46) 757x69 size 22, picture network_settings_2 at (26,49) with the cross
// (popup_wi_cancel) on the TV-router link at (133,149) (m_SetConnectingAniImage state 3), the address
// list at x 366 from y 98 (rows 29, size 22; values size 18 right-aligned in 34 / 46 px cells),
// separators act_window_line at y 258 and 445, help text (26,264) 762x160 size 21, buttons at y 461.

const STATUS = { X: 232, Y: 69, W: 816, H: 581 }
const STATUS_ROWS = ['MAC Address', 'IP Address', 'Subnet Mask', 'Gateway', 'DNS Server']
const CHECK_MS = 2000   // (inferred) how long the test takes
const ANI = ['network_settings_1', 'network_settings_2', 'network_settings_3']  // b9, ba, bb

type Btn = { label: string; x: number; w: number; size: number; act: 'settings' | 'ip' | 'retry' | 'close' | 'cancel' | 'disconnect' }

// Connected (test result 5, CNetworkStatusActionWindow::t_OnEvent @02ef3f14): message N 0xaf (wireless),
// picture network_settings_4 (m_SetConnectingAniImage state 5), help N 0x66, the access point's name
// (NETWORK_STATUS_AP_NAME 96,205, 200 wide) and signal icon (NETWORK_STATUS_AP_SIGNAL 306,200) while
// and after testing (NetworkTest @02ef3060); buttons t_SetButton(1) from the Menu, wireless:
// Disconnect (N 0x91) / IP Settings / Retry / Close at FOUR_X 8 / 273 / 452 / 630, focus on Close.
// Disconnect drops the connection and the test runs again (inferred: the firmware's network manager
// disconnects; the window then reports the disconnected state).
export function NetworkStatus({ close, exitMenu, openSettings }: AWProps & { openSettings: () => void }) {
  const type = netType()
  const [checking, setChecking] = useState(true)
  const [ok, setOk] = useState(false)
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState(0)
  const [run, setRun] = useState(0)
  useEffect(() => {
    setChecking(true)
    setFocus(0)
    const ani = setInterval(() => setFrame(f => (f + 1) % 3), 250)
    const t = setTimeout(() => {
      const good = type === 'Wireless' && online()
      setOk(good)
      setChecking(false)
      // t_SetButton(1): focus on Close; t_SetButton(2): focus on Retry
      setFocus(good ? 3 : type === 'Wireless' ? 2 : 1)
    }, CHECK_MS)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [run, type])
  // CDefaultWindow alarm: 60 s without a key when opened from the Menu
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const arm = () => {
    clearTimeout(idle.current)
    idle.current = setTimeout(close, 60000)
  }
  useEffect(() => {
    arm()
    return () => clearTimeout(idle.current)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // t_SetButton: 0 = testing (Cancel at ONE_X 321), 1 = connected (Disconnect first), 2 = failed:
  // wireless 4 buttons (FOUR_X 8/273/452/630, "Network Setting" 260 wide), wired 3 buttons
  // (THREE_X 142/321/500); 173 x 53, btn_normal/focused
  const buttons: Btn[] = checking
    ? [{ label: 'Cancel', x: 321, w: 173, size: 20, act: 'cancel' }]
    : type === 'Wireless'
      ? [
          ok
            ? { label: N.disconnect, x: 8, w: 260, size: 18, act: 'disconnect' }
            : { label: 'Network Setting', x: 8, w: 260, size: 18, act: 'settings' },
          { label: 'IP Settings', x: 273, w: 173, size: 20, act: 'ip' },
          { label: 'Retry', x: 452, w: 173, size: 20, act: 'retry' },
          { label: 'Close', x: 630, w: 173, size: 20, act: 'close' },
        ]
      : [
          { label: 'IP Settings', x: 142, w: 173, size: 20, act: 'ip' },
          { label: 'Retry', x: 321, w: 173, size: 20, act: 'retry' },
          { label: 'Close', x: 500, w: 173, size: 20, act: 'close' },
        ]

  useRemote((k: RemoteKey) => {
    arm()
    if (k === 'Left' || k === 'Right') {
      const f = focus + (k === 'Left' ? -1 : 1)
      if (f >= 0 && f < buttons.length) {
        setFocus(f)
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k === 'Enter') {
      const b = buttons[focus]
      if (!b) return true
      playUi(UI_SOUND.SELECT)
      if (b.act === 'close') close()
      else if (b.act === 'retry') setRun(r => r + 1)
      else if (b.act === 'cancel') {
        setChecking(false)        // (inferred) Cancel stops the test on its result state
        const good = type === 'Wireless' && online()
        setOk(good)
        setFocus(good ? 3 : type === 'Wireless' ? 2 : 1)
      } else if (b.act === 'settings') openSettings()
      else if (b.act === 'disconnect') {
        disconnectWireless()
        setRun(r => r + 1)
      }
      // IP Settings opens the IP setup window (not built: the mocked router's DHCP sets everything)
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })

  const message = checking
    ? type === 'Wireless' ? N.checkingWireless : 'Checking wired network connection...'
    : type === 'Wireless' ? (ok ? N.readyToUse : N.wirelessDisconnected) : 'Wired network connection failed.'
  const help = checking
    ? ''
    : type === 'Wireless'
      ? ok ? N.connectedInternet : 'No wireless router selected. Go to Network settings to select your router.'
      : 'No network cable found. Check that your network cable is plugged in. If it is connected, make sure that the router is turned on. If it is on, try turning it off and on again.'
  const pic = checking ? ANI[frame] : ok ? 'network_settings_4' : 'network_settings_2'
  // values: connected, the mocked interface and DHCP addresses (net/data.ts); otherwise nothing is
  // assigned and the cells show the firmware's initial "00:00:00:00:00:00" / 0.0.0.0 (inferred)
  const n = getTv().network
  const live = type === 'Wireless' && online() && !checking
  const ap = type === 'Wireless' && online() ? findAp(n.ssid) : undefined
  const mac = live ? ADDR.mac.split(':').map((v, i) => (i ? ':' : '') + v) : ['00', ':00', ':00', ':00', ':00', ':00']
  const quad = (a: string) => a.split('.').map((v, i) => (i < 3 ? v + '.' : v + ' '))
  const rowsIp = live ? [quad(n.ip), quad(ADDR.subnet), quad(ADDR.gateway), quad(ADDR.dns)] : [1, 2, 3, 4].map(() => ['0.', '0.', '0.', '0 '])
  return (
    <div className="m13-awin" style={{ left: STATUS.X, top: STATUS.Y, width: STATUS.W, height: STATUS.H }}>
      <div className="m13-msg-shadow" style={{ left: -10, top: -10, width: STATUS.W + 21, height: STATUS.H + 21 }} />
      <div className="m13-msg-alpha" style={{ opacity: transparencyAlpha() }} />
      <div className="m13-awin-bg" />
      <div className="m13-awin-title" style={{ width: STATUS.W, height: AW.TITLE_H }}>Network Status</div>
      <div className="m13-net-clip" style={{ left: 26, top: 49, width: 426, height: 133 }}>
        <img src={`${NET}/${pic}.png`} alt="" />
      </div>
      {!checking && !ok && <img src={`${NET}/popup_wi_cancel.png`} style={{ left: 133, top: 149 }} alt="" />}
      {ap && (
        <>
          <div className="m13-net-cell m13-net-cell--left" style={{ left: 96, top: 205, width: 200, height: 26, fontSize: 18 }}>{ap.ssid}</div>
          <img src={signalIcon(ap)} style={{ left: 306 - 8, top: 200 - 4 }} alt="" />
        </>
      )}
      <div className="m13-net-msg" style={{ left: 29, top: 46, width: 757, height: 69, fontSize: 22 }}>{message}</div>
      {STATUS_ROWS.map((r, i) => (
        <div key={r} className="m13-net-cell m13-net-cell--left" style={{ left: 366, top: 98 + i * 29, width: 213, height: 29, fontSize: 22 }}>{r}</div>
      ))}
      {mac.map((v, i) => (
        <div key={'m' + i} className="m13-net-cell" style={{ left: 581 + i * 34, top: 98, width: 34, height: 29, fontSize: 18 }}>{v}</div>
      ))}
      {rowsIp.map((ip, r) =>
        ip.map((v, i) => (
          <div key={r + ':' + i} className="m13-net-cell" style={{ left: 602 + i * 46 + (i < 3 ? 2 : 0), top: 98 + (r + 1) * 29, width: 46, height: 29, fontSize: 18 }}>{v}</div>
        )),
      )}
      <img className="m13-net-line" src={`${NET}/act_window_line.png`} style={{ left: 10, top: 258 }} alt="" />
      <img className="m13-net-line" src={`${NET}/act_window_line.png`} style={{ left: 10, top: 445 }} alt="" />
      <div className="m13-net-msg" style={{ left: 26, top: 264, width: 762, height: 160, fontSize: 21, lineHeight: '27px' }}>{help}</div>
      {buttons.map((b, i) => (
        <div key={b.label} className={`m13-btn${i === focus ? ' m13-btn--focus' : ''}`} style={{ position: 'absolute', left: b.x, top: 461, width: b.w, height: 53 }}>
          <span style={{ fontSize: b.size }}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Network > Network Settings (CNetworkSettingsActionWindow on CWizardWindowBase / CWizardWidget,
// the menu variant: no steps, no navigation circles). Layout (1280 OSD):
//  - "Select your network type." (208,160) size 32 white
//  - network type row: list (133,208) 626x69 on black 0x26, title x 74 (266 wide) and value x 300
//    (253 wide, right-aligned), size 26, focus Common/wizard_highlight 649x93, focused text #feba19
//    (CNetworkActionWindowSelectionListNetworkTypeRenderer)
//  - Wireless: "Wireless network" (208,293) size 32; search animation Common/loading_48 at (506,282)
//    (18 frames, 250 ms); router list (133,352) 626 x 6 rows of 45 on black 0x26, focus 653x84
//    (CNetworkActionWindowSelectionListRenderer::Draw: name x 74 size 22, white / #feba19 focused;
//    list_check_icon at (32,7) on item 0 when it is the connected network; signal icon at (513,3),
//    NetworkSetup/icon_wifi_1..5 or icon_wifi_pin_1..5 (t_GetSignalStrength @02f231d4)), then
//    "Add Network". Buttons 166x66 wizard_terms_btn_n/s at y 637: Refresh (257) + WPS(PBC) (420), or
//    Stop (360) while searching (t_ShowButtons)
//  - Wired: no router list; "Connect" (200 wide) at (360,344), disabled while no cable is plugged in
//  - right: picture (826,213) and text (800,466) 373 wide, size 24, #5ff9ff
//    (t_UpdateStatusDrawing: wireless_built_in_5 + N 0x12f / message_lan_1 + N 0xef)
// OK on a network (m_OnListItemPress @02f0ff40 -> t_GotoNext @02f0fbbc -> ConnectCurrentAP @02f0fa0c):
// a secured one opens the security key keyboard (event 0x13 -> CNetworkIMEWindow), an open one (and
// the network already connected) goes straight to the connection test (t_ProcessConnect: event 0x38
// -> CNetworkGBResultActionWindow, net/ConnectResult.tsx).
// In Smart Hub setup (Smart Hub's Welcome > Start: { page: 'network-settings', from: 'smarthub' }) the
// frame shows step 1 of 7 with Previous / Next circles; Next needs a connection and goes on to the
// Smart Hub terms, Previous back to the Welcome page.

const SEARCH_MS = 3000  // (inferred) how long a scan takes
const ROWS6 = 6

type NSFocus = { area: 'type' } | { area: 'list'; i: number } | { area: 'btn'; i: number } | { area: 'prev' } | { area: 'next' }

// set by the Menu when it opens Network Settings for Smart Hub's setup
export const netContext = { smartHubSetup: false }

export function NetworkSettings({ close, exitMenu }: AWProps) {
  const smartHubSetup = netContext.smartHubSetup
  const [type, setType] = useState<NetType>(netType)
  const [searching, setSearching] = useState(type === 'Wireless')
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState<NSFocus>({ area: 'type' })
  const [popup, setPopup] = useState<number | null>(null)
  const [scan, setScan] = useState(0)
  const [top, setTop] = useState(0)
  const [phase, setPhase] = useState<{ kind: 'list' } | { kind: 'osk'; ssid: string } | { kind: 'connect'; ssid: string }>({ kind: 'list' })
  const connected = useConnected()
  useEffect(() => {
    if (type !== 'Wireless') return
    setSearching(true)
    setFrame(0)
    setTop(0)
    const ani = setInterval(() => setFrame(f => (f + 1) % 18), 250)
    const t = setTimeout(() => setSearching(false), SEARCH_MS)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [type, scan])

  const wireless = type === 'Wireless'
  const aps = useMemo(() => (searching ? [] : scanResults()), [searching])  // eslint-disable-line react-hooks/exhaustive-deps
  const list: (Ap | null)[] = wireless && !searching ? [...aps, null] : []   // null = "Add Network"
  const buttons: { label: string; x: number; y: number; w: number; dim?: boolean; act: string }[] = wireless
    ? searching
      ? [{ label: 'Stop', x: 360, y: 637, w: 166, act: 'stop' }]
      : [
          { label: 'Refresh', x: 257, y: 637, w: 166, act: 'refresh' },
          { label: 'WPS(PBC)', x: 420, y: 637, w: 166, act: 'wps' },
        ]
    : [{ label: 'Connect', x: 360, y: 344, w: 200, dim: true, act: 'connect' }]

  const go = (f: NSFocus) => {
    setFocus(f)
    playUi(UI_SOUND.MOVE)
  }
  const goList = (i: number) => {
    if (i < top) setTop(i)
    else if (i >= top + ROWS6) setTop(i - ROWS6 + 1)
    go({ area: 'list', i })
  }
  // leave for the Smart Hub's terms (Next / OK after connecting in Smart Hub setup)
  const toTerms = () => {
    closeApp('menu')
    openApp('smarthub', { page: 'terms' })
  }
  const toWelcome = () => {
    closeApp('menu')
    openApp('smarthub', { page: 'welcome' })
  }
  const pick = (ap: Ap) => {
    if (ap.secure && !(connected && getTv().network.ssid === ap.ssid)) setPhase({ kind: 'osk', ssid: ap.ssid })
    else setPhase({ kind: 'connect', ssid: ap.ssid })
  }

  useRemote((k: RemoteKey) => {
    if (phase.kind !== 'list') return false
    if (popup !== null) {
      if (k === 'Up' || k === 'Down') {
        const n = popup + (k === 'Up' ? -1 : 1)
        if (n >= 0 && n < 2) {
          setPopup(n)
          playUi(UI_SOUND.MOVE)
        }
      } else if (k === 'Enter') {
        playUi(UI_SOUND.SELECT)
        const t: NetType = popup === 0 ? 'Wireless' : 'Wired'
        setPopup(null)
        if (t !== type) {
          setType(t)
          setNetType(t)
        }
      } else if (k === 'Back' || k === 'Left') setPopup(null)
      else if (k === 'Exit' || k === 'Settings') exitMenu()
      return true
    }
    if (smartHubSetup && (k === 'Left' || k === 'Right') && focus.area !== 'btn') {
      // the navigation circles (Smart Hub setup only)
      if (k === 'Left') go(focus.area === 'next' ? { area: 'type' } : { area: 'prev' })
      else if (focus.area === 'prev') go({ area: 'type' })
      else if (connected) go({ area: 'next' })
      return true
    }
    if (focus.area === 'prev' || focus.area === 'next') {
      if (k === 'Enter') {
        playUi(UI_SOUND.SELECT)
        if (focus.area === 'prev') toWelcome()
        else toTerms()
        return true
      }
      if (k === 'Back') {
        toWelcome()
        return true
      }
      if (k === 'Exit') {
        closeApp('menu')
        return true
      }
      return true
    }
    if (k === 'Up' || k === 'Down') {
      const down = k === 'Down'
      if (focus.area === 'type') {
        if (down && list.length) goList(0)
        else if (down && buttons.some(b => !b.dim)) go({ area: 'btn', i: 0 })
      } else if (focus.area === 'list') {
        const n = focus.i + (down ? 1 : -1)
        if (n < 0) go({ area: 'type' })
        else if (n < list.length) goList(n)
        else if (buttons.some(b => !b.dim)) go({ area: 'btn', i: 0 })
      } else if (!down) {
        if (list.length) goList(list.length - 1)
        else go({ area: 'type' })
      }
      return true
    }
    if ((k === 'Left' || k === 'Right') && focus.area === 'btn') {
      const n = focus.i + (k === 'Left' ? -1 : 1)
      if (n >= 0 && n < buttons.length && !buttons[n].dim) go({ area: 'btn', i: n })
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (focus.area === 'type') setPopup(wireless ? 0 : 1)
      else if (focus.area === 'list') {
        const ap = list[focus.i]
        if (ap) pick(ap)
        // Add Network needs the name of a network the scan cannot see: none in this neighbourhood
        // (not built: the SSID / security type entry, N 0x76 / 0x2b)
      } else if (focus.area === 'btn') {
        const b = buttons[focus.i]
        if (b?.act === 'refresh') {
          setScan(s => s + 1)
          setFocus({ area: 'btn', i: 0 })
        } else if (b?.act === 'stop') {
          setSearching(false)
          setFocus({ area: 'btn', i: 0 })
        }
        // WPS(PBC) needs a router's push button (not built)
      }
      return true
    }
    if (smartHubSetup && k === 'Back') {
      toWelcome()
      return true
    }
    if (smartHubSetup && k === 'Exit') {
      closeApp('menu')
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })

  if (phase.kind === 'connect') {
    return (
      <div className="m13-net-stage">
        <ConnectResult
          ssid={phase.ssid}
          smartHubSetup={smartHubSetup}
          onOk={() => (smartHubSetup ? toTerms() : close())}
          onStop={() => setPhase({ kind: 'list' })}
          onExit={smartHubSetup ? () => closeApp('menu') : exitMenu}
          onPrev={() => setPhase({ kind: 'list' })}
        />
      </div>
    )
  }

  // keep the focus valid when the buttons change (search start/end, type change)
  const btnFocus = focus.area === 'btn' ? Math.min(focus.i, buttons.length - 1) : -1
  const typeFocused = focus.area === 'type' && popup === null
  const wfocus = focus.area === 'prev' ? 'prev' : focus.area === 'next' ? 'next' : 'content'
  return (
    <div className="m13-net-stage">
      <Wizard
        title="Network Settings"
        step={smartHubSetup ? 1 : 0}
        total={smartHubSetup ? 7 : 0}
        smartHubStep={smartHubSetup ? 7 : undefined}
        prev={smartHubSetup ? 'normal' : undefined}
        next={smartHubSetup ? (connected ? 'normal' : 'disabled') : undefined}
        focus={wfocus}
        pageKey="net"
      >
        <div className="m13-osd">
          <div className="m13-net-label" style={{ left: 208, top: 160, width: 573, fontSize: 32 }}>Select your network type.</div>
          <div className="m13-net-list" style={{ left: 133, top: 208, width: 626, height: 69 }} />
          {typeFocused && <div className="m13-net-focus" style={{ left: 133 - 11, top: 208 - 12, width: 649, height: 93 }} />}
          <div className="m13-net-cell m13-net-cell--left" style={{ left: 133 + 6 + 74, top: 208, width: 266, height: 69, fontSize: 26, color: typeFocused ? '#feba19' : '#fff' }}>Network type</div>
          <div className="m13-net-cell" style={{ left: 133 + 6 + 300, top: 208, width: 253, height: 69, fontSize: 26, color: typeFocused ? '#feba19' : '#fff' }}>{type}</div>
          {wireless && (
            <>
              <div className="m13-net-label" style={{ left: 208, top: 293, width: 573, height: 40, fontSize: 32, display: 'flex', alignItems: 'center' }}>Wireless network</div>
              {searching && <div className="m13-net-loading" style={{ left: 506, top: 282, backgroundPosition: `${-frame * 64}px 0` }} />}
              <div className="m13-net-list" style={{ left: 133, top: 352, width: 626, height: 270 }}>
                {list.slice(top, top + ROWS6).map((ap, k) => {
                  const i = top + k
                  const f = focus.area === 'list' && focus.i === i && popup === null
                  const isCur = !!ap && i === 0 && connected && getTv().network.ssid === ap.ssid
                  return (
                    <div key={ap ? ap.ssid : '+add'} className="n13-net__row" style={{ top: k * 45 }}>
                      {f && <div className="m13-net-focus" style={{ left: (626 - 653) / 2, top: (45 - 84) / 2, width: 653, height: 84 }} />}
                      {isCur && <img className="n13-net__check" src={`${IMG}/list_check_icon.png`} alt="" />}
                      <div className="n13-net__name" style={{ color: f ? '#feba19' : '#fff' }}>{ap ? ap.ssid : N.addNetwork}</div>
                      {ap && <img className="n13-net__sig" src={signalIcon(ap)} alt="" />}
                    </div>
                  )
                })}
              </div>
              {top > 0 && <img className="n13-net__arrow" src={`${NET}/indi_arrow_up_nor_s.png`} style={{ left: 133 + 313 - 24, top: 352 - 30 }} alt="" />}
              {top + ROWS6 < list.length && <img className="n13-net__arrow" src={`${NET}/indi_arrow_down_nor_s.png`} style={{ left: 133 + 313 - 24, top: 352 + 270 - 4 }} alt="" />}
            </>
          )}
          {buttons.map((b, i) => (
            <div key={b.label} className={`m13-net-btn${i === btnFocus ? ' m13-net-btn--sel' : ''}`} style={{ left: b.x, top: b.y, width: b.w, height: 66, opacity: b.dim ? 0.4 : 1 }}>
              <span>{b.label}</span>
            </div>
          ))}
          <img src={`${NET}/${wireless ? 'wireless_built_in_5' : 'message_lan_1'}.png`} style={{ position: 'absolute', left: 826, top: 213 }} alt="" />
          <div className="m13-net-label" style={{ left: 800, top: 466, width: 373, height: 266, fontSize: 24, lineHeight: '29px', color: '#5ff9ff' }}>
            {wireless ? 'You can connect your TV to the internet. Please select which wireless network to use.' : 'Plug a network cable in to the back of your TV.'}
          </div>
          {popup !== null && (
            <div className="m13-net-popup" style={{ left: 759 - 325, top: 208 + 69 }}>
              <NetPopup items={['Wireless', 'Wired']} focus={popup} current={wireless ? 0 : 1} />
            </div>
          )}
        </div>
      </Wizard>
      {phase.kind === 'osk' && (
        <Osk
          title={N.securityKey}
          guide={N.enterKey}
          password
          max={KEY_MAX}
          min={KEY_MIN}
          onDone={() => setPhase({ kind: 'connect', ssid: phase.ssid })}
          onCancel={() => setPhase({ kind: 'list' })}
        />
      )}
    </div>
  )
}

// CPopUpWidget for the network type (2 items: 162 px high), as the Menu's popups.
function NetPopup({ items, focus, current }: { items: string[]; focus: number; current: number }) {
  const W = 325, H = 162, S = 10
  return (
    <div className="m13-popup" style={{ left: 0, top: 0, width: W, height: H }}>
      <div className="m13-popup-shadow" style={{ width: W, height: H }} />
      <div className="m13-popup-fill" style={{ left: S, top: S, width: W - 21, height: H - 21 }} />
      <div className="m13-popup-bg" style={{ left: S, top: S, width: W - 21, height: H - 21 }} />
      <div className="m13-popup-list" style={{ left: S, top: S, width: W - 21, height: H - 21 }}>
        {items.map((t, i) => (
          <div key={t} className="m13-popup-item" style={{ top: 22 + i * 48 }}>
            {i === focus && <div className="m13-popup-focus" style={{ top: (48 - 85) / 2, width: 320 - 21 + 16 }} />}
            {i === current && <img className="m13-popup-check" src={`${IMG}/list_check_icon.png`} alt="" />}
            <div className="m13-popup-text" style={{ color: i === focus ? '#fdd911' : '#fff' }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Network > Wi-Fi Direct (CNetworkWifiDirectWindow): CDefaultWindow (253,88) 773x544, title N 0x84 size
// 26; "Device Name : <<A>>" (N 0x88, the TV name) at (29,72) and N 0x85 at (29,110), size 24; inner box
// Common/act_window_innerbox (18,177) 586x330 at the OSD transparency; device list (21,178) 7 rows of 53;
// the search animation (Common/loading_48, 250 ms) at (653,205) while searching; buttons 160x53 at
// x 605: Stop / Refresh (y 306) and Close (y 368). The window opens searching (t_SetButton: 120 s
// alarm); nothing is in range, so the list stays empty (inferred: after the 120 s the search stops).

export function WifiDirect({ close, exitMenu, tvName }: AWProps & { tvName: string }) {
  const [searching, setSearching] = useState(true)
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState(0)
  useEffect(() => {
    if (!searching) return
    const ani = setInterval(() => setFrame(f => (f + 1) % 18), 250)
    const t = setTimeout(() => setSearching(false), 120000)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [searching])
  useRemote((k: RemoteKey) => {
    if (k === 'Up' || k === 'Down') {
      const f = k === 'Up' ? 0 : 1
      if (f !== focus) {
        setFocus(f)
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (focus === 1) close()
      else setSearching(s => !s)
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })
  const W = 773, H = 544
  return (
    <div className="m13-awin" style={{ left: 253, top: 88, width: W, height: H }}>
      <div className="m13-msg-shadow" style={{ left: -10, top: -10, width: W + 21, height: H + 21 }} />
      <div className="m13-msg-alpha" style={{ opacity: transparencyAlpha() }} />
      <div className="m13-awin-bg" />
      <div className="m13-awin-title" style={{ width: W, height: AW.TITLE_H }}>Wi-Fi Direct</div>
      <div className="m13-net-msg" style={{ left: 29, top: 72, width: 600, height: 32, fontSize: 24 }}>{`Device Name : ${tvName}`}</div>
      <div className="m13-net-msg" style={{ left: 29, top: 110, width: 600, height: 64, fontSize: 24, alignItems: 'flex-start' }}>Select your Wi-Fi Direct device to connect to.</div>
      <div className="m13-net-innerbox" style={{ left: 18, top: 177, width: 586, height: 330, opacity: transparencyAlpha() }} />
      {searching && <div className="m13-net-loading" style={{ left: 653, top: 205, backgroundPosition: `${-frame * 64}px 0` }} />}
      {[searching ? 'Stop' : 'Refresh', 'Close'].map((b, i) => (
        <div key={i} className={`m13-btn${i === focus ? ' m13-btn--focus' : ''}`} style={{ position: 'absolute', left: 605, top: i ? 368 : 306, width: 160, height: 53 }}>
          <span>{b}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Network > AllShare Settings > Screen Mirroring (CWFDWindow, WFDOSDInfo 1280x720, state 1 "ready"):
// full screen AppCM/wizard_bg, title "Screen Mirroring" (W 4) at (177,64) 925x56 size 42 #5ff9ff centred,
// NetworkSetup/WFD/setting_mirroring at (536,184), the TV name at (177,402) 925x56 size 26 and W 0
// at (177,456) 925x160 size 26 centred / top, row gap 8. Waits for a phone (120 s, SetState(1));
// RETURN / EXIT close it (inferred: the timeout closes it too).

export function ScreenMirroring({ close, exitMenu, tvName }: AWProps & { tvName: string }) {
  useEffect(() => {
    const t = setTimeout(close, 120000)
    return () => clearTimeout(t)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useRemote((k: RemoteKey) => {
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute' && k !== 'Power'
  })
  return (
    <div className="m13-wfd">
      <div className="m13-wfd-text" style={{ left: 177, top: 64, width: 925, height: 56, fontSize: 42, color: '#5ff9ff', alignItems: 'center' }}>Screen Mirroring</div>
      <img src={`${NET}/setting_mirroring.png`} style={{ position: 'absolute', left: 536, top: 184 }} alt="" />
      <div className="m13-wfd-text" style={{ left: 177, top: 402, width: 925, height: 56, fontSize: 26, alignItems: 'center' }}>{tvName}</div>
      <div className="m13-wfd-text" style={{ left: 177, top: 456, width: 925, height: 160, fontSize: 26, lineHeight: '34px' }}>
        Ready for connection. To get started, launch AllShare Cast on your device.
      </div>
    </div>
  )
}
