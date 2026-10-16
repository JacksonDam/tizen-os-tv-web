import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Lottie } from '../../components/Lottie'
import { TV } from '../../assets'
import { ADDR, bars, type AccessPoint } from './network'
import './connections.css'

// The page frame shared by the network gadgets (org.tizen.example.NetworkSettings, org.tizen.NetworkStatus:
// INetworkPage), drawn inside the 65 x 87 u All Settings panel (520 x 696). Vertical FlexV stack:
// title 65x11 u (back icon + T32 title), step indicator 65x3 u, help image (RIS) 65x24 u, body title
// (T24 500, padding 5 u), body, button layout at the bottom. Citations in spec3/connections.md 2.

export const NET = `${TV}/network`
const SPINNER = `${TV}/support/i_img_progresscircle_01_s.json` // C_Loading_01

export type Btn = { label: string; focused: boolean; dim?: boolean }

export function NetPage({
  title,
  backFocused,
  steps,
  ris,
  bodyTitle,
  body,
  buttons,
  buttonsVertical,
  risH = 192,
}: {
  title: string
  backFocused: boolean
  steps?: [number, number]      // (total, current)
  ris?: ReactNode               // help image area, 192 px
  bodyTitle?: string
  body?: ReactNode
  buttons?: Btn[]
  buttonsVertical?: boolean     // NetworkStatus CreateButtonLayout: FlexV, 40x7 u buttons, 1 u gap
  risH?: number                 // help image height (Settings 24 u, Status 18 u)
}) {
  let y = 88
  const stepsTop = y
  if (steps) y += 24
  const risTop = y
  if (ris) y += risH
  const bodyTitleTop = y
  if (bodyTitle) y += 72
  const buttonsH = !buttons?.length ? 0 : buttonsVertical ? 8 + buttons.length * 56 + (buttons.length - 1) * 8 + 32 : 112
  return (
    <div className="net">
      <div className="as__top">
        <div className={`as__back ${backFocused ? 'is-focused' : ''}`}>
          <span className="as__back-icon" />
        </div>
        <div className="as__title">{title}</div>
      </div>
      {steps && (
        <div className="net__steps" style={{ top: stepsTop }}>
          {Array.from({ length: steps[0] }, (_, i) => (
            <span key={i} className={i === steps[1] ? 'is-current' : ''} />
          ))}
        </div>
      )}
      {ris && (
        <div className="net__ris" style={{ top: risTop, height: risH }}>
          {ris}
        </div>
      )}
      {bodyTitle && (
        <div className="net__body-title" style={{ top: bodyTitleTop }}>
          {bodyTitle}
        </div>
      )}
      {body && (
        <div className="net__body" style={{ top: y, bottom: buttonsH || 24 }}>
          {body}
        </div>
      )}
      {!!buttons?.length && (
        <div className={`net__buttons ${buttonsVertical ? 'net__buttons--v' : ''}`} style={{ height: buttonsH }}>
          {buttons.map(b => (
            <div key={b.label} className={`flux-btn net__button ${b.focused ? 'is-focused' : ''} ${b.dim ? 'is-dim' : ''}`}>
              {b.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// RIS area: T24 CC_Basic190 description over a 40 x 18 u picture, a Lottie or the loading spinner.
export function Ris({ desc, img, lottie, loading }: { desc: string; img?: string; lottie?: string; loading?: boolean }) {
  return (
    <>
      <div className="net__ris-desc">{desc}</div>
      <div className="net__ris-pic">
        {img && <img src={img} alt="" />}
        {lottie && <Lottie className="net__ris-lottie" src={lottie} playing />}
        {loading && <Lottie className="net__spinner" src={SPINNER} playing loop />}
      </div>
    </>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Lottie className={`net__spinner ${className ?? ''}`} src={SPINNER} playing loop />
}

// NetworkStatus INetworkPage.ShowHelpImage: TV (10x10 u) - link (5x10) - router (10x12) - link - Internet
// (10x10) in a 44 x 14 u row, the access point's signal icon above (wireless) and its name below (T20).
export function StatusDiagram({ state, ap }: { state: 'ok' | 'router-fail' | 'internet-fail'; ap: string }) {
  const link1 = state === 'router-fail' ? 'i_network_error.svg' : 'i_network_connect.svg'
  const link2 = state === 'ok' ? 'i_network_connect.svg' : 'i_network_error.svg'
  return (
    <div className="net-diagram">
      <div className="net-diagram__row">
        <img style={{ width: 80, height: 80 }} src={`${NET}/oobe_img_network_tv.webp`} alt="" />
        <img style={{ width: 40, height: 80 }} src={`${NET}/${link1}`} alt="" />
        <img style={{ width: 80, height: 96 }} src={`${NET}/i_network_wired.svg`} alt="" />
        <img style={{ width: 40, height: 80 }} src={`${NET}/${link2}`} alt="" />
        <img style={{ width: 80, height: 80 }} src={`${NET}/i_network_earth.svg`} alt="" />
      </div>
      <div className="net-diagram__ap">{ap}</div>
    </div>
  )
}

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
