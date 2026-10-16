import { useCallback, useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { GadgetProps } from '../allsettings/extensions'
import { Keyboard, InputText } from '../../components/keyboard/Keyboard'
import { useTextEntry } from '../../components/keyboard/textEntry'
import { ACCESS_POINTS, getNet, setNet, useNet, type AccessPoint, type NetType } from './network'
import { NetPage, Ris, Spinner, type Btn } from './NetPage'
import { NET, useCountdown, useListScroll, wifiIcon } from './netUtil'

// Network Settings (NUI gadget org.tizen.appfw.gadget.NetworkSettings, org.tizen.example.NetworkSettings):
// network type -> Wi-Fi scan and list -> password -> checking -> connected, plus wired, Add Network,
// WPS and Manage Saved Networks. Pages and strings from the gadget's FSM and UI classes
// (spec3/connections.md 2.2); the radio and the router are mocked (network.ts).

const CHECK = `${TV}/VD_ICONS/i_icon_info_check.svg`
const SCAN_MS = 3000            // (inferred) time the scan takes
const CONNECT_MS = 3500         // (inferred) association + internet check
const WIRED_MS = 2500           // (inferred) wired check

const T = {
  title: 'Network Settings',                                          // TV_SID_NETWORK_SETTINGS
  networkType: 'Network type',                                        // COM_NETWORK_TYPE
  how: 'How do you connect to the Internet?',                         // COM_SID_HOW_CONNECT_TO_INTERNET
  wireless: 'Wireless',                                               // SID_WIRELESS_MALEID
  wired: 'Wired',                                                     // SID_WIRED
  wirelessConn: 'Wireless Connection',                                // TV_SID_OOBE_WIRELESS_CONNECTION
  wiredConn: 'Wired Connection',                                      // TV_SID_OOBE_WIRED_CONNECTION
  searching: 'Searching...',                                          // COM_SID_SEARCHING
  selectWifi: 'Select Wi-Fi.',                                        // TV_SID_OOBE_CAJUL_REMOTE_SELECT_WIFI
  scan: 'Scan',                                                       // COM_TV_SID_SCAN_KR_ST_SLK_SEARCH
  manage: 'Manage',                                                   // COM_SID_CONNECTION_CEJUN_MANAGE_NETWORKS
  cancel: 'Cancel',                                                   // SID_CANCEL
  addNetwork: 'Add Network',                                          // SID_ADD_NETWORK
  useWps: 'Use WPS',                                                  // TV_SID_USE_WPS
  enterPassword: 'Enter password.',                                   // SID_ENTER_PASSWORD
  showPassword: 'Show Password',                                      // SID_SHOW_PASSWORD
  checkingWireless: 'Checking wireless network connection…',          // TV_SID_VERIFYING_WIRELESS_NETWORK_CONNECTION
  checkingWired: 'Checking wired network connection…',                // TV_SID_VERIFYING_WIRED_NETWORK_CONNECTION
  basicInfo: 'Basic device information, such as the IP address, model name, etc., will be transmitted to Samsung for network connection.',
  connected: 'TV is connected to the Internet.',                      // PJT_SID_TV_CONNECTED_INTERNET, {0} = COM_SID_TV
  problems: 'If you have any problems using online services, please contact your Internet service provider.',
  ok: 'OK',
  retry: 'Retry',                                                     // COM_COMMONCTRL_RETRY
  changeNetwork: 'Change Network',                                    // COM_CHANGE_NETWORK_ABBR_15
  wirelessFailed: 'Wireless network connection failed.',              // TV_SID_WIRELESS_NETWORK_CONNECTION_FAILED
  unableWireless: 'Unable connect to the wireless network. Please try again.', // TV_SID_UNABLE_CONNECT_WIRELESS_TRY (sic)
  wrongPassword: 'The network password you entered is incorrect. Enter your password again by selecting Retry or select Change Network to connect to a different network.',
  ssidHelp: 'Enter the SSID of the network.',                         // SID_ENTER_SSID_HELP
  wps: 'Press the WPS or PBC button on your wireless router within the next two minutes.', // TV_SID_PRESS_WPS_PBC_WIRELESS_TWO_MIN
  manageTitle: 'Manage Saved Networks',                               // TV_SID_NETWORK_MANAGE_SAVED_NETWORKS
  selectDelete: 'Select saved networks to delete.',                   // TV_SID_NETWORK_SELECT_SAVED_NETWORKS_DELETE
  delete: 'Delete',                                                   // COM_SID_DELETE
  turnOnWifi: 'Wi-Fi must be turned on for a wireless connection. Would you like to set up Wi-Fi?',
  yes: 'Yes',
  no: 'No',
}

type Page =
  | { id: 'select' }
  | { id: 'scan' }
  | { id: 'list' }
  | { id: 'password'; ap: AccessPoint }
  | { id: 'add' }
  | { id: 'connecting'; type: NetType; ap?: AccessPoint; password?: string }
  | { id: 'success'; type: NetType }
  | { id: 'fail'; ap?: AccessPoint; reason: 'password' | 'unable' }
  | { id: 'wps' }
  | { id: 'manage' }
  | { id: 'wifi-off' }

export function NetworkSettings({ active, onClose, item }: GadgetProps) {
  const start: Page = item.id === 'networksettings-wireless' ? { id: 'scan' } : { id: 'select' }
  const [page, setPage] = useState<Page>(start)
  const go = useCallback((p: Page) => setPage(p), [])
  const close = (sound = true) => {
    if (sound) playFeedback('back')
    onClose()
  }
  const props = { go, close, active }
  switch (page.id) {
    case 'select': return <SelectPage {...props} />
    case 'wifi-off': return <WifiOffPage {...props} />
    case 'scan': return <ScanPage {...props} />
    case 'list': return <ListPage {...props} />
    case 'password': return <PasswordPage {...props} ap={page.ap} />
    case 'add': return <AddNetworkPage {...props} />
    case 'connecting': return <ConnectingPage {...props} page={page} />
    case 'success': return <SuccessPage {...props} type={page.type} />
    case 'fail': return <FailPage {...props} page={page} />
    case 'wps': return <WpsPage {...props} />
    case 'manage': return <ManagePage {...props} />
  }
}

type PageProps = { go: (p: Page) => void; close: (sound?: boolean) => void; active: boolean }

// Home and Exit leave the gadget to the menu (it closes); every other key stays here.
const passThrough = (key: RemoteKey) => key === 'Home' || key === 'Exit'

// Focus over [back, ...items, ...buttons]: Up/Down between the back icon, the list and the button row,
// Left/Right inside the button row (FocusNavigationHelper).
function useFocus(items: number, buttons: number, initial: number) {
  const [f, setF] = useState(initial) // -1 back, 0..items-1, items..items+buttons-1
  useMoveSound(f)
  const move = (key: RemoteKey) => {
    if (key === 'Up') {
      if (f >= items) setF(items > 0 ? items - 1 : -1)
      else setF(Math.max(-1, f - 1))
    } else if (key === 'Down') {
      if (f < items - 1) setF(f + 1)
      else if (f < items && buttons) setF(items)
    } else if (key === 'Left' && f > items) setF(f - 1)
    else if (key === 'Right' && f >= items && f < items + buttons - 1) setF(f + 1)
    else return false
    return true
  }
  return [f, setF, move] as const
}

function SelectPage({ go, close, active }: PageProps) {
  const net = useNet(s => s)
  const types: NetType[] = ['wireless', 'wired']
  const current = types.indexOf(net.type)
  const [f, , move] = useFocus(2, 0, current)
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') close()
    else if (move(key)) return true
    else if (key === 'Enter') {
      if (f === -1) close(false)
      else if (f === 0) go(net.wifiOn ? { id: 'scan' } : { id: 'wifi-off' })
      else go({ id: 'connecting', type: 'wired' })
    }
    return true
  }, active)
  // RIS picture follows the focused tile (ListVBridge_.OnTileFocused)
  const pic = f === 0 ? `${NET}/i_core_wifi_louter.svg` : f === 1 ? `${NET}/i_core_connections_lan_cable.svg` : `${NET}/oobe_img_ready_wireless.png`
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 0]}
      ris={<Ris desc={T.networkType} img={pic} />}
      bodyTitle={T.how}
      body={
        <div className="net-list" style={{ bottom: 'auto', height: 184 }}>
          {[T.wireless, T.wired].map((label, i) => (
            <div key={label} className={`net-item ${f === i ? 'is-focused' : ''}`} style={{ top: 8 + i * 88 }}>
              <span className="net-item__text">{label}</span>
              {i === current && (i === 1 ? net.cable : !!net.ssid) && <img className="net-item__check" src={CHECK} alt="" />}
            </div>
          ))}
        </div>
      }
    />
  )
}

