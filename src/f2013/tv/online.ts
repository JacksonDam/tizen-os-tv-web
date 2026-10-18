import { getTv, setTv, useTv, type NetworkState, type SmartHubState } from './store'

// Online state of the 2013 TV: the mocked network connection and the Smart Hub terms/account. Screens
// read it to choose between the firmware's online and offline paths; the network and Smart Hub setup
// screens change it. The online content itself is the shared stub catalogue (src/shared/fictional.ts).

export function isConnected(n: NetworkState = getTv().network) {
  return n.type !== 'none' && (n.type === 'wired' || !!n.ssid)
}

export function useNetwork(): NetworkState {
  return useTv(s => s.network)
}
export function useConnected(): boolean {
  return useTv(s => isConnected(s.network))
}
export function setNetwork(patch: Partial<NetworkState>) {
  setTv(s => ({ network: { ...s.network, ...patch } }))
}

export function useSmartHub(): SmartHubState {
  return useTv(s => s.smartHub)
}
export function setSmartHub(patch: Partial<SmartHubState>) {
  setTv(s => ({ smartHub: { ...s.smartHub, ...patch } }))
}

// Smart Hub online content is available: connected and the terms agreed.
export function useSmartHubOnline(): boolean {
  return useTv(s => isConnected(s.network) && s.smartHub.agreed)
}
