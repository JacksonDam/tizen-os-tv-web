import { useEffect, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { F13 } from '../../../assets'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { SOURCES } from '../../../tv/store'
import { useNetwork } from '../../../tv/online'
import { CONNECT_MS, connectWireless, KEY_MAX, KEY_MIN, N, online, scanResults, signalIcon, type Ap } from '../../net/data'
import { Osk } from '../../net/Osk'
import { popupHeight, POPUP_INSET, POPUP_MARGIN } from '../wizard/popupGeometry'
import { MessageBox, Popup } from '../wizard/widgets'
import { Wizard } from '../wizard/Wizard'
import { PNP_SMARTHUB_STEP, PNP_STEP, PNP_TOTAL, type PageProps } from './steps'
import { pnp, saveConfigure, type ChannelSource, type NetworkType } from './state'
import { COUNTRIES, S } from './strings'

// Step 2: Configure your TV (CPlugPlayTVUsageEnvironmentActionWindow; spec/setup.md 3.3). Rows from
// CMenuTreeManager::t_SetPNPTVUsageEnvironmentItem @0255000c: Country, Channel Source, Source (Set-top
// box only), Network type, Wireless network (Wireless only). Title at list x 64 (428 wide), value at
// x 540 right-aligned (CMenuWizardWindowTitleStringRenderer). Help window at (1248,252) 440x700.
// Next with Wireless and no network chosen: the "Essential Details" message box (t_BeforeGoToNextWindow
// @025b01f4, text M 0x909, OK, 30 s). The mocked set has no cable; its Wi-Fi finds the museum's fictional
// networks (net/data.ts). Online (spec/online-net2013.md): the Wireless network row scans when the page
// opens ("Checking for wireless networks...", N 0x81), its popup lists the networks found and then
// WPS(PBC), Add Network, Refresh (ReturnAPList @02eddda8); a secured network asks for its security key
// on the on-screen keyboard (CNetworkIMEWindow), then N 0x1c "Connecting to network.\nNetwork Name" and
// N 0x1b "Connected.\nNetwork Name" with the network's name (message boxes, inferred layout); the row then
// shows the name with its signal icon (value 356 wide at x 540, icon at ITEM_IMAGE_X 896, as the
// footage sAmJMgr1va0 0:46 shows) and Next goes on.

type Row = 'country' | 'channelSource' | 'source' | 'networkType' | 'wireless'
const NET_TYPES: NetworkType[] = ['Wireless', 'Wired', 'No Network']   // ReturnNetworkTypeList @02eddbf0
const CH_SOURCES: ChannelSource[] = ['Aerial', 'Set-top box']          // CPlugPlayChannelSourceItem
const WIFI_OPTIONS = [S.wps, S.addNetwork, S.refresh]                   // ReturnAPList after the networks
const PNP_IMG = `${F13}/setup/pnp`
const LIST_X = 176
const LIST_Y = 308
const LIST_W = 1032
const ROW_H = 104
const ROWS = 5
const WIFI_SCAN_MS = 2500  // "Checking for wireless networks..." after Refresh (inferred)

function inputs() {
  return SOURCES.filter(s => s.id !== 'TV')
}

export function ConfigurePage({ hiding, go }: PageProps) {
  const [, redraw] = useState(0)
  const [focus, setFocus] = useState<'list' | 'prev' | 'next'>('list')
  const [item, setItem] = useState(0)
  const [popup, setPopup] = useState<Row | null>(null)
  const [message, setMessage] = useState(false)
  const [checking, setChecking] = useState(pnp.networkType === 'Wireless')
  const [aps, setAps] = useState<Ap[]>([])
  const [osk, setOsk] = useState<string | null>(null)
  const [conn, setConn] = useState<{ ssid: string; done: boolean } | null>(null)
  const net = useNetwork()
  const connectedSsid = online() ? net.ssid : null

  const rows: Row[] = ['country', 'channelSource']
  if (pnp.channelSource === 'Set-top box') rows.push('source')
  rows.push('networkType')
  if (pnp.networkType === 'Wireless') rows.push('wireless')
  const row = rows[Math.min(item, rows.length - 1)]

  useEffect(() => {
    if (!checking) return
    const t = setTimeout(() => {
      setChecking(false)
      setAps(scanResults())
    }, WIFI_SCAN_MS)
    return () => clearTimeout(t)
  }, [checking])
  // connecting: N 0x1c for the test, then N 0x1b (inferred: same timing as the Menu's test)
  useEffect(() => {
    if (!conn || conn.done) return
    const t = setTimeout(() => {
      connectWireless(conn.ssid)
      setConn({ ssid: conn.ssid, done: true })
    }, CONNECT_MS)
    return () => clearTimeout(t)
  }, [conn])
  const connect = (ap: Ap) => {
    if (ap.secure && ap.ssid !== connectedSsid) setOsk(ap.ssid)
    else setConn({ ssid: ap.ssid, done: false })
  }

  const value = (r: Row) => {
    switch (r) {
      case 'country': return COUNTRIES[pnp.country]
      case 'channelSource': return pnp.channelSource === 'Aerial' ? S.aerial : S.setTopBox
      case 'source': return inputs().find(s => s.id === pnp.stbSource)?.title ?? inputs()[0]?.title ?? ''
      case 'networkType': return pnp.networkType
      case 'wireless': return checking ? S.checkingWireless : connectedSsid ?? S.select
    }
  }
  const title = (r: Row) =>
    ({ country: S.country, channelSource: S.channelSource, source: S.source, networkType: S.networkType, wireless: S.wirelessNetwork })[r]

  const options = (r: Row): { items: string[]; value: number } => {
    switch (r) {
      case 'country': return { items: COUNTRIES, value: pnp.country }
      case 'channelSource': return { items: [S.aerial, S.setTopBox], value: CH_SOURCES.indexOf(pnp.channelSource) }
      case 'source': {
        const list = inputs()
        return { items: list.map(s => s.title), value: Math.max(0, list.findIndex(s => s.id === pnp.stbSource)) }
      }
      case 'networkType': return { items: NET_TYPES, value: NET_TYPES.indexOf(pnp.networkType) }
      case 'wireless': return { items: [...aps.map(a => a.ssid), ...WIFI_OPTIONS], value: aps.findIndex(a => a.ssid === connectedSsid) }
    }
  }

  const pick = (r: Row, i: number) => {
    if (r === 'country') pnp.country = i
    else if (r === 'channelSource') {
      pnp.channelSource = CH_SOURCES[i]
      if (pnp.channelSource === 'Set-top box' && !pnp.stbSource) pnp.stbSource = inputs()[0]?.id ?? ''
    } else if (r === 'source') pnp.stbSource = inputs()[i]?.id ?? ''
    else if (r === 'networkType') pnp.networkType = NET_TYPES[i]
    else if (r === 'wireless' && i < aps.length) connect(aps[i])
    else if (r === 'wireless' && WIFI_OPTIONS[i - aps.length] === S.refresh) setChecking(true)
    // WPS(PBC) needs a router's push button and Add Network a network the scan cannot see (inferred:
    // the popup closes)
    setPopup(null)
    redraw(n => n + 1)
  }

  const goNext = () => {
    // CNetworkAddMenuItem::ReturnAPSelected: Wireless without a chosen network blocks Next
    if (pnp.networkType === 'Wireless' && !connectedSsid) {
      setMessage(true)
      return
    }
    saveConfigure()
    // antenna type 2 (Set-top box) skips Auto Tuning (GetPlugPlayNextStep 3 -> clock check ->
    // m_GetNextClockStep: the Smart Hub T&C with a network, else 11)
    go(pnp.channelSource === 'Set-top box' ? (online() ? 'terms' : 'complete') : 'autotune')
  }

  useRemote(key => {
    if (hiding || popup || message || osk || conn) return !osk && !conn
    if (focus === 'list') {
      if (key === 'Up' || key === 'Down') {
        const i = key === 'Up' ? item - 1 : item + 1
        if (i >= 0 && i < rows.length) {
          setItem(i)
          playUi(16)
        }
      } else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        setPopup(row)
      } else if (key === 'Right') {
        setFocus('next')
        playUi(16)
      } else if (key === 'Left') {
        setFocus('prev')
        playUi(16)
      }
      return true
    }
    if (focus === 'next') {
      if (key === 'Left') setFocus('list')
      else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        goNext()
      }
      return true
    }
    if (key === 'Right') setFocus('list')
    else if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      go('language')
    }
    return true
  })

  const listFocused = focus === 'list' && !message
  const help = helpFor(row)
  const rowTop = (k: number) => LIST_Y + 102 + ROW_H * k
  const pop = popup ? options(popup) : null
  const popTop = popup && pop
    ? Math.min(rowTop(rows.indexOf(popup)) - POPUP_INSET - POPUP_MARGIN, 1080 - 24 - popupHeight(pop.items.length))
    : 0
  return (
    <>
      <Wizard
        title={S.configureTitle}
        step={PNP_STEP.configure}
        total={PNP_TOTAL}
        smartHubStep={PNP_SMARTHUB_STEP}
        prev="normal"
        next="normal"
        focus={listFocused ? 'content' : focus === 'list' ? 'content' : focus}
        bubble={listFocused ? 'next' : undefined}
        hiding={hiding}
        pageKey="configure"
      >
        <div className={`pnp-dim${message ? ' pnp-dim--on' : ''}`}>
          <div className="pnp-intro pnp-intro--list">{S.configureIntro}</div>
          <div className="wl">
            {rows.slice(0, ROWS).map((r, k) => {
              const cls = !listFocused ? ' wl__row--dim' : k === item ? ' wl__row--focus' : ''
              return (
                <div key={r} className={`wl__row${cls}`} style={{ top: 102 + ROW_H * k }}>
                  {listFocused && k === item && <div className="wl__focus" />}
                  <span className="wl__title">{title(r)}</span>
                  {r === 'wireless' && connectedSsid && !checking ? (
                    <>
                      <span className="wl__value" style={{ width: 356 }}>{connectedSsid}</span>
                      {(() => {
                        const ap = aps.find(a => a.ssid === connectedSsid) ?? scanResults().find(a => a.ssid === connectedSsid)
                        return ap && <img className="wl__icon" src={signalIcon(ap)} alt="" />
                      })()}
                    </>
                  ) : (
                    <span className="wl__value">{value(r)}</span>
                  )}
                </div>
              )
            })}
          </div>
          {/* help window (1248,252): text alone at the top; with a picture, the picture on top and the
              text under it like the TV usage layout (TV_USAGE_PIG 842,189 / TV_USAGE_INFO_TEXT_PIG
              842,380 of the 1280 OSD) (inferred: the CHelpWindow layout was not traced) */}
          {help.img ? (
            <>
              <img className="pnp-helpimg" src={`${PNP_IMG}/${help.img}`} alt="" />
              <div className="pnp-help pnp-help--below">{help.text}</div>
            </>
          ) : (
            <div className="pnp-help pnp-help--top">{help.text}</div>
          )}
        </div>
      </Wizard>
      {popup && pop && (
        <Popup
          items={pop.items}
          value={pop.value}
          right={1920 - (LIST_X + LIST_W) - POPUP_INSET}
          top={popTop}
          onPick={i => pick(popup, i)}
          onClose={() => setPopup(null)}
        />
      )}
      {message && <MessageBox text={S.noNetworkAdvice} buttons={[S.ok]} timeoutMs={30000} onButton={() => setMessage(false)} />}
      {osk && (
        <Osk
          title={N.securityKey}
          guide={N.enterKey}
          password
          max={KEY_MAX}
          min={KEY_MIN}
          onDone={() => {
            const ssid = osk
            setOsk(null)
            setConn({ ssid, done: false })
          }}
          onCancel={() => setOsk(null)}
        />
      )}
      {conn && (
        <MessageBox
          text={`${conn.done ? N.connected : N.connecting}\n${conn.ssid}`}
          buttons={conn.done ? [S.ok] : []}
          onButton={() => conn.done && setConn(null)}
        />
      )}
    </>
  )
}

function helpFor(r: Row): { text: string; img?: string } {
  switch (r) {
    case 'country': return { text: S.countryHelp }
    case 'channelSource': return { text: S.channelSourceHelp }
    case 'source': return { text: '' }
    case 'networkType':
      // ReturnNetworkTypeHelp @02edebc8
      if (pnp.networkType === 'Wireless') return { text: S.wirelessHelp, img: 'wireless_built_in_5.png' }
      if (pnp.networkType === 'Wired') return { text: S.wiredHelp, img: 'message_lan_1.png' }
      return { text: S.noNetworkHelp }
    case 'wireless': return { text: S.wirelessNetworkHelp, img: 'network_wifi.png' }
  }
}
