import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import './connected-devices.css'
import { TV } from '../../assets'

const SRC = `${TV}/com.samsung.tv.coba.setting/SOURCE`

// QLPanel "Connected Devices" (spec/nav-search-sources.md section 3). On this TV (no tuner, no
// inputs connected) the grid holds two cards, filled column-major into 2 rows.
const CARDS = [
  { id: 'help', title: 'Help', subtitle: 'Connection Guide', icon: 'connected_devices_icon_help' },
  { id: 'setup', title: 'Setup', subtitle: 'Universal Remote', icon: 'connected_devices_icon_universal_remote' },
]

type Props = {
  visible: boolean     // preview popover (sidebar focus on Connected Devices) or full page
  active: boolean      // focus is inside the grid
  onExitLeft: () => void
  onHome: () => void
  onHideHub: () => void  // Back: not consumed by the panel; csfs lowers the Smart Hub (partial_menu)
  onLaunch: (id: string) => void
}

export function ConnectedDevices({ visible, active, onExitLeft, onHome, onHideHub, onLaunch }: Props) {
  const [focus, setFocus] = useState(0)
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

  useRemote(key => {
    const rows = 2
    const row = focus % rows
    const col = Math.floor(focus / rows)
    switch (key) {
      case 'Up':
        if (row > 0) setFocus(focus - 1)
        return true
      case 'Down':
        if (row < rows - 1 && focus + 1 < CARDS.length) setFocus(focus + 1)
        return true
      case 'Left':
        if (col === 0) onExitLeft()
        else setFocus(focus - rows)
        return true
      case 'Right':
        if (focus + rows < CARDS.length) setFocus(focus + rows)
        return true
      case 'Enter':
        onLaunch(CARDS[focus].id)
        return true
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
      <div className="cd__panel">
        {CARDS.map((c, i) => {
          const focused = active && focus === i
          const row = i % 2
          const col = Math.floor(i / 2)
          return (
            <div
              key={c.id}
              className={`cd__card ${focused ? 'is-focused' : ''}`}
              style={{ left: 24 + col * 192, top: 24 + row * 168 }}
            >
              <img className="cd__icon" src={`${SRC}/${c.icon}_${focused ? 'focused' : 'normal'}.webp`} alt="" />
              <div className="cd__title">{c.title}</div>
              <div className="cd__subtitle">{c.subtitle}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