// "{0} must be turned on for a wireless connection. Would you like to set up {0}?"
function WifiOffPage({ go, active }: PageProps) {
  const [f, , move] = useFocus(0, 2, 0)
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') go({ id: 'select' })
    else if (move(key)) return true
    else if (key === 'Enter') {
      if (f === 0) {
        setNet({ wifiOn: true })
        go({ id: 'scan' })
      } else go({ id: 'select' })
    }
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 0]}
      ris={<Ris desc={T.wirelessConn} img={`${NET}/i_core_wifi_louter.svg`} />}
      bodyTitle={T.turnOnWifi}
      buttons={[{ label: T.yes, focused: f === 0 }, { label: T.no, focused: f === 1 }]}
    />
  )
}

function ScanPage({ go, active }: PageProps) {
  const [f, , move] = useFocus(0, 1, 0)
  useEffect(() => {
    const t = setTimeout(() => go({ id: 'list' }), SCAN_MS)
    return () => clearTimeout(t)
  }, [go])
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') go({ id: 'select' })
    else if (move(key)) return true
    else if (key === 'Enter') go(f === -1 ? { id: 'select' } : { id: 'list' }) // Cancel stops the scan
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 0]}
      ris={<Ris desc={T.wirelessConn} img={`${NET}/i_core_wifi_louter.svg`} />}
      bodyTitle={T.searching}
      body={
        <div className="net-list">
          <div className="net-list__center"><Spinner /></div>
        </div>
      }
      buttons={[{ label: T.cancel, focused: f === 0 }]}
    />
  )
}

