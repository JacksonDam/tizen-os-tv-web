import { useEffect, useMemo, useRef, useState } from 'react'
import { useRemote, type RemoteKey } from '../input/remote'
import { PH } from './assets'
import { MENU, type MenuNode } from './menuData'
import { getSetting, setSetting, setTv, useTv, type AmbiMode } from './store'

// The Philips LC08SP on-screen menu: a left-docked blue-gradient "wallpaper" panel with a drill-down
// list, a white glossy highlight bar on the focused row, the PHILIPS logo, a flat-TV illustration on
// the root, and a help line at the bottom. Driven entirely by the firmware menu tree + strings
// (src/philips/menuData.ts). Layout proportions are rebuilt to match the set's look (inferred: the
// exact OSD coordinates were not measured from the firmware).

const AMBI_MODES: AmbiMode[] = ['color', 'relaxed', 'moderate', 'dynamic'] // Ambilight "Mode" item 52

type Level = { node: MenuNode; focus: number }

export function PhilipsMenu({ close }: { close: () => void }) {
  const lang = useTv(s => s.lang)
  const [stack, setStack] = useState<Level[]>([{ node: MENU, focus: 1 }])
  const [toast, setToast] = useState<string | null>(null)

  const level = stack[stack.length - 1]
  const items = level.node.children ?? []
  const focused = items[level.focus]
  const focusRef = useRef<HTMLLIElement>(null)

  // keep the highlighted row visible when a list is longer than the panel
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'nearest' })
  }, [level.focus, stack.length])

  // keep a tiny live copy of the focused item's stored value so the row re-renders on change
  const settingsSig = useTv(s => (focused ? s.settings[focused.id] : undefined))
  void settingsSig

  const setFocus = (f: number) =>
    setStack(s => s.map((l, i) => (i === s.length - 1 ? { ...l, focus: f } : l)))

  const enter = (node: MenuNode) => {
    if (node.children && node.children.length) {
      setStack(s => [...s, { node, focus: 0 }])
    }
  }

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(t => (t === msg ? null : t)), 1600)
  }

  // cycle an option / adjust a slider by `dir` (+1 / -1)
  const adjust = (node: MenuNode, dir: number) => {
    if (node.kind === 'option') {
      // item 17 = menu Language: changes the UI language
      if (node.id === 17) {
        setTv(s => ({ lang: (((s.lang + dir + 3) % 3) as 0 | 1 | 2) }))
        return
      }
      const n = node.options?.length ?? 2
      const cur = getSetting(node.id, 0)
      const next = ((cur + dir) % n + n) % n
      setSetting(node.id, next)
      // item 50 = Ambilight on/off, item 52 = Ambilight mode: drive the live Ambilight
      if (node.id === 50) setTv({ ambilight: next === 0 ? 'off' : 'moderate' })
      if (node.id === 52) setTv({ ambilight: AMBI_MODES[next] ?? 'moderate' })
    } else if (node.kind === 'slider' || node.kind === 'balance') {
      const [lo, hi] = node.range ?? [0, 100]
      const step = (hi - lo) / 20
      const cur = getSetting(node.id, node.kind === 'balance' ? 0 : 50)
      setSetting(node.id, Math.round(Math.max(lo, Math.min(hi, cur + dir * step))))
    }
  }

  useRemote((key: RemoteKey) => {
    switch (key) {
      case 'Up':
        setFocus(Math.max(0, level.focus - 1))
        return true
      case 'Down':
        setFocus(Math.min(items.length - 1, level.focus + 1))
        return true
      case 'Right':
        if (!focused) return true
        if (focused.children?.length) enter(focused)
        else adjust(focused, +1)
        return true
      case 'Left':
        if (focused && (focused.kind === 'slider' || focused.kind === 'balance')) {
          adjust(focused, -1)
          return true
        }
        if (focused && focused.kind === 'option') {
          adjust(focused, -1)
          return true
        }
        if (stack.length > 1) setStack(s => s.slice(0, -1))
        else close()
        return true
      case 'Enter':
        if (!focused) return true
        if (focused.children?.length) enter(focused)
        else if (focused.kind === 'action' || focused.kind === 'demo' || focused.kind === 'locked')
          flash(focused.label[lang])
        else adjust(focused, +1)
        return true
      case 'Back':
      case 'Settings': // MENU again backs out
        if (stack.length > 1) setStack(s => s.slice(0, -1))
        else close()
        return true
      case 'Exit':
        close()
        return true
      default:
        return true // the menu swallows all other keys while open (volume/power handled above it)
    }
  })

  const title = level.node.label[lang]
  const atRoot = stack.length === 1

  return (
    <div className="ph-menu">
      <div className="ph-menu__panel">
        <div className="ph-menu__head">
          <img className="ph-menu__logo" src={`${PH}/img/logo_blue.png`} alt="Philips" />
          <span className="ph-menu__title">{title}</span>
        </div>
        <ul className="ph-menu__list">
          {items.map((it, i) => (
            <MenuRow key={it.id} node={it} lang={lang} focused={i === level.focus} rowRef={i === level.focus ? focusRef : undefined} />
          ))}
        </ul>
      </div>
      {atRoot && (
        <img className="ph-menu__tv" src={`${PH}/img/tv_big.png`} alt="" />
      )}
      <div className="ph-menu__help">{focused?.help?.[lang] ?? ''}</div>
      {toast && <div className="ph-menu__toast">{toast}</div>}
    </div>
  )
}

function MenuRow({ node, lang, focused, rowRef }: { node: MenuNode; lang: 0 | 1 | 2; focused: boolean; rowRef?: React.Ref<HTMLLIElement> }) {
  const value = useValue(node, lang)
  return (
    <li ref={rowRef} className={`ph-row ${focused ? 'ph-row--on' : ''}`}>
      <span className="ph-row__label">{node.label[lang]}</span>
      <span className="ph-row__value">{value}</span>
    </li>
  )
}

// the right-hand value shown on a row: the chosen option, a slider bar, or a chevron for a submenu
function useValue(node: MenuNode, lang: 0 | 1 | 2) {
  const stored = useTv(s => s.settings[node.id])
  return useMemo(() => {
    if (node.children?.length) return '›' // ›
    if (node.id === 17) return ['English', 'Français', 'Español'][lang]
    if (node.kind === 'option') {
      const idx = stored ?? 0
      return node.options?.[idx]?.[lang] ?? ''
    }
    if (node.kind === 'slider' || node.kind === 'balance') {
      const [lo, hi] = node.range ?? [0, 100]
      const v = stored ?? (node.kind === 'balance' ? 0 : 50)
      const pct = ((v - lo) / (hi - lo)) * 100
      return (
        <span className="ph-bar">
          <span className="ph-bar__fill" style={{ width: `${pct}%` }} />
        </span>
      )
    }
    if (node.kind === 'number' || node.kind === 'time' || node.kind === 'text') return '–'
    return '' // action / demo / locked: no inline value
  }, [node, lang, stored])
}
