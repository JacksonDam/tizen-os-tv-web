import { useEffect, useRef, useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getSetting, setSetting } from '../../tv/store'
import { Wizard } from '../setup/wizard/Wizard'
import { AW, baseKeys, transparencyAlpha, type AWProps } from './actionwin'
import { IMG } from './parts'

// Network windows the Menu opens (the network app, exeDSP CNetwork*ActionWindow, NetworkOSDInfo in the
// 1280x720 OSD; texts g_NetworkWStringEng). The mocked set has built-in Wi-Fi and an Ethernet port
// (NetworkUtility::IsEthernetSupportedModel / IsInternalWifiModel), no cable plugged in and no
// wireless router in range, so every test fails the way the firmware reports it.
// The network type is the setting 'networkType' ('Wireless' | 'Wired' | 'No Network', written by
// Plug & Play); "No Network" leaves the network manager on Wireless (inferred).

const NET = `${IMG}/net`

export type NetType = 'Wireless' | 'Wired'
export function netType(): NetType {
  return getSetting<string>('networkType', 'Wireless') === 'Wired' ? 'Wired' : 'Wireless'
}

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
const CHECK_MS = 2000   // (inferred) how long the failing test takes
const ANI = ['network_settings_1', 'network_settings_2', 'network_settings_3']  // b9, ba, bb

type Btn = { label: string; x: number; w: number; size: number; act: 'settings' | 'ip' | 'retry' | 'close' | 'cancel' }