function ListPage({ go, active }: PageProps) {
  const net = useNet(s => s)
  // connected and saved networks first, then by signal (CsWifiNetSettings ordering, inferred)
  const aps = [...ACCESS_POINTS].sort((a, b) => {
    const rank = (x: AccessPoint) => (x.ssid === net.ssid ? 0 : net.saved.includes(x.ssid) ? 1 : 2)
    return rank(a) - rank(b) || b.rssi - a.rssi
  })
  const items = [...aps.map(a => a.ssid), T.addNetwork, T.useWps]
  const [f, , move] = useFocus(items.length, 2, 0)
  const scroll = useListScroll(f < items.length ? f : -1, items.length, 80, 208) // body: y 376-584
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') go({ id: 'select' })
    else if (move(key)) return true
    else if (key === 'Enter') {
      if (f === -1) go({ id: 'select' })
      else if (f < aps.length) {
        const ap = aps[f]
        if (!ap.secure || getNet().saved.includes(ap.ssid)) go({ id: 'connecting', type: 'wireless', ap })
        else go({ id: 'password', ap })
      } else if (f === aps.length) go({ id: 'add' })
      else if (f === aps.length + 1) go({ id: 'wps' })
      else if (f === items.length) go({ id: 'scan' })
      else go({ id: 'manage' })
    }
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 0]}
      ris={<Ris desc={T.wirelessConn} img={`${NET}/i_core_wifi_louter.svg`} />}
      bodyTitle={T.selectWifi}
      body={
        <div className="net-list">
          <div className="net-list__scroll" style={{ transform: `translateY(${-scroll}px)` }}>
            {items.map((label, i) => {
              const ap = aps[i]
              return (
                <div key={label} className={`net-item net-item--ap ${f === i ? 'is-focused' : ''}`} style={{ top: 8 + i * 88 }}>
                  {ap && <img className="net-item__icon" src={wifiIcon(ap)} alt="" />}
                  <span className="net-item__text">{label}</span>
                  {ap && ap.ssid === net.ssid && net.type === 'wireless' && <img className="net-item__check" src={CHECK} alt="" />}
                </div>
              )
            })}
          </div>
        </div>
      }
      buttons={[{ label: T.scan, focused: f === items.length }, { label: T.manage, focused: f === items.length + 1 }]}
    />
  )
}

