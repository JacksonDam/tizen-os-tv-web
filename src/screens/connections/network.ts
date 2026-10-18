import { useSyncExternalStore } from 'react'

// Mocked network and Bluetooth hardware for the Connections apps (spec3/connections.md 5). The museum's
// TV starts online, on the Wi-Fi network "Harbour View" (ONLINE_DEFAULT; no LAN cable is plugged in), so
// the Smart Hub has its server content at once. A factory-fresh TV (FACTORY: first-time setup, Reset
// Network) has no saved network and is offline until setup or Network Settings connects it. Persisted
// per browser under its own key.

export type NetType = 'wired' | 'wireless'

export type AccessPoint = {
  ssid: string
  secure: boolean
  rssi: number      // dBm; CUtil.ConvertSignalStrengthToBars maps it to 0-4 bars
  freq: number      // MHz: > 2484 = 5 GHz icon set
}

// Fictional neighbourhood. Secured networks accept any WPA2 password of 8 or more characters (mock).
export const ACCESS_POINTS: AccessPoint[] = [
  { ssid: 'Harbour View 5G', secure: true, rssi: -41, freq: 5180 },
  { ssid: 'Harbour View', secure: true, rssi: -48, freq: 2437 },
  { ssid: 'Lantern House', secure: true, rssi: -63, freq: 2412 },
  { ssid: 'Garden Guest', secure: false, rssi: -69, freq: 2462 },
  { ssid: 'Studio Seven', secure: true, rssi: -76, freq: 5745 },
  { ssid: 'Maple Court Wi-Fi', secure: true, rssi: -83, freq: 2442 },
]

export type BtKind = 'buds' | 'soundbar' | 'speaker' | 'keyboard' | 'mouse' | 'gamepad' | 'headphone'
export type BtDevice = { id: string; name: string; kind: BtKind }

// Devices a Bluetooth scan finds (in pairing mode), in discovery order.
export const BT_NEARBY: BtDevice[] = [
  { id: 'bt-buds', name: 'Galaxy Buds3 Pro', kind: 'buds' },
  { id: 'bt-bar', name: 'Living Room Soundbar', kind: 'soundbar' },
  { id: 'bt-kbd', name: 'Compact Keyboard K2', kind: 'keyboard' },
  { id: 'bt-pad', name: 'Wireless Controller', kind: 'gamepad' },
  { id: 'bt-spk', name: 'Pebble Speaker', kind: 'speaker' },
]

export type NetState = {
  type: NetType                         // db/menu/network/network_type
  wifiOn: boolean                       // db/wifi/enabled (Expert Settings > Wi-Fi)
  ssid: string | null                   // connected access point (wireless)
  saved: string[]                       // access points with a saved password
  cable: boolean                        // a LAN cable is plugged in
  bt: { paired: string[]; connected: string | null }
}

const KEY = 'tizen-os-tv-web.network'
// Out of the box (db/menu/network/network_type wireless on a TV without a cable): nothing saved, offline.
export const FACTORY: NetState = {
  type: 'wireless',
  wifiOn: true,
  ssid: null,
  saved: [],
  cable: false,
  bt: { paired: [], connected: null },
}
// The museum's default: connected to the home router's 2.4 GHz network, its password saved.
export const HOME_SSID = 'Harbour View'
export const ONLINE_DEFAULT: NetState = { ...FACTORY, ssid: HOME_SSID, saved: [HOME_SSID] }

function load(): NetState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...ONLINE_DEFAULT, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return ONLINE_DEFAULT
}

let state = load()
const subs = new Set<() => void>()

export function getNet() {
  return state
}

export function setNet(patch: Partial<NetState> | ((s: NetState) => Partial<NetState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  subs.forEach(f => f())
}

export function useNet<T>(select: (s: NetState) => T): T {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => select(state),
  )
}

// Reset Network: back to the factory network settings, Wi-Fi on, no saved networks, so the TV is
// offline until it is connected again (Bluetooth pairings are kept).
export function resetNetwork() {
  setNet(s => ({ ...FACTORY, bt: s.bt }))
}

// ---- derived ----

export function isConnected(s: NetState) {
  return s.type === 'wired' ? s.cable : s.wifiOn && !!s.ssid
}

export function connectedAp(s: NetState): AccessPoint | undefined {
  return s.type === 'wireless' ? ACCESS_POINTS.find(a => a.ssid === s.ssid) : undefined
}

// CUtil.ConvertSignalStrengthToBars: thresholds -88/-77/-66/-55 dBm (inferred cut-offs) -> 0..4
export function bars(rssi: number) {
  return rssi < -88 ? 0 : rssi < -77 ? 1 : rssi < -66 ? 2 : rssi < -55 ? 3 : 4
}

// Mock addressing (DHCP from the home router).
export const ADDR = {
  wiredMac: '8c:ea:48:2a:91:5c',
  wirelessMac: '8c:ea:48:2a:91:5d',
  ip: '192.168.1.23',
  subnet: '255.255.255.0',
  gateway: '192.168.1.1',
  dns: '192.168.1.1',
}
