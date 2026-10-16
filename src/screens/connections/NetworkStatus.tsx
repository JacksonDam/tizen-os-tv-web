import { useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import type { GadgetProps } from '../allsettings/extensions'
import { connectedAp, getNet, isConnected, setNet, useNet } from './network'
import { NetPage, StatusDiagram } from './NetPage'
import { ADDRESS_ROWS } from './netUtil'

// Network Status (NUI gadget org.tizen.appfw.gadget.NetworkStatus): checks the connection with the
// TV - router - Internet diagram, then the success page with Retry / Disconnect / IP Settings stacked
// (NWSuccessPage.AddButtons), or the no-network page. IP Settings is org.tizen.IPSettings, shown here as
// a page. spec3/connections.md 3.

const CHECK_MS = 2000 // (inferred)

const T = {
  title: 'Network Status',                                            // TV_SID_NETWORK_STATUS
  checkingWired: 'Checking wired network connection…',
  checkingWireless: 'Checking wireless network connection…',
  connected: 'TV is connected to the Internet.',                      // PJT_SID_TV_CONNECTED_INTERNET
  problems: 'If you have any problems using online services, please contact your Internet service provider.',
  noNetwork: 'There is currently no network connection. Go to Network Settings and try connecting to the Internet.', // TV_SID_NW_NO_NETWORK_CONNECTION_SETTINGS
  disconnected: 'The network has been disconnected.',                 // TV_SID_NW_NETWORK_DISCONNECTED
  cancel: 'Cancel',
  retry: 'Retry',
  disconnect: 'Disconnect',                                           // COM_TV_SID_DISCONNECT
  ipSettings: 'IP Settings',                                          // TV_SID_IP_SETTINGS
  networkSettings: 'Network Settings',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  ipSetting: 'IP Setting',                                            // COM_IP_SETTING
  dnsSetting: 'DNS Setting',                                          // COM_DNS_SETTING
  dnsServer: 'DNS Server',                                            // SID_DNS_SERVER
  auto: 'Obtain automatically',                                       // COM_OBTAIN_AUTOMATICALLY
}

type Page = 'checking' | 'result' | 'disconnect' | 'ip'

const passThrough = (key: RemoteKey) => key === 'Home' || key === 'Exit'

export function NetworkStatus({ active, onClose, host }: GadgetProps) {
  const [page, setPage] = useState<Page>('checking')
  const net = useNet(s => s)
  const ap = connectedAp(net)
  const wireless = net.type === 'wireless'
  const close = (sound = true) => {
    if (sound) playFeedback('back')
    onClose()
  }

  useEffect(() => {
    if (page !== 'checking') return
    const t = setTimeout(() => setPage('result'), CHECK_MS)
    return () => clearTimeout(t)
  }, [page])

  if (page === 'ip') return <IpSettings active={active} onBack={() => setPage('result')} />
  if (page === 'disconnect') {
    return (
      <DisconnectPage
        active={active}
        name={ap?.ssid ?? ''}
        onAnswer={yes => {
          if (yes) setNet({ ssid: null })
          setPage('result')
        }}
      />
    )
  }
  if (page === 'checking') return <CheckingPage active={active} wireless={wireless} ap={ap?.ssid ?? ''} onCancel={() => close()} />
  return (
    <ResultPage
      active={active}
      connected={isConnected(net)}
      wireless={wireless}
      ap={ap?.ssid ?? ''}
      onBack={() => close()}
      onRetry={() => setPage('checking')}
      onDisconnect={() => setPage('disconnect')}
      onIp={() => setPage('ip')}
      onNetworkSettings={() => host.openPath?.(['connection', 'network', 'networksettings'])}
    />
  )
}

function useButtons(count: number, initial = 0) {
  const [f, setF] = useState(initial) // -1 = back icon
  useMoveSound(f)
  const move = (key: RemoteKey) => {
    if (key === 'Up') setF(x => Math.max(-1, x - 1))
    else if (key === 'Down') setF(x => Math.min(count - 1, x + 1))
    else return false
    return true
  }
  return [f, move] as const
}

function CheckingPage({ active, wireless, ap, onCancel }: { active: boolean; wireless: boolean; ap: string; onCancel: () => void }) {
  const [f, move] = useButtons(1)
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back' || key === 'Enter') onCancel()
    else move(key)
    return true
  }, active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      risH={144}
      ris={<StatusDiagram state="ok" ap={wireless ? ap : ''} />}
      bodyTitle={wireless ? T.checkingWireless : T.checkingWired}
      buttons={[{ label: T.cancel, focused: f === 0 }]}
      buttonsVertical
    />
  )
}