// CNetworkWirelessPasswordPage: heading, 57x8 u field (max 63), "n/63" counter, Show Password; the
// keyboard opens below the field (LaunchIME: x = panel + 3 u, y = panel + 41 u). Done needs 8
// characters (WPA) or 5 (WEP).
function PasswordPage({ go, active, ap }: PageProps & { ap: AccessPoint }) {
  const entry = useTextEntry('', 63)
  const [show, setShow] = useState(false)
  const [onShow, setOnShow] = useState(false) // focus on the Show Password tile instead of the keyboard
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') {
      playFeedback('back')
      go({ id: 'list' })
    } else if (key === 'Enter') setShow(s => !s)
    else if (key === 'Down') setOnShow(false)
    return true
  }, active && onShow)
  const done = (text: string) => {
    if (text.length >= 8) go({ id: 'connecting', type: 'wireless', ap, password: text })
  }
  return (
    <>
      <NetPage title={T.title} backFocused={false} />
      <div className="net-pw">
        <div className="net-pw__heading">{T.enterPassword}</div>
        <div className="net-field is-editing">
          <InputText entry={entry} editing={!onShow} password={!show} />
        </div>
        <div className="net-pw__count">{`${entry.text.length}/63`}</div>
        <div className="net-pw__show">
          <div className={`net-item ${onShow ? 'is-focused' : ''}`}>
            <span className={`net-item__box ${show ? 'is-on' : ''}`} />
            <span className="net-item__text">{T.showPassword}</span>
          </div>
        </div>
      </div>
      {active && !onShow && (
        <Keyboard
          entry={entry}
          style={{ left: 104, top: 584 }}
          doneEnabled={entry.text.length >= 8}
          onDone={done}
          onCancel={() => go({ id: 'list' })}
          onExitUp={() => setOnShow(true)}
        />
      )}
    </>
  )
}

// Add Network (AddNetworkManually): the SSID with the keyboard, then the usual connection.
function AddNetworkPage({ go, active }: PageProps) {
  const entry = useTextEntry('', 32)
  const done = (ssid: string) => {
    const ap = ACCESS_POINTS.find(a => a.ssid.toLowerCase() === ssid.trim().toLowerCase())
    if (!ap) go({ id: 'fail', reason: 'unable' })
    else go(ap.secure ? { id: 'password', ap } : { id: 'connecting', type: 'wireless', ap })
  }
  return (
    <>
      <NetPage title={T.addNetwork} backFocused={false} />
      <div className="net-pw">
        <div className="net-pw__heading">{T.ssidHelp}</div>
        <div className="net-field is-editing">
          <InputText entry={entry} editing />
        </div>
        <div className="net-pw__count">{`${entry.text.length}/32`}</div>
      </div>
      {active && (
        <Keyboard entry={entry} style={{ left: 104, top: 584 }} doneEnabled={entry.text.length > 0} onDone={done} onCancel={() => go({ id: 'list' })} />
      )}
    </>
  )
}

function ConnectingPage({ go, active, page }: PageProps & { page: Extract<Page, { id: 'connecting' }> }) {
  const wired = page.type === 'wired'
  const [f, , move] = useFocus(0, 1, 0)
  useEffect(() => {
    const t = setTimeout(() => {
      if (wired) {
        setNet({ type: 'wired' })
        go({ id: 'success', type: 'wired' })
        return
      }
      const ap = page.ap!
      // mock router: any WPA2 password of 8+ characters is accepted
      if (ap.secure && page.password !== undefined && page.password.length < 8) {
        go({ id: 'fail', ap, reason: 'password' })
        return
      }
      setNet(s => ({ type: 'wireless', ssid: ap.ssid, saved: ap.secure && !s.saved.includes(ap.ssid) ? [...s.saved, ap.ssid] : s.saved }))
      go({ id: 'success', type: 'wireless' })
    }, wired ? WIRED_MS : CONNECT_MS)
    return () => clearTimeout(t)
  }, [go, page, wired])
  const cancel = () => go(wired ? { id: 'select' } : { id: 'list' })
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') cancel()
    else if (move(key)) return true
    else if (key === 'Enter') cancel()
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 1]}
      ris={<Ris desc={wired ? T.wiredConn : T.wirelessConn} loading />}
      bodyTitle={wired ? T.checkingWired : T.checkingWireless}
      body={<div className="net__msg">{T.basicInfo}</div>}
      buttons={[{ label: T.cancel, focused: f === 0 }]}
    />
  )
}

