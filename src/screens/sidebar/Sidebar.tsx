import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import './sidebar.css'
import { TV } from '../../assets'
import { useMoveSound } from '../../tv/sound'

const NH = `${TV}/com.samsung.tv.coba.newhome`
const ST = `${TV}/com.samsung.tv.coba.setting`

// Sidebar items on a signed-out TV with the Smart Hub terms not agreed (spec/nav-search-sources.md 1.2-1.3).
// Group 0: category tiles (352x80); group 1: system tiles (352x72) behind the collapsed gear.
export type SidebarItem = 'search' | 'home' | 'devices' | 'settings'
const ITEMS: { id: SidebarItem; label: string; kind: 'category' | 'system'; y: number }[] = [
  { id: 'search', label: 'Search', kind: 'category', y: 144 },
  { id: 'home', label: 'Home', kind: 'category', y: 224 },
  { id: 'devices', label: 'Connected Devices', kind: 'system', y: 776 },
  { id: 'settings', label: 'Settings', kind: 'system', y: 848 },
]

type Props = {
  open: boolean
  hidden?: boolean            // a system page took over: the sidebar root fades out (200-450 ms)
  focusOnOpen?: SidebarItem   // Home from the page; Connected Devices when coming back from its page
  onClose: () => void
  onFocusItem?: (id: SidebarItem) => void
  onEnterSystem?: (id: SidebarItem) => void
  onSearch?: () => void
}

export function Sidebar({ open, hidden, focusOnOpen = 'home', onClose, onFocusItem, onEnterSystem, onSearch }: Props) {
  const [focus, setFocus] = useState<SidebarItem>(focusOnOpen)
  // The focused item's white plate and black label pop in when the 500 ms open animation ends.
  const [settled, setSettled] = useState(false)
  useMoveSound(`${open}:${focus}`, open) // focus landing on an item when the sidebar opens also plays

  useEffect(() => {
    if (!open) {
      setSettled(false)
      return
    }
    setFocus(focusOnOpen)
    const t = setTimeout(() => setSettled(true), 500)
    return () => clearTimeout(t)
  }, [open, focusOnOpen])

  useEffect(() => {
    if (open) onFocusItem?.(focus)
  }, [open, focus, onFocusItem])

  useRemote(key => {
    const i = ITEMS.findIndex(it => it.id === focus)
    const item = ITEMS[i]
    switch (key) {
      case 'Up':
        if (i > 0) setFocus(ITEMS[i - 1].id)
        return true
      case 'Down':
        if (i < ITEMS.length - 1) setFocus(ITEMS[i + 1].id)
        return true
      case 'Left':
        return true
      case 'Right':
      case 'Enter':
        if (item.kind === 'system') onEnterSystem?.(item.id)
        else if (key === 'Enter' && item.id === 'search') onSearch?.()
        else onClose()
        return true
      case 'Back':
      case 'Home':
        onClose()
        return true
      default:
        return false
    }
  }, open)

  return (
    <nav className={`sb ${open ? 'sb--open' : ''} ${hidden ? 'sb--hidden' : ''}`}>
      <div className="sb__strip">
        <div className="sb__panel" />
        <div className="sb__ray" />
      </div>
      <img className="sb__fold" src={`${NH}/home_i_bg_sidebar_home_closed_2k.webp`} alt="" />

      {ITEMS.map(it => {
        const focused = open && settled && focus === it.id
        return (
          <div
            key={it.id}
            className={`sb__tile sb__tile--${it.kind} ${focused ? 'is-focused' : ''}`}
            style={{ top: it.y }}
          >
            <div className="sb__tile-body">
              {it.id === 'home' ? (
                <img className="sb__icon" src={`${NH}/home_i_icon_mode_home_selected.svg`} alt="" />
              ) : (
                <span
                  className="sb__icon sb__icon--mask"
                  style={{ maskImage: `url(${iconUrl(it.id)})`, WebkitMaskImage: `url(${iconUrl(it.id)})` }}
                />
              )}
              <span className="sb__label">{it.label}</span>
            </div>
          </div>
        )
      })}

      {/* Collapsed state: the system tiles fold into a single gear (CompositeTileView). */}
      <span
        className="sb__gear"
        style={{ maskImage: `url(${iconUrl('settings')})`, WebkitMaskImage: `url(${iconUrl('settings')})` }}
      />
    </nav>
  )
}

function iconUrl(id: SidebarItem) {
  switch (id) {
    case 'search':
      return `${NH}/home_i_icon_mode_search.svg`
    case 'devices':
      return `${ST}/HOME/home_i_icon_system_connected.svg`
    default:
      return `${ST}/home_i_icon_system_settings.svg`
  }
}
