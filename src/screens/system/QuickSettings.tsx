import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { Lottie } from '../../components/Lottie'
import { BRIGHTNESS_ROWS, TILES, type SecondDepthRow, type Tile } from './quickSettingsData'
import './quick-settings.css'
import { TV } from '../../assets'

// QLPanel Quick Settings (spec/settings.md sections 3, 5.1, 6.2-6.5): a blurred 416x560 card with a
// 2x3 tile grid per page, level-2 lists, the Brightness gadget and edit mode.

const PER_PAGE = 6
const FOCUS_RANGE: [number, number] = [1, 60]

type Level = 'l1' | 'l2' | 'gadget'

type Props = {
  visible: boolean      // preview next to the sidebar, or entered
  active: boolean       // focus is inside the panel
  onExitLeft: () => void
  onHome: () => void
  onHideHub: () => void
  onLaunch: (target: 'allsettings' | 'support' | 'network') => void
}

export function QuickSettings({ visible, active, onExitLeft, onHome, onHideHub, onLaunch }: Props) {
  const [shown, setShown] = useState(false)
  const [order, setOrder] = useState(TILES.map(t => t.id))
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(TILES.filter(t => t.values).map(t => [t.id, t.value ?? 0])),
  )
  const [focus, setFocus] = useState<number | 'noti'>(0)
  const [level, setLevel] = useState<Level>('l1')
  const [openTile, setOpenTile] = useState<Tile | null>(null)

  // edit mode: `moving` is the tile picked up with OK; `focus === 'done'` is the Done button
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [editFocusDone, setEditFocusDone] = useState(false)
  const savedOrder = useRef(order)

  // Preview: 200 ms timer, then a 500 ms fade (QLPanelView executeShowPanel). Hidden instantly.
  useEffect(() => {
    if (!visible) {
      setShown(false)
      setFocus(0)
      setLevel('l1')
      return
    }
    const t = setTimeout(() => setShown(true), 200)
    return () => clearTimeout(t)
  }, [visible])

  const tiles = order.filter(id => !(editing && id === 'edit')).map(id => TILES.find(t => t.id === id)!)
  const n = tiles.length
  const index = typeof focus === 'number' ? Math.min(focus, n - 1) : 0
  const page = Math.floor(index / PER_PAGE)
  const pages = Math.ceil(n / PER_PAGE)

  const select = (tile: Tile) => {
    switch (tile.action) {
      case 'toggle':
        setValues(v => ({ ...v, [tile.id]: (v[tile.id] + 1) % tile.values!.length }))
        break
      case 'second':
        setOpenTile(tile)
        setLevel('l2')
        break
      case 'gadget':
        setOpenTile(tile)
        setLevel('gadget')
        break
      case 'launch':
        onLaunch(tile.id === 'support' ? 'support' : 'allsettings')
        break
      case 'edit':
        savedOrder.current = order
        setEditing(true)
        setFocus(n - 2) // the Edit tile is removed; focus the last real tile
        break
    }
  }

  const moveTile = (from: number, to: number) => {
    if (to < 0 || to >= n) return
    const ids = tiles.map(t => t.id)
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    setOrder(editing ? [...ids, 'edit'] : ids)
    setFocus(to)
  }

  const gridKey = (key: string) => {
    const i = index
    const row = i % 3
    const target = (() => {
      switch (key) {
        case 'Up': return row > 0 ? i - 1 : -1
        case 'Down': return row < 2 && i + 1 < n ? i + 1 : -2
        case 'Left': return i - 3 >= 0 ? i - 3 : -3
        case 'Right':
          if (i + 3 < n) return i + 3
          return Math.floor((n - 1) / 3) > Math.floor(i / 3) ? n - 1 : i
        default: return i
      }
    })()
    return target
  }

  useRemote(key => {
    if (level === 'l1' && !editing) {
      if (focus === 'noti') {
        if (key === 'Down') setFocus(index)
        else if (key === 'Left') onExitLeft()
        else if (key === 'Home') onHome()
        else if (key === 'Back') onHideHub()
        return true
      }
      if (key === 'Enter') select(tiles[index])
      else if (key === 'Back') onHideHub()
      else if (key === 'Home') onHome()
      else {
        const t = gridKey(key)
        if (t === -1) setFocus('noti')
        else if (t === -3) onExitLeft()
        else if (t >= 0) setFocus(t)
      }
      return true
    }
    if (editing) {
      if (editFocusDone) {
        if (key === 'Up') setEditFocusDone(false)
        else if (key === 'Enter') leaveEdit(true)
        else if (key === 'Back') leaveEdit(false)
        return true
      }
      if (key === 'Enter') setMoving(m => !m)
      else if (key === 'Back') {
        if (moving) setMoving(false)
        else leaveEdit(false)
      } else {
        const t = gridKey(key)
        if (t === -2 && !moving) setEditFocusDone(true)
        else if (t >= 0) {
          if (moving) moveTile(index, t)
          else setFocus(t)
        }
      }
      return true
    }
    return false // level 2 and the gadget handle their own keys
  }, active)

  const leaveEdit = (save: boolean) => {
    if (!save) setOrder(savedOrder.current)
    setEditing(false)
    setMoving(false)
    setEditFocusDone(false)
    setFocus(save ? page * PER_PAGE : n) // Done: first tile of the page; Back: the last tile
  }

  const backToL1 = () => {
    setLevel('l1')
    setOpenTile(null)
  }

  const valueOf = (t: Tile) => (t.values ? t.values[values[t.id]] : undefined)

  return (
    <div className={`qs ${visible && (shown || active) ? 'qs--shown' : ''} ${editing ? 'qs--editing' : ''}`}>
      {/* Notification button, 2 u above the panel (VPMenuTopPreview) */}
      <div
        className={`flux-btn qs__noti ${active && focus === 'noti' && level === 'l1' ? 'is-focused' : ''} ${
          level !== 'l1' || editing ? 'is-hidden' : ''
        }`}
      >
        <span className="qs__noti-icon" />
        <span>Notification</span>
      </div>

      <div className="qs__panel">
        <div className={`qs__l1 ${level === 'l1' ? 'is-current' : 'is-away'}`}>
          <div className="qs__viewport">
            <div className="qs__pages" style={{ transform: `translateX(${-page * 400}px)` }}>
              {tiles.map((t, i) => {
                const v = valueOf(t)
                const focused = active && level === 'l1' && focus === i && !editFocusDone
                const subtitle = v?.label ?? t.subtitle ?? ''
                const off = subtitle === 'Off'
                const iconUrl = v?.icon ?? (focused && t.iconFocused ? t.iconFocused : t.icon!)
                const dots = t.values && t.values.length > 1 ? Math.min(t.values.length, 5) : 0
                const p = Math.floor(i / PER_PAGE)
                return (
                  <div
                    key={t.id}
                    className={[
                      'qs-tile',
                      focused ? 'is-focused' : '',
                      t.colouredIcon ? 'qs-tile--coloured' : '',
                      editing && focused && moving ? 'is-moving' : '',
                      off ? 'is-off' : '',
                    ].join(' ')}
                    style={{ left: p * 400 + Math.floor((i % PER_PAGE) / 3) * 200, top: (i % 3) * 168 }}
                  >
                    <div className="qs-tile__plate">
                      {iconUrl.endsWith('.json') ? (
                        <Lottie
                          className={`qs-tile__icon ${dots ? 'qs-tile__icon--dots' : ''}`}
                          src={iconUrl}
                          playing={focused}
                          range={FOCUS_RANGE}
                        />
                      ) : (
                        <img className={`qs-tile__icon ${dots ? 'qs-tile__icon--dots' : ''}`} src={iconUrl} alt="" />
                      )}
                      {dots > 0 && (
                        <div className="qs-tile__dots">
                          {Array.from({ length: dots }, (_, d) => (
                            <span key={d} className={d === values[t.id] % dots ? 'is-current' : ''} />
                          ))}
                        </div>
                      )}
                    </div>
                    {t.title ? (
                      <>
                        <div className="qs-tile__title">{t.title}</div>
                        <div className="qs-tile__subtitle">{subtitle}</div>
                      </>
                    ) : (
                      <div className="qs-tile__title">{subtitle}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {pages > 1 && !editing && (
            <div className="qs__pagination">
              {Array.from({ length: pages }, (_, p) => (
                <span key={p} className={p === page ? 'is-current' : ''} />
              ))}
            </div>
          )}
          {editing && (
            <div className="qs__done-row">
              <div className={`flux-btn qs__done ${editFocusDone ? 'is-focused' : ''}`}>Done</div>
            </div>
          )}
        </div>

        {level === 'l2' && openTile?.second && (
          <SecondDepth
            title={openTile.second.title}
            groups={openTile.second.groups}
            active={active}
            onBack={backToL1}
            onHome={onHome}
            onMenu={label => label === 'Network Settings' && onLaunch('network')}
          />
        )}
        {level === 'gadget' && <BrightnessGadget active={active} title={openTile?.title ?? ''} onBack={backToL1} onHome={onHome} />}
      </div>

      {editing && (
        <div className="qs__toast">Select the menu to move and arrange in your preferred order.</div>
      )}
    </div>
  )
}

// ---- Level 2: VPSecondDepthLayout (back arrow + title, grouped 344x80 rows) ----

function SecondDepth({
  title,
  groups,
  active,
  onBack,
  onHome,
  onMenu,
}: {
  title: string
  groups: SecondDepthRow[][]
  active: boolean
  onBack: () => void
  onHome: () => void
  onMenu: (label: string) => void
}) {
  const [rows, setRows] = useState(groups)
  const flat = rows.flat()
  const initial = Math.max(
    0,
    flat.findIndex(r => r.kind === 'switch' || (r.kind === 'option' && r.selected)),
  )
  const [focus, setFocus] = useState<number | 'back'>(initial)
  const busy = useRef(false)

  useRemote(key => {
    if (busy.current) return true
    if (key === 'Back') onBack()
    else if (key === 'Home') onHome()
    else if (focus === 'back') {
      if (key === 'Down') setFocus(0)
      else if (key === 'Enter') onBack()
    } else if (key === 'Up') setFocus(focus === 0 ? 'back' : focus - 1)
    else if (key === 'Down') setFocus(Math.min(flat.length - 1, focus + 1))
    else if (key === 'Enter') {
      const row = flat[focus]
      if (row.kind === 'switch') {
        setRows(rows.map(g => g.map(r => (r === row ? { ...r, on: !r.on } : r))))
      } else if (row.kind === 'option') {
        setRows(rows.map(g => g.map(r => (r.kind === 'option' ? { ...r, selected: r === row } : r))))
        busy.current = true
        setTimeout(onBack, 750) // apply, then return to level 1
      } else onMenu(row.label)
    }
    return true // Left/Right are swallowed so they cannot reach the sidebar
  }, active)

  let k = -1
  return (
    <div className="qs-l2">
      <div className="qs-l2__top">
        <div className={`qs-back ${focus === 'back' && active ? 'is-focused' : ''}`}>
          <span className="qs-back__icon" />
        </div>
        <div className="qs-l2__title">{title}</div>
      </div>
      <div className="qs-l2__list">
        {rows.map((g, gi) => (
          <div key={gi} className="qs-l2__group">
            {g.map(r => {
              k++
              const focused = active && focus === k
              return (
                <div key={r.label} className={`qs-row ${focused ? 'is-focused' : ''}`}>
                  <span className="qs-row__text">{r.label}</span>
                  {r.kind === 'option' && r.selected && <img className="qs-row__check" src={`${TV}/VD_ICONS/i_icon_info_check.svg`} alt="" />}
                  {r.kind === 'switch' && <span className={`flux-switch ${r.on ? 'is-on' : ''}`} />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Brightness gadget (org.tizen.appfw.gadget.BrightnessGadget) ----

function BrightnessGadget({
  active,
  title,
  onBack,
  onHome,
}: {
  active: boolean
  title: string
  onBack: () => void
  onHome: () => void
}) {
  const [vals, setVals] = useState(BRIGHTNESS_ROWS.map(r => r.value))
  const [focus, setFocus] = useState<number | 'back'>(0)
  // The 5 rows are taller than the 456 px viewport: keep the focused row (plus 8 px) visible.
  const list = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  useLayoutEffect(() => {
    const row = list.current?.children[focus === 'back' ? 0 : focus] as HTMLElement | undefined
    if (!row) return
    const viewport = 456
    setScroll(s => {
      const top = row.offsetTop - 8
      const bottom = row.offsetTop + row.offsetHeight + 8
      if (focus === 'back' || top < s) return Math.max(0, top)
      if (bottom > s + viewport) return bottom - viewport
      return s
    })
  }, [focus])

  useRemote(key => {
    if (key === 'Back') onBack()
    else if (key === 'Home') onHome()
    else if (focus === 'back') {
      if (key === 'Down') setFocus(0)
      else if (key === 'Enter') onBack()
    } else if (key === 'Up') setFocus(focus === 0 ? 'back' : focus - 1)
    else if (key === 'Down') setFocus(Math.min(BRIGHTNESS_ROWS.length - 1, focus + 1))
    else if (key === 'Left' || key === 'Right') {
      const r = BRIGHTNESS_ROWS[focus]
      const d = key === 'Left' ? -1 : 1
      setVals(v => v.map((x, i) => (i === focus ? Math.max(r.min, Math.min(r.max, x + d)) : x)))
    }
    return true
  }, active)

  return (
    <div className="qs-gadget">
      <div className="qs-gadget__top">
        <div className={`qs-back ${focus === 'back' && active ? 'is-focused' : ''}`}>
          <span className="qs-back__icon" />
        </div>
        <div className="qs-gadget__title">{title}</div>
      </div>
      <div className="qs-gadget__viewport">
      <div ref={list} className="qs-l2__group qs-gadget__list" style={{ transform: `translateY(${-scroll}px)` }}>
        {BRIGHTNESS_ROWS.map((r, i) => {
          const focused = active && focus === i
          const pct = ((vals[i] - r.min) / (r.max - r.min)) * 100
          return (
            <div key={r.id} className={`qs-row qs-row--slider ${focused ? 'is-focused' : ''}`}>
              <span className="qs-row__text">{r.label}</span>
              <div className="qs-slider">
                <span className="qs-slider__value">{r.format ? r.format(vals[i]) : vals[i]}</span>
                <span className="qs-slider__track">
                  <span className="qs-slider__fill" style={{ width: `${pct}%` }} />
                  <span className="qs-slider__handle" style={{ left: `${pct}%` }} />
                </span>
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
