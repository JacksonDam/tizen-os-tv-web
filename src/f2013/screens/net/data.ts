import { ACCESS_POINTS } from '../../../screens/connections/network'
import { F13 } from '../../assets'
import { isConnected, setNetwork } from '../../tv/online'
import { getSetting, getTv, setSetting } from '../../tv/store'

// The 2013 TV's mocked network hardware and the network app's texts (spec/online-net2013.md).
// The neighbourhood is the museum's shared fictional one (src/screens/connections/network.ts): the
// built-in Wi-Fi finds those access points; a secured one accepts any security key of 8 or more
// characters (the firmware's own minimum for WPA: CNetworkIMEWindow::Create @02f04de0,
// CIMEWidget::SetCompareTextLength(7)); an open one connects without a key. No network cable is
// plugged in, so Wired still fails as before.

export const NET_IMG = `${F13}/net`

// g_NetworkWStringEng (N), index in hex
export const N = {
  addNetwork: 'Add Network',                                         // 0x00
  cancel: 'Cancel',                                                  // 0x03
  dns: 'DNS Server',                                                 // 0x04
  gateway: 'Gateway',                                                // 0x0c
  ip: 'IP Address',                                                  // 0x10
  mac: 'MAC Address',                                                // 0x11
  connected: 'Connected.\nNetwork Name',                             // 0x1b
  connecting: 'Connecting to network.\nNetwork Name',                // 0x1c
  ok: 'OK',                                                          // 0x1f
  securityKey: 'Security Key',                                       // 0x28
  subnet: 'Subnet Mask',                                             // 0x2d
  checkingWireless: 'Checking wireless network connection…',         // 0x47
  ipSettings: 'IP Settings',                                         // 0x4a
  retry: 'Retry',                                                    // 0x4d
  networkSettings: 'Network Settings',                               // 0x51
  wps: 'WPS(PBC)',                                                   // 0x53
  refresh: 'Refresh',                                                // 0x54
  stop: 'Stop',                                                      // 0x57
  wirelessComplete: 'Wireless network and Internet connection settings complete.', // 0x5b
  connectedInternet: 'You are connected to the Internet. If you have any problems using online services, please contact your Internet service provider.', // 0x66
  wirelessDisconnected: 'Wireless network disconnected',             // 0x6e
  close: 'Close',                                                    // 0x6f
  enterKey: 'Enter security key.',                                   // 0x75
  checkingNetworks: 'Checking for wireless networks...',             // 0x81
  disconnect: 'Disconnect',                                          // 0x91
  readyToUse: 'Your wireless network and Internet connection are setup and ready to use.', // 0xaf
  select: 'Select',                                                  // 0xea
  changeNetwork: 'Change Network',                                   // 0xf8
}

// Signal level 0..4 (IWirelessConnection signal, CNetworkActionWindowSelectionListRenderer::
// t_GetSignalStrength @02f231d4): NetworkSetup/icon_wifi_1..5 for open networks, icon_wifi_pin_1..5
// for secured ones (security type 1..3). The dBm cut-offs are the 2025 exhibit's (inferred).
export function signalLevel(rssi: number) {
  return rssi < -88 ? 0 : rssi < -77 ? 1 : rssi < -66 ? 2 : rssi < -55 ? 3 : 4
}
export function signalIcon(ap: Ap) {
  return `${NET_IMG}/icon_wifi_${ap.secure ? 'pin_' : ''}${signalLevel(ap.rssi) + 1}.png`
}

export type Ap = { ssid: string; secure: boolean; rssi: number }

// What a scan finds: the connected network first (the list renderer draws its check mark on item 0),
// then the others by signal strength (inferred order: the driver's scan list).
export function scanResults(): Ap[] {
  const cur = getTv().network.ssid
  const aps = ACCESS_POINTS.map(a => ({ ssid: a.ssid, secure: a.secure, rssi: a.rssi })).sort((a, b) => b.rssi - a.rssi)
  const i = aps.findIndex(a => a.ssid === cur)
  if (i > 0 && online()) aps.unshift(...aps.splice(i, 1))
  return aps
}

export function findAp(ssid: string | null) {
  return scanResults().find(a => a.ssid === ssid)
}

// Mocked addressing from the home router's DHCP server (inferred values; the IP is the store's).
export const ADDR = {
  mac: '8c:ea:48:13:f6:40',     // (mock) the built-in Wi-Fi's MAC address
  subnet: '255.255.255.0',
  gateway: '192.168.0.1',
  dns: '192.168.0.1',
}

// The security key rule: WPA keys 8..64 characters (CNetworkIMEWindow::Create: SetMaxLength(0x40),
// SetCompareTextLength(7) with the Done button dimmed below it).
export const KEY_MIN = 8
export const KEY_MAX = 64

// Connection timings (inferred: the footage does not show a full connection; the firmware's connect
// alarm allows up to 180 s, CNetworkGBResultActionWindow::Create @02eeb8e0).
export const CONNECT_MS = 2600

export function connectWireless(ssid: string) {
  setNetwork({ type: 'wireless', ssid, ip: getTv().network.ip || '192.168.0.23' })
  setSetting('networkType', 'Wireless')
}

export function disconnectWireless() {
  setNetwork({ ssid: null })
}

// The network type the network app works with is the setting 'networkType' ('Wireless' | 'Wired' |
// 'No Network', also written by Plug & Play; "No Network" leaves the network manager on Wireless,
// inferred as in the first round). The connection itself is the store's network state: a Wi-Fi
// connection is { type: 'wireless', ssid }; anything else is { type: 'none' } (the mocked set has no
// network cable, so Wired never connects).
export function netTypeNow(): 'Wireless' | 'Wired' {
  return getSetting<string>('networkType', 'Wireless') === 'Wired' ? 'Wired' : 'Wireless'
}

export function setNetType(t: 'Wireless' | 'Wired' | 'No Network') {
  setSetting('networkType', t)
  if (t !== 'Wireless') setNetwork({ type: 'none', ssid: null })
}

// Is the mocked TV online right now?
export function online() {
  const n = getTv().network
  return n.type === 'wireless' && isConnected(n)
}

// Set by the Menu when it opens Network Settings for Smart Hub's setup (the network app's Smart Hub
// setup scenario 0x4b1: step 1 of 7, Previous / Next circles).
export const netContext = { smartHubSetup: false }
