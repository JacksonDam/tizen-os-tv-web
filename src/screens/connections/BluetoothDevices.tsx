import { useEffect, useState } from 'react'
import { useRemote, type RemoteKey } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { GadgetProps } from '../allsettings/extensions'
import { BT_NEARBY, setNet, useNet, type BtDevice, type BtKind } from './network'
import { NetPage, Spinner } from './NetPage'

// Bluetooth Device List (NUI gadget org.tizen.appfw.gadget.BluetoothGadget, Called_App
// "BluetoothDeviceListGadget"): message box 65x17 u, divider, grouped list (Paired Devices / Available
// Devices, 57x14 u TextTileComplex items with an 8x8 u device icon and the state below the name), Scan
// button 32x7 u. OK on a device opens its sub-list (SubList.cs). The radio is mocked: a scan finds
// BT_NEARBY one by one. spec3/connections.md 4.

const VD = `${TV}/VD_ICONS`
const SCAN_MS = 8000          // (inferred) scan length
const FOUND_EVERY_MS = 1300   // (inferred) one device per tick
const CONNECT_MS = 2000       // (inferred)

const ICON: Record<BtKind, string> = {   // Common.GetDeviceIcon (common resources, i_icon_device_m_*)
  buds: 'i_icon_device_m_buds.svg',
  soundbar: 'i_icon_device_m_soundbar.svg',
  speaker: 'i_icon_device_m_soundbar_bt.svg',
  headphone: 'i_icon_device_m_headphone_bt.svg',
  keyboard: 'i_icon_device_m_keyboard.svg',
  mouse: 'i_icon_device_m_mouse.svg',
  gamepad: 'i_icon_device_m_gamepad.svg',
}

const T = {
  title: 'Bluetooth',                                                       // COM_SID_BLUETOOTH_KR_BLUE
  select: 'Select the Bluetooth devices you want to pair.',                 // TV_SID_CONNECTION_CEAPR_SELECT_THE_BLUETOOTH_DEVICES_YOU_WANT_TO_PAIR
  searching: 'Searching...',                                                // COM_SID_SEARCHING_KR_BLANK
  scanning: 'Scanning for Bluetooth devices in pairing mode...',
  paired: 'Paired Devices',                                                 // TV_SID_PAIRED_DEVICES
  available: 'Available Devices',                                           // TV_SID_AVAILABLE_DEVICE
  none: 'No devices found.',                                                // COM_TV_SID_NO_DEVICES_FOUND
  scan: 'Scan',
  stop: 'Stop',                                                             // COM_SID_STOP
  connected: 'Connected',                                                   // SID_CONNECTED
  pairedState: 'Paired',                                                    // TV_PAIRED
  needsPairing: 'Needs pairing',                                            // TV_NEEDS_PAIRING
  pairConnect: 'Pair and connect',                                          // TV_PAIR_AND_CONNECT
  connect: 'Connect',
  disconnect: 'Disconnect',
  unpair: 'Unpair',                                                         // DREAM_SAC_BUTTON_UNPAIR_16
  yes: 'Yes',
  no: 'No',
}

type Row = { kind: 'title'; label: string } | { kind: 'device'; dev: BtDevice; state: 'connected' | 'paired' | 'new' }
type Ask = { dev: BtDevice; action: 'disconnect' | 'unpair' }

