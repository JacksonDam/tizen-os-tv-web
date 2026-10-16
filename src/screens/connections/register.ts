// Registers the Connections gadgets and popups (Network Status, Network Settings, Reset Network, the
// Wi-Fi switch, Bluetooth Device List) and the All Settings search page, and hooks their menu rows.
import { registerGadget, registerPopup } from '../allsettings/extensions'
import { patchRows, registerMenuPatch } from '../allsettings/menu'
import { NetworkSettings } from './NetworkSettings'
import { NetworkStatus } from './NetworkStatus'
import { BluetoothDevices } from './BluetoothDevices'
import { SettingsSearch } from './SettingsSearch'
import { ResetNetworkPopup, WifiSwitchPopup } from './Popups'

registerGadget('network-status', { width: 520, component: NetworkStatus })        // org.tizen.appfw.gadget.NetworkStatus
registerGadget('network-settings', { width: 520, component: NetworkSettings })    // org.tizen.appfw.gadget.NetworkSettings
registerGadget('bt-devices', { width: 520, component: BluetoothDevices })         // BluetoothGadget (BluetoothDeviceListGadget)
registerGadget('settings-search', { width: 520, component: SettingsSearch })      // org.tizen.menu SearchPage
registerPopup('reset-network', ResetNetworkPopup)                                 // org.tizen.appfw.gadget.ResetNetwork (popup)
registerPopup('wifi-onoff', WifiSwitchPopup)                                      // WiFiOnOff, after the switch

registerMenuPatch(menu =>
  patchRows(menu, {
    // the rows' help-animation texts are empty in menu-tv.json (network.json L11248-L11641)
    networkstatus: { gadget: 'network-status' },
    networksettings: { gadget: 'network-settings' },
    ResetNetwork: { popup: 'reset-network' },
    WIFI_ON_OFF: { popup: 'wifi-onoff' },
    'add-bluetooth-keyboard': { gadget: 'bt-devices' },
  }),
)