function ResultPage(p: {
  active: boolean
  connected: boolean
  wireless: boolean
  ap: string
  onBack: () => void
  onRetry: () => void
  onDisconnect: () => void
  onIp: () => void
  onNetworkSettings: () => void
}) {
  const labels = p.connected ? [T.retry, T.disconnect, T.ipSettings] : [T.retry, T.networkSettings]
  const [f, move] = useButtons(labels.length)
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') p.onBack()
    else if (move(key)) return true
    else if (key === 'Enter') {
      const b = f === -1 ? 'back' : labels[f]
      if (b === 'back') p.onBack()
      else if (b === T.retry) p.onRetry()
      else if (b === T.disconnect && p.wireless) p.onDisconnect()
      else if (b === T.ipSettings) p.onIp()
      else if (b === T.networkSettings) p.onNetworkSettings()
    }
    return true
  }, p.active)
  return (
    <NetPage
      title={T.title}
      backFocused={f === -1}
      risH={144}
      ris={<StatusDiagram state={p.connected ? 'ok' : 'router-fail'} ap={p.wireless ? p.ap : ''} />}
      bodyTitle={p.connected ? T.connected : T.noNetwork}
      body={p.connected ? <div className="net__msg">{T.problems}</div> : undefined}
      // Disconnect only applies to a wireless connection (inferred: dimmed on wired)
      buttons={labels.map((l, i) => ({ label: l, focused: f === i, dim: l === T.disconnect && !p.wireless }))}
      buttonsVertical
    />
  )
}

// Disconnect_Popup: "Do you want to disconnect {0}?"
function DisconnectPage({ active, name, onAnswer }: { active: boolean; name: string; onAnswer: (yes: boolean) => void }) {
  const [f, setF] = useState(0)
  useMoveSound(f)
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Left' || key === 'Right') setF(key === 'Left' ? 0 : 1)
    else if (key === 'Enter') onAnswer(f === 0)
    else if (key === 'Back') {
      playFeedback('back')
      onAnswer(false)
    }
    return true
  }, active)
  return (
    <>
      <NetPage title={T.title} backFocused={false} risH={144}
      ris={<StatusDiagram state="ok" ap={name} />} />
      <div className="net-popup">
        <div className="net-popup__plate">
          <div className="net-popup__msg">{`Do you want to disconnect ${name}?`}</div>
          <div className="net-popup__buttons">
            {[T.yes, T.no].map((b, i) => (
              <div key={b} className={`flux-btn net-popup__button ${f === i ? 'is-focused' : ''}`}>{b}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// IP Settings (org.tizen.IPSettings): IP Setting / DNS Setting are "Obtain automatically" on this mock,
// so the address rows are read-only.
function IpSettings({ active, onBack }: { active: boolean; onBack: () => void }) {
  const wireless = getNet().type === 'wireless'
  const rows: [string, string][] = [
    [T.ipSetting, T.auto],
    ...ADDRESS_ROWS(wireless).slice(1, 4),
    [T.dnsSetting, T.auto],
    [T.dnsServer, ADDRESS_ROWS(wireless)[4][1]],
  ]
  const [f, setF] = useState(0)
  useMoveSound(f)
  const n = rows.length // rows, then OK
  useRemote(key => {
    if (passThrough(key)) return false
    if (key === 'Back') {
      playFeedback('back')
      onBack()
    } else if (key === 'Up') setF(x => Math.max(-1, x - 1))
    else if (key === 'Down') setF(x => Math.min(n, x + 1))
    else if (key === 'Enter' && (f === -1 || f === n)) onBack()
    return true
  }, active)
  const scrollTop = Math.max(0, (Math.min(f, n - 1) - 4) * 88)
  return (
    <NetPage
      title={T.ipSettings}
      backFocused={f === -1}
      body={
        <div className="net-list">
          <div className="net-list__scroll" style={{ transform: `translateY(${-scrollTop}px)` }}>
            {rows.map(([k, v], i) => (
              <div key={k} className={`net-item ${f === i ? 'is-focused' : ''}`} style={{ top: 8 + i * 88 }}>
                <span className="net-item__text">
                  {k}
                  <span className="net-item__sub">{v}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      }
      buttons={[{ label: T.ok, focused: f === n }]}
    />
  )
}
