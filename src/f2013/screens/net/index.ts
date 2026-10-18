// Network 2013 (online round): the mocked Wi-Fi, the on-screen keyboard, the connection test and the
// Smart Hub terms pages are used by the Menu, Plug & Play and Smart Hub modules (spec/online-net2013.md).
import './Account'
import { getTv } from '../../tv/store'
import { setNetwork, setSmartHub } from '../../tv/online'

// Test hook for captures: window.__net13.offline() / .notAgreed() / .online() / .state()
if (typeof window !== 'undefined') {
  ;(window as unknown as { __net13: object }).__net13 = {
    offline: () => setNetwork({ type: 'none', ssid: null }),
    online: () => {
      setNetwork({ type: 'wireless', ssid: 'Harbour View', ip: '192.168.0.23' })
      setSmartHub({ agreed: true })
    },
    notAgreed: () => setSmartHub({ agreed: false }),
    state: () => JSON.stringify({ network: getTv().network, smartHub: getTv().smartHub }),
  }
}