export function BluetoothDevices({ active, onClose }: GadgetProps) {
  const bt = useNet(s => s.bt)
  const [scanning, setScanning] = useState(true) // the gadget scans when it opens (inferred)
  const [found, setFound] = useState<string[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sub, setSub] = useState<{ dev: BtDevice; focus: number } | null>(null)
  const [ask, setAsk] = useState<{ q: Ask; focus: number } | null>(null)

  // scan: devices in pairing mode show up one by one, then the scan stops by itself
  useEffect(() => {
    if (!scanning) return
    let n = 0
    const tick = setInterval(() => {
      n++
      setFound(BT_NEARBY.slice(0, n).map(d => d.id))
    }, FOUND_EVERY_MS)
    const end = setTimeout(() => setScanning(false), SCAN_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(end)
    }
  }, [scanning])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // pairing and connecting take a moment; one connected device at a time here (inferred)
  useEffect(() => {
    if (!connecting) return
    const dev = BT_NEARBY.find(d => d.id === connecting)!
    const t = setTimeout(() => {
      setNet(s => ({ bt: { paired: s.bt.paired.includes(dev.id) ? s.bt.paired : [...s.bt.paired, dev.id], connected: dev.id } }))
      setConnecting(null)
      setToast(`${dev.name} is connected.`) // COM_IDS_MSG_BT_CONNECTED
    }, CONNECT_MS)
    return () => clearTimeout(t)
  }, [connecting])

  const paired = BT_NEARBY.filter(d => bt.paired.includes(d.id))
  const avail = BT_NEARBY.filter(d => found.includes(d.id) && !bt.paired.includes(d.id))
  const rows: Row[] = [
    ...(paired.length ? [{ kind: 'title', label: T.paired } as Row] : []),
    ...paired.map((dev): Row => ({ kind: 'device', dev, state: bt.connected === dev.id ? 'connected' : 'paired' })),
    ...(avail.length ? [{ kind: 'title', label: T.available } as Row] : []),
    ...avail.map((dev): Row => ({ kind: 'device', dev, state: 'new' })),
  ]
  const devices = rows.flatMap((r, i) => (r.kind === 'device' ? [i] : []))
  const devAt = (i: number) => (rows[devices[i]] as Extract<Row, { kind: 'device' }>).dev.id
  // focus by device id, so it follows a device that moves from Available to Paired
  const [focusId, setFocusId] = useState<string>('scan') // 'back', 'scan' or a device id
  const fi = devices.findIndex(i => (rows[i] as Extract<Row, { kind: 'device' }>).dev.id === focusId)
  const f = focusId === 'back' ? -1 : fi >= 0 ? fi : -2 // -1 back, -2 Scan button, else index into devices
  const setF = (n: number) => setFocusId(n === -1 ? 'back' : n === -2 ? 'scan' : devAt(n))
  useMoveSound(`${focusId}:${sub?.focus}:${ask?.focus}`)
  const focusDev = f >= 0 ? (rows[devices[f]] as Extract<Row, { kind: 'device' }>) : null

  const options = (state: string) =>
    state === 'new' ? [T.pairConnect] : state === 'connected' ? [T.disconnect, T.unpair] : [T.connect, T.unpair]

  const run = (dev: BtDevice, opt: string) => {
    setSub(null)
    if (opt === T.pairConnect || opt === T.connect) {
      setScanning(false)
      setConnecting(dev.id)
    } else if (opt === T.disconnect) setAsk({ q: { dev, action: 'disconnect' }, focus: 0 })
    else if (opt === T.unpair) setAsk({ q: { dev, action: 'unpair' }, focus: 0 })
  }

  useRemote((key: RemoteKey) => {
    if (key === 'Home' || key === 'Exit') return false
    if (ask) {
      if (key === 'Left' || key === 'Right') setAsk({ ...ask, focus: key === 'Left' ? 0 : 1 })
      else if (key === 'Back') setAsk(null)
      else if (key === 'Enter') {
        if (ask.focus === 0) {
          const id = ask.q.dev.id
          setNet(s => ({
            bt: {
              paired: ask.q.action === 'unpair' ? s.bt.paired.filter(p => p !== id) : s.bt.paired,
              connected: s.bt.connected === id ? null : s.bt.connected,
            },
          }))
        }
        setAsk(null)
      }
      return true
    }
    if (sub) {
      const opts = options(focusDev?.state ?? 'new')
      if (key === 'Up' || key === 'Down') setSub({ ...sub, focus: Math.max(0, Math.min(opts.length - 1, sub.focus + (key === 'Up' ? -1 : 1))) })
      else if (key === 'Enter') run(sub.dev, opts[sub.focus])
      else if (key === 'Back' || key === 'Left') setSub(null)
      return true
    }
    if (key === 'Back') {
      playFeedback('back')
      onClose()
    } else if (key === 'Up') {
      if (f === -2) setF(devices.length ? devices.length - 1 : -1)
      else if (f >= 0) setF(f - 1)
    } else if (key === 'Down') {
      if (f === -1) setF(devices.length ? 0 : -2)
      else if (f >= 0) setF(f + 1 < devices.length ? f + 1 : -2)
    } else if (key === 'Enter') {
      if (f === -1) onClose()
      else if (f === -2) setScanning(s => !s)
      else if (focusDev && !connecting) setSub({ dev: focusDev.dev, focus: 0 })
    }
    return true
  }, active)

  // list geometry: titles 5 u, items 14 u inside a CC_Setting_BG_ListGroup box (1 u padding, r 2 u)
  const tops: number[] = []
  const boxes: { top: number; height: number }[] = []
  let y = 0
  rows.forEach((r, i) => {
    if (r.kind === 'title') {
      if (i) y += 16
      tops.push(y)
      y += 48
      boxes.push({ top: y, height: 16 })
    } else {
      tops.push(y + 8)
      y += 120
      boxes[boxes.length - 1].height += 120
    }
  })
  // keep the focused item in view (ScrollableBase)
  const viewH = 344
  const scrollY = focusDev ? Math.max(0, Math.min(y - viewH + 8, tops[devices[f]] + 120 - viewH + 8)) : 0

  return (
    <>
      <NetPage
        title={T.title}
        backFocused={f === -1}
        buttons={[{ label: scanning ? T.stop : T.scan, focused: f === -2 }]}
      />
      <div className="bt-desc" style={{ top: 96 }}>
        {scanning ? (
          <>
            <div className="bt-searching">
              <Spinner />
              {T.searching}
            </div>
            {T.scanning}
          </>
        ) : rows.length ? (
          T.select
        ) : (
          T.none
        )}
      </div>
      <div className="as__group" style={{ left: 32, top: 232, width: 456, height: 2, background: 'rgba(255,255,255,0.1)' }} />
      <div className="ss-results" style={{ top: 240, bottom: 112 }}>
        <div className="ss-results__scroll" style={{ transform: `translateY(${-scrollY}px)` }}>
          {boxes.map(b => (
            <div key={b.top} className="as__group" style={{ top: b.top, height: b.height - 8, left: 32, width: 472 }} />
          ))}
          {rows.map((r, i) =>
            r.kind === 'title' ? (
              <div key={r.label} className="bt-group-title" style={{ top: tops[i] + 4, left: 40 }}>{r.label}</div>
            ) : (
              <div
                key={r.dev.id}
                className={`net-item bt-item ${focusDev?.dev.id === r.dev.id && !sub && !ask ? 'is-focused' : ''}`}
                style={{ top: tops[i], left: 40 }}
              >
                <img className="net-item__icon" src={`${VD}/${ICON[r.dev.kind]}`} alt="" />
                <span className="net-item__text">
                  {r.dev.name}
                  <span className="net-item__sub">
                    {connecting === r.dev.id
                      ? `Connecting to ${r.dev.name}...`
                      : r.state === 'connected' ? T.connected : r.state === 'paired' ? T.pairedState : T.needsPairing}
                  </span>
                </span>
              </div>
            ),
          )}
        </div>
      </div>
      {sub && focusDev && (
        <div className="as-picker" style={{ left: 136, top: 240 + tops[devices[f]] - scrollY + 8, height: 'auto' }}>
          {options(focusDev.state).map((o, i) => (
            <div key={o} className={`as-picker__row ${sub.focus === i ? 'is-focused' : ''}`}><span>{o}</span></div>
          ))}
        </div>
      )}
      {ask && (
        <div className="net-popup">
          <div className="net-popup__plate" style={{ left: 17, bottom: 61 }}>
            <div className="net-popup__msg">
              {ask.q.action === 'disconnect' ? `Do you want to disconnect ${ask.q.dev.name}?` : `Unpair ${ask.q.dev.name}?`}
            </div>
            <div className="net-popup__buttons">
              {[T.yes, T.no].map((b, i) => (
                <div key={b} className={`flux-btn net-popup__button ${ask.focus === i ? 'is-focused' : ''}`}>{b}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && <div className="as__toast bt-toast">{toast}</div>}
    </>
  )
}
