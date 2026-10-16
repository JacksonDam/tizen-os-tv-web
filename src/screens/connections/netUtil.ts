import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TV } from '../../assets'
import { ADDR, bars, type AccessPoint } from './network'

// Helpers shared by the network gadgets (NetPage.tsx draws the pages).
export const NET = `${TV}/network`

// CUtil.GetSignalStrength: icon_wifi/oobe_icon_n_wifi[_5G][_lock]_<bars>.svg
export function wifiIcon(ap: AccessPoint) {
  return `${NET}/oobe_icon_n_wifi${ap.freq > 2484 ? '_5G' : ''}${ap.secure ? '_lock' : ''}_${bars(ap.rssi)}.svg`
}

// A scrolling list inside a CC_Setting_BG_ListGroup box (ListV P_ListV_01, 57 x 10 u items, 1 u item gap
// with a CC_Basic110 divider): keeps the focused item in view like ScrollableBase.
export function useListScroll(focus: number, count: number, itemH: number, viewH: number) {
  const scroll = useRef(0)
  const top = focus * (itemH + 8)
  if (focus >= 0) {
    if (top - 8 < scroll.current) scroll.current = Math.max(0, top - 8)
    else if (top + itemH + 8 > scroll.current + viewH) scroll.current = top + itemH + 8 - viewH
  }
  const max = Math.max(0, count * (itemH + 8) + 8 - viewH)
  scroll.current = Math.min(scroll.current, max)
  return scroll.current
}

// Remaining-time countdown in seconds (WPS PBC: 120 s).
export function useCountdown(seconds: number, onEnd: () => void) {
  const [left, setLeft] = useState(seconds)
  const end = useRef(onEnd)
  useLayoutEffect(() => {
    end.current = onEnd
  })
  useEffect(() => {
    if (left <= 0) {
      end.current()
      return
    }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return left
}

export const ADDRESS_ROWS = (wireless: boolean): [string, string][] => [
  ['MAC Address', wireless ? ADDR.wirelessMac : ADDR.wiredMac],
  ['IP Address', ADDR.ip],
  ['Subnet Mask', ADDR.subnet],
  ['Gateway', ADDR.gateway],
  ['DNS', ADDR.dns],
]