function SuccessPage({ close, active, type }: PageProps & { type: NetType }) {
  const [f, , move] = useFocus(0, 1, 0)
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') close()
    else if (move(key)) return true
    else if (key === 'Enter') close(false)
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 1]}
      ris={<Ris desc={type === 'wired' ? T.wiredConn : T.wirelessConn} lottie={`${NET}/oobe_connected.json`} />}
      bodyTitle={T.connected}
      body={<div className="net__msg">{T.problems}</div>}
      buttons={[{ label: T.ok, focused: f === 0 }]}
    />
  )
}

function FailPage({ go, active, page }: PageProps & { page: Extract<Page, { id: 'fail' }> }) {
  const [f, , move] = useFocus(0, 2, 0)
  const retry = () => (page.ap ? go({ id: 'password', ap: page.ap }) : go({ id: 'add' }))
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') go({ id: 'list' })
    else if (move(key)) return true
    else if (key === 'Enter') {
      if (f === 0) retry()
      else go({ id: 'list' })
    }
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      steps={[2, 1]}
      ris={<Ris desc={T.wirelessConn} img={`${NET}/i_core_wifi_louter.svg`} />}
      bodyTitle={T.wirelessFailed}
      body={<div className="net__msg">{page.reason === 'password' ? T.wrongPassword : T.unableWireless}</div>}
      buttons={[{ label: T.retry, focused: f === 0 }, { label: T.changeNetwork, focused: f === 1 }]}
    />
  )
}

// WPSPBCPage: two-minute countdown; nothing presses the router's button here, so it runs out.
function WpsPage({ go, active }: PageProps) {
  const [f, , move] = useFocus(0, 1, 0)
  const left = useCountdown(120, () => go({ id: 'fail', reason: 'unable' }))
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back' || key === 'Enter') go({ id: 'list' }) // back icon and Cancel both stop WPS
    else move(key)
    return true
  }, active)
  return (
    <NetPage
      title={T.useWps}
      backFocused={f === -1}
      ris={<Ris desc={T.wirelessConn} loading />}
      bodyTitle={T.wps}
      body={<div className="net__msg">{`Remaining time: ${left} sec`}</div>}
      buttons={[{ label: T.cancel, focused: f === 0 }]}
    />
  )
}

function ManagePage({ go, active }: PageProps) {
  const saved = useNet(s => s.saved)
  const [checked, setChecked] = useState<string[]>([])
  const [f, , move] = useFocus(saved.length, 2, saved.length ? 0 : saved.length)
  const scroll = useListScroll(f < saved.length ? f : -1, saved.length, 80, 424) // body: y 160-584
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') go({ id: 'list' })
    else if (move(key)) return true
    else if (key === 'Enter') {
      if (f === -1) go({ id: 'list' })
      else if (f < saved.length) {
        const s = saved[f]
        setChecked(c => (c.includes(s) ? c.filter(x => x !== s) : [...c, s]))
      } else if (f === saved.length) {
        if (!checked.length) return true
        setNet(n => ({
          saved: n.saved.filter(s => !checked.includes(s)),
          // forgetting the connected network disconnects it (inferred)
          ssid: n.ssid && checked.includes(n.ssid) ? null : n.ssid,
        }))
        go({ id: 'list' })
      } else go({ id: 'list' })
    }
    return true
  }, active)
  const buttons: Btn[] = [
    { label: T.delete, focused: f === saved.length, dim: !checked.length },
    { label: T.cancel, focused: f === saved.length + 1 },
  ]
  return (
    <NetPage
      title={T.manageTitle}
      backFocused={f === -1}
      bodyTitle={T.selectDelete}
      body={
        <div className="net-list">
          <div className="net-list__scroll" style={{ transform: `translateY(${-scroll}px)` }}>
            {saved.map((s, i) => (
              <div key={s} className={`net-item ${f === i ? 'is-focused' : ''}`} style={{ top: 8 + i * 88 }}>
                <span className={`net-item__box ${checked.includes(s) ? 'is-on' : ''}`} />
                <span className="net-item__text">{s}</span>
              </div>
            ))}
          </div>
        </div>
      }
      buttons={buttons}
    />
  )
}
