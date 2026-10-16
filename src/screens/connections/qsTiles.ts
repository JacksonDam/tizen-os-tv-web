import { TV } from '../../assets'
import { shell } from '../../tv/shell'
import type { Tile } from '../system/quickSettingsData'
import { BT_NEARBY, bars, connectedAp, setNet, useNet, type NetState } from './network'

// Quick Settings tiles that follow the mocked network and Bluetooth (QLPanel, external packages
// com.samsung.tv.coba.setting.networksettings / .btdevicelist): ResourceNetwork.Data picks the Network
// tile's title, subtitle and icon from the connection; the Bluetooth tile shows the connected device
// and lists the paired ones in its second depth. spec3/connections.md 6.

const NET = `${TV}/qlpanel/assets/networksettings`
const icon = (name: string) => `${NET}/${encodeURIComponent(name)}`

function networkTile(t: Tile, s: NetState): Tile {
  if (s.type === 'wired') {
    return s.cable
      ? { ...t, title: 'LAN', subtitle: 'Connected', icon: icon('43_lan_Connected.json') }        // UIType.ConnectedWire
      : { ...t, title: 'Network', subtitle: 'Disconnected', icon: icon('36_network_Disconnected.json') }
  }
  if (!s.wifiOn) return { ...t, title: 'Wi-Fi', subtitle: 'Off', icon: icon('140_wifi_Off.json') } // UIType.WiFiOFF
  const ap = connectedAp(s)
  if (!ap) return { ...t, title: 'Network', subtitle: 'Disconnected', icon: icon('36_network_Disconnected.json') }
  const n = bars(ap.rssi) // UIType.ConnectedWifi{VeryWeak..VeryStrong}: 31..35_network_Connected Level0..4
  return { ...t, title: 'Wi-Fi', subtitle: ap.ssid, icon: icon(`${31 + n}_network_Connected Level${n}.json`) }
}

function bluetoothTile(t: Tile, s: NetState): Tile {
  const connected = BT_NEARBY.find(d => d.id === s.bt.connected)
  const paired = BT_NEARBY.filter(d => s.bt.paired.includes(d.id))
  return {
    ...t,
    subtitle: connected?.name ?? '',
    second: {
      title: 'Bluetooth devices',                                       // COM_SID_BLUETOOTHD_CDMAY_BLUETOOTH_DEVICES
      groups: [
        [{ kind: 'menu', label: 'All Bluetooth Devices' }],            // TV_SID_QUICK_CDNOV_ALL_BLUETOOTH_DEVICES
        ...(paired.length ? [paired.map(d => ({ kind: 'menu' as const, label: d.name }))] : []),
      ],
    },
  }
}

// Tile overrides for QuickSettings: call inside the component, map each tile through the result.
export function useConnectionTiles(): (t: Tile) => Tile {
  const s = useNet(x => x)
  return t => (t.id === 'network' ? networkTile(t, s) : t.id === 'bt_devices' ? bluetoothTile(t, s) : t)
}

// Second-depth rows of those tiles. Returns true when handled.
export function connectionMenu(label: string): boolean {
  switch (label) {
    case 'Network Settings':
      shell.openSettings('connection/network/networksettings')
      return true
    case 'Network Status':
      shell.openSettings('connection/network/networkstatus')
      return true
    case 'All Bluetooth Devices':
      shell.openSettings('connection/add-bluetooth-keyboard')
      return true
  }
  // a paired device: connect it, or disconnect it when it is the connected one (inferred)
  const dev = BT_NEARBY.find(d => d.name === label)
  if (!dev) return false
  setNet(s => ({ bt: { ...s.bt, connected: s.bt.connected === dev.id ? null : dev.id } }))
  return true
}