export function NetworkStatus({ close, exitMenu, openSettings }: AWProps & { openSettings: () => void }) {
  const type = netType()
  const [checking, setChecking] = useState(true)
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState(0)
  const [run, setRun] = useState(0)
  useEffect(() => {
    setChecking(true)
    setFocus(0)
    const ani = setInterval(() => setFrame(f => (f + 1) % 3), 250)
    const t = setTimeout(() => {
      setChecking(false)
      setFocus(type === 'Wireless' ? 2 : 1)   // the focus goes to Retry (t_SetButton(2))
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

  // t_SetButton: 0 = testing (Cancel at ONE_X 321), 2 = failed: wireless 4 buttons (FOUR_X 8/273/452/630,
  // "Network Setting" 260 wide), wired 3 buttons (THREE_X 142/321/500); 173 x 53, btn_normal/focused
  const buttons: Btn[] = checking
    ? [{ label: 'Cancel', x: 321, w: 173, size: 20, act: 'cancel' }]
    : type === 'Wireless'
      ? [
          { label: 'Network Setting', x: 8, w: 260, size: 18, act: 'settings' },
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
        setChecking(false)        // (inferred) Cancel stops the test on its failure state
        setFocus(type === 'Wireless' ? 2 : 1)
      } else if (b.act === 'settings') openSettings()
      // IP Settings opens the IP setup window (not built: needs a network to be meaningful)
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })

  const message = checking
    ? type === 'Wireless' ? 'Checking wireless network connection…' : 'Checking wired network connection...'
    : type === 'Wireless' ? 'Wireless network disconnected' : 'Wired network connection failed.'
  const help = checking
    ? ''
    : type === 'Wireless'
      ? 'No wireless router selected. Go to Network settings to select your router.'
      : 'No network cable found. Check that your network cable is plugged in. If it is connected, make sure that the router is turned on. If it is on, try turning it off and on again.'
  const pic = checking ? ANI[frame] : 'network_settings_2'
  // values: no address assigned; the MAC cells show the firmware's initial "00:00:00:00:00:00"
  // (inferred: the mocked set reports no interface address)
  const mac = ['00', ':00', ':00', ':00', ':00', ':00']
  const ip = ['0.', '0.', '0.', '0 ']
  return (
    <div className="m13-awin" style={{ left: STATUS.X, top: STATUS.Y, width: STATUS.W, height: STATUS.H }}>
      <div className="m13-msg-shadow" style={{ left: -10, top: -10, width: STATUS.W + 21, height: STATUS.H + 21 }} />
      <div className="m13-msg-alpha" style={{ opacity: transparencyAlpha() }} />
      <div className="m13-awin-bg" />
      <div className="m13-awin-title" style={{ width: STATUS.W, height: AW.TITLE_H }}>Network Status</div>
      <div className="m13-net-clip" style={{ left: 26, top: 49, width: 426, height: 133 }}>
        <img src={`${NET}/${pic}.png`} alt="" />
      </div>
      {!checking && <img src={`${NET}/popup_wi_cancel.png`} style={{ left: 133, top: 149 }} alt="" />}
      <div className="m13-net-msg" style={{ left: 29, top: 46, width: 757, height: 69, fontSize: 22 }}>{message}</div>
      {STATUS_ROWS.map((r, i) => (
        <div key={r} className="m13-net-cell m13-net-cell--left" style={{ left: 366, top: 98 + i * 29, width: 213, height: 29, fontSize: 22 }}>{r}</div>
      ))}
      {mac.map((v, i) => (
        <div key={'m' + i} className="m13-net-cell" style={{ left: 581 + i * 34, top: 98, width: 34, height: 29, fontSize: 18 }}>{v}</div>
      ))}
      {[1, 2, 3, 4].map(row =>
        ip.map((v, i) => (
          <div key={row + ':' + i} className="m13-net-cell" style={{ left: 602 + i * 46 + (i < 3 ? 2 : 0), top: 98 + row * 29, width: 46, height: 29, fontSize: 18 }}>{v}</div>
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
//    (18 frames, 250 ms); router list (133,352) 626 x 6 rows of 45 on black 0x26, focus 653x84;
//    no router found -> one row "Add Network" (text x 74). Buttons 166x66 wizard_terms_btn_n/s at
//    y 637: Refresh (257) + WPS(PBC) (420), or Stop (360) while searching (t_ShowButtons)
//  - Wired: no router list; "Connect" (200 wide) at (360,344), disabled while no cable is plugged in
//  - right: picture (826,213) and text (800,466) 373 wide, size 24, #5ff9ff
//    (t_UpdateStatusDrawing: wireless_built_in_5 + N 0x12f / message_lan_1 + N 0xef)

const SEARCH_MS = 3000  // (inferred) a scan that finds nothing

type NSFocus = { area: 'type' } | { area: 'list'; i: number } | { area: 'btn'; i: number }

export function NetworkSettings({ close, exitMenu }: AWProps) {
  const [type, setType] = useState<NetType>(netType)
  const [searching, setSearching] = useState(type === 'Wireless')
  const [frame, setFrame] = useState(0)
  const [focus, setFocus] = useState<NSFocus>({ area: 'type' })
  const [popup, setPopup] = useState<number | null>(null)
  const [scan, setScan] = useState(0)
  useEffect(() => {
    if (type !== 'Wireless') return
    setSearching(true)
    setFrame(0)
    const ani = setInterval(() => setFrame(f => (f + 1) % 18), 250)
    const t = setTimeout(() => setSearching(false), SEARCH_MS)
    return () => {
      clearInterval(ani)
      clearTimeout(t)
    }
  }, [type, scan])

  const wireless = type === 'Wireless'
  const list = wireless && !searching ? ['Add Network'] : []
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
  useRemote((k: RemoteKey) => {
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
          setSetting('networkType', t)
        }
      } else if (k === 'Back' || k === 'Left') setPopup(null)
      else if (k === 'Exit' || k === 'Settings') exitMenu()
      return true
    }
    if (k === 'Up' || k === 'Down') {
      const down = k === 'Down'
      if (focus.area === 'type') {
        if (down && list.length) go({ area: 'list', i: 0 })
        else if (down && buttons.some(b => !b.dim)) go({ area: 'btn', i: 0 })
      } else if (focus.area === 'list') {
        const n = focus.i + (down ? 1 : -1)
        if (n < 0) go({ area: 'type' })
        else if (n < list.length) go({ area: 'list', i: n })
        else if (buttons.some(b => !b.dim)) go({ area: 'btn', i: 0 })
      } else if (!down) {
        go(list.length ? { area: 'list', i: list.length - 1 } : { area: 'type' })
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
      else if (focus.area === 'btn') {
        const b = buttons[focus.i]
        if (b?.act === 'refresh') {
          setScan(s => s + 1)
          setFocus({ area: 'btn', i: 0 })
        } else if (b?.act === 'stop') {
          setSearching(false)
          setFocus({ area: 'btn', i: 0 })
        }
        // WPS(PBC) and Add Network need a wireless router / the on-screen keyboard (not built)
      }
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })

  // keep the focus valid when the buttons change (search start/end, type change)
  const btnFocus = focus.area === 'btn' ? Math.min(focus.i, buttons.length - 1) : -1
  const typeFocused = focus.area === 'type' && popup === null
  return (
    <div className="m13-net-stage">
      <Wizard title="Network Settings" step={0} total={0} focus="content" pageKey="net">
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
                {list.map((t, i) => {
                  const f = focus.area === 'list' && focus.i === i && popup === null
                  return (
                    <div key={t} style={{ position: 'absolute', left: 0, top: i * 45, width: 626, height: 45 }}>
                      {f && <div className="m13-net-focus" style={{ left: (626 - 653) / 2, top: (45 - 84) / 2, width: 653, height: 84 }} />}
                      <div className="m13-net-cell m13-net-cell--left" style={{ left: 22 + 74, top: 0, width: 400, height: 45, fontSize: 26, color: f ? '#feba19' : '#fff' }}>{t}</div>
                    </div>
                  )
                })}
              </div>
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
