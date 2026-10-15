import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import './connected-devices.css'
import { TV } from '../../assets'
import { useMoveSound } from '../../tv/sound'
import { SOURCES, switchSource, useTv, type SourceId } from '../../tv/store'
import { Marquee } from '../home/Marquee'

const SRC = `${TV}/com.samsung.tv.coba.setting/SOURCE`
const DEV = `${TV}/sources`

// QLPanel "Connected Devices" (spec/nav-search-sources.md section 3, inputs: spec2/device-sources-home.md
// part B). The input cards come first (TV, then the connected HDMI ports in port order), then the default
// layer (Help, Setup); the grid fills column-major (B.3).

// Card icons (B.5): the TV card swaps i_icon_device_m_tv.svg for the coba.setting live TV icon; an HDMI
// device gets its device-type icon, an undetected port the generic HDMI icon. Same file when focused.
const SOURCE_ICONS: Partial<Record<SourceId, string>> = {
  TV: `${DEV}/source_icon_device_livetv.webp`,
  HDMI1: `${DEV}/i_icon_device_m_gamepad.svg`,     // DeviceType Game
  HDMI2: `${DEV}/i_icon_device_m_cablebox.svg`,    // CEC set-top box (STB)
}
const CHECK = `${TV}/VD_ICONS/i_icon_info_check.svg`

type Card = { id: string; source?: SourceId; title: string; subtitle: string; icon: string; focusedIcon: string }

// Input cards have no subtitle (B.4): the device name (CEC/detected) is the title; a port with nothing
// detected is called "HDMI1" (COM_SID_HDMI1, no space).
const CARDS: Card[] = [
  ...SOURCES.map(s => {
    const icon = SOURCE_ICONS[s.id] ?? `${DEV}/i_icon_device_m_hdmi.svg`
    return { id: s.id, source: s.id, title: s.device ?? (s.id === 'TV' ? s.title : s.id), subtitle: '', icon, focusedIcon: icon }
  }),
  {
    id: 'help', title: 'Help', subtitle: 'Connection Guide',
    icon: `${SRC}/connected_devices_icon_help_normal.webp`, focusedIcon: `${SRC}/connected_devices_icon_help_focused.webp`,
  },
  {
    id: 'setup', title: 'Setup', subtitle: 'Universal Remote',
    icon: `${SRC}/connected_devices_icon_universal_remote_normal.webp`,
    focusedIcon: `${SRC}/connected_devices_icon_universal_remote_focused.webp`,
  },
]

// Fewer than 5 items: 2 rows in a 52x49 u panel; otherwise 3 rows in 52x70 u (B.3). The panel keeps its
// bottom edge at y 960.
const ROWS = CARDS.length < 5 ? 2 : 3
const PANEL_H = CARDS.length < 5 ? 392 : 560
const INPUTS = CARDS.flatMap((c, i) => (c.source ? [i] : []))
const SOURCE_KEY_SELECT_MS = 2000

type Props = {
  visible: boolean     // preview popover (sidebar focus on Connected Devices) or full page
  active: boolean      // focus is inside the grid
  onExitLeft: () => void
  onHome: () => void
  onHideHub: () => void  // Back: not consumed by the panel; csfs lowers the Smart Hub (partial_menu)
  onLaunch: (id: string) => void
}

export function ConnectedDevices({ visible, active, onExitLeft, onHome, onHideHub, onLaunch }: Props) {
  // The current source carries the check (sidebar mode) and takes the focus whenever the grid is entered
  // (B.6); it is reset on leaving too, so entering plays no extra move sound.
  const source = useTv(s => s.source)
  const currentIndex = CARDS.findIndex(c => c.source === source)
  const [focus, setFocus] = useState(Math.max(0, currentIndex))
  const [wasActive, setWasActive] = useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (currentIndex >= 0) setFocus(currentIndex)
  }
  useMoveSound(focus, active)
  // The preview appears 200 ms after the sidebar focus arrives, then fades in over 500 ms;
  // it hides instantly when focus leaves.
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShown(false)
      return
    }
    const t = setTimeout(() => setShown(true), 200)
    return () => clearTimeout(t)
  }, [visible])

  // Source key inside the grid: focus cycles over the input cards and the focused one is selected 2 s
  // after the last press (B.7.5).
  const sourceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!active) clearTimeout(sourceTimer.current)
  }, [active])
  useEffect(() => () => clearTimeout(sourceTimer.current), [])

  const select = (i: number) => {
    clearTimeout(sourceTimer.current)
    const c = CARDS[i]
    if (c.source) switchSource(c.source)
    else onLaunch(c.id)
  }

  useRemote(key => {
    const row = focus % ROWS
    const col = Math.floor(focus / ROWS)
    if (key !== 'Source') clearTimeout(sourceTimer.current)
    switch (key) {
      case 'Up':
        if (row > 0) setFocus(focus - 1)
        return true
      case 'Down':
        if (row < ROWS - 1 && focus + 1 < CARDS.length) setFocus(focus + 1)
        return true
      case 'Left':
        if (col === 0) onExitLeft()
        else setFocus(focus - ROWS)
        return true
      case 'Right':
        if (focus + ROWS < CARDS.length) setFocus(focus + ROWS)
        return true
      case 'Enter':
        select(focus)
        return true
      case 'Source': {
        if (!INPUTS.length) return true
        const next = INPUTS[(INPUTS.indexOf(focus) + 1) % INPUTS.length]
        setFocus(next)
        clearTimeout(sourceTimer.current)
        sourceTimer.current = setTimeout(() => select(next), SOURCE_KEY_SELECT_MS)
        return true
      }
      case 'Home':
        onHome()
        return true
      case 'Back':
        onHideHub()
        return true
      default:
        return false
    }
  }, active)

  return (
    <div className={`cd ${visible && (shown || active) ? 'cd--shown' : ''}`}>
      <div className="cd__panel" style={{ top: 960 - PANEL_H, height: PANEL_H }}>
        {CARDS.map((c, i) => {
          const focused = active && focus === i
          const row = i % ROWS
          const col = Math.floor(i / ROWS)
          return (
            <div
              key={c.id}
              className={`cd__card ${focused ? 'is-focused' : ''} ${c.subtitle ? '' : 'cd__card--title-only'}`}
              style={{ left: 24 + col * 192, top: 24 + row * 168 }}
            >
              <img className="cd__icon" src={focused ? c.focusedIcon : c.icon} alt="" />
              {c.source && c.source === source && <img className="cd__check" src={CHECK} alt="" />}
              <Marquee className="cd__title" text={c.title} run={focused} />
              {c.subtitle && <div className="cd__subtitle">{c.subtitle}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
