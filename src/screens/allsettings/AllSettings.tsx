import { useEffect, useMemo, useRef, useState } from 'react'
import { useRemote, isNavKey } from '../../input/remote'
import type { MenuItem } from './menuData'
import { MENU } from './menu'
import { GADGETS, POPUPS, type SettingsHost } from './extensions'
import './all-settings.css'
import { TV } from '../../assets'
import { setSetting, useTv } from '../../tv/store'
import { playFeedback, useMoveSound } from '../../tv/sound'

// All Settings (org.tizen.menu): one blurred 520x696 card at the bottom-left over live TV; sub-pages
// replace its contents (spec/settings.md sections 4, 5.3, 6.6).

const MENU_RES = `${TV}/menu`
const VD = `${TV}/VD_ICONS`

type Props = {
  target?: string        // open directly on a category page (e.g. 'support', 'connection')
  onClose: () => void
  onLaunchApp: (app: string, args?: Record<string, string>, from?: string) => void
}

type Page = { item: MenuItem | null; focus: number } // item null = root page

export function AllSettings({ target, onClose, onLaunchApp }: Props) {
  const initial = useMemo<Page[]>(() => {
    const root: Page = { item: null, focus: 1 } // default focus: the Search field
    const t = target && MENU.find(m => m.id === target)
    return t ? [{ ...root, focus: 2 + MENU.indexOf(t) }, { item: t, focus: 0 }] : [root]
  }, [target])
  const [stack, setStack] = useState<Page[]>(initial)
  const [dir, setDir] = useState<'in' | 'out'>('in')
  const values = useTv(s => s.settings)
  const [picker, setPicker] = useState<{ item: MenuItem; focus: number; rowTop: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [gadget, setGadget] = useState<MenuItem | null>(null)
  const [popup, setPopup] = useState<MenuItem | null>(null)

  const page = stack[stack.length - 1]
  useMoveSound(`${stack.length}:${page.focus}`)
  useMoveSound(picker?.focus, !!picker)
  const valueOf = (m: MenuItem) => values[m.id] ?? m.value
  const setValue = (m: MenuItem, v: string | number) => setSetting(m.id, v)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const setFocus = (f: number) => setStack(s => [...s.slice(0, -1), { ...s[s.length - 1], focus: f }])
  const push = (item: MenuItem) => {
    // an option page opens with focus on the current value
    const cur = valueOf(item)
    const at = (item.groups ?? []).flat().findIndex(r => r.style === 'option' && (r.value ?? r.id) === cur)
    setDir('in')
    setStack(s => [...s, { item, focus: Math.max(0, at) }])
  }
  const pop = () => {
    if (stack.length === 1) return onClose()
    playFeedback('back')
    setDir('out')
    setStack(s => s.slice(0, -1))
  }

  // Rows of the current page, flattened (root: account, search, categories).
  const rows: MenuItem[] = page.item ? (page.item.groups ?? []).flat() : MENU

  useRemote(key => {
    if (!isNavKey(key)) return false // TV keys go on to tv-viewer
    // a gadget or popup above takes the keys; anything it passes down stops here (Home closes Settings)
    if (gadget || popup) {
      if (key === 'Home' || key === 'Exit') {
        onClose()
        return false
      }
      return true
    }
    if (toast && key !== 'Back') setToast(null)
    if (picker) {
      const opts = picker.item.options ?? []
      if (key === 'Up' || key === 'Down') {
        const f = key === 'Up' ? Math.max(0, picker.focus - 1) : Math.min(opts.length - 1, picker.focus + 1)
        setPicker({ ...picker, focus: f })
        // Sound Feedback applies the level as focus moves in its picker
        if (picker.item.id === 'sound-feedback') setValue(picker.item, opts[f].value)
      }
      else if (key === 'Enter') {
        setValue(picker.item, opts[picker.focus].value)
        setPicker(null)
      } else if (key === 'Back') setPicker(null)
      return true
    }
    if (key === 'Back') {
      pop()
      return true
    }
    if (key === 'Home' || key === 'Exit') {
      onClose()
      return false // let the Home key reach the TV (Smart Hub)
    }
    if (!page.item) {
      // root: 0 = account card, 1 = search field, 2.. = categories
      const last = 1 + MENU.length
      if (key === 'Up') setFocus(Math.max(0, page.focus - 1))
      else if (key === 'Down') setFocus(Math.min(last, page.focus + 1))
      else if (key === 'Enter' && page.focus >= 2) push(MENU[page.focus - 2])
      return true
    }
    // sub-page: -1 = back button
    if (page.focus === -1) {
      if (key === 'Down') setFocus(0)
      else if (key === 'Enter') pop()
      return true
    }
    const row = rows[page.focus]
    if (key === 'Up') setFocus(page.focus - 1)
    else if (key === 'Down') setFocus(Math.min(rows.length - 1, page.focus + 1))
    else if ((key === 'Left' || key === 'Right') && row.style === 'title.slider.value') {
      const v = Number(valueOf(row) ?? 0) + (key === 'Left' ? -1 : 1) * (row.step ?? 1)
      if (v >= (row.min ?? 0) && v <= (row.max ?? 100)) {
        setValue(row, v)
        playFeedback('move')
      }
    } else if (key === 'Enter') {
      if (row.disabled) setToast(row.disabledReason ?? "This function isn't available.")
      else if (row.style === 'title.switch') setValue(row, Number(valueOf(row) ?? 0) ? 0 : 1)
      else if (row.style === 'option') {
        // options on an option page set the parent's value
        const parent = page.item
        if (parent) setValue(parent, row.value ?? row.id)
      } else if (row.picker && row.options?.length) {
        const cur = row.options.findIndex(o => o.value === valueOf(row))
        setPicker({ item: row, focus: Math.max(0, cur), rowTop: rowTops[page.focus] - scroll })
      } else if (row.launch) {
        onLaunchApp(row.launch.app, row.launch.args, stack[1]?.item?.id)
      } else if (row.popup && POPUPS[row.popup]) setPopup(row)
      else if (row.gadget && GADGETS[row.gadget]) setGadget(row)
      else if (row.groups?.length) push(row)
    }
    return true
  })

  // ---- layout of the sub-page list (panel-relative y, before scrolling) ----
  const { rowTops, rowHeights, groupBoxes, contentHeight } = useMemo(() => layoutGroups(page.item), [page.item])
  const viewport = 584 // y 88..672 inside the panel
  const scroll = useScroll(page, rowTops, rowHeights, viewport, contentHeight)

  const optionPageValue = page.item ? valueOf(page.item) : undefined

  const host: SettingsHost = { launchApp: (app, args) => onLaunchApp(app, args, stack[1]?.item?.id), close: onClose }
  const G = gadget ? GADGETS[gadget.gadget!] : null
  const P = popup ? POPUPS[popup.popup!] : null

  return (
    <div className="as">
      <div className="as__panel" style={{ width: G ? G.width : 520 }}>
        {G && gadget ? (
          <div key={`gadget-${gadget.id}`} className="as__page as__page--in">
            <G.component host={host} item={gadget} active={!popup} onClose={() => setGadget(null)} />
          </div>
        ) : (
        <div key={stack.length + (page.item?.id ?? 'root')} className={`as__page as__page--${dir}`}>
          {!page.item ? (
            <RootPage focus={page.focus} />
          ) : (
            <>
              <div className="as__top">
                <div className={`as__back ${page.focus === -1 ? 'is-focused' : ''}`}>
                  <span className="as__back-icon" />
                </div>
                <div className="as__title">{page.item.title}</div>
              </div>
              <div className="as__viewport">
                <div className="as__list" style={{ transform: `translateY(${-scroll}px)` }}>
                  {groupBoxes.map((g, i) => (
                    <div key={i} className="as__group" style={{ top: g.top, height: g.height }} />
                  ))}
                  {rows.map((r, i) => (
                    <Row
                      key={r.id + i}
                      item={r}
                      top={rowTops[i]}
                      focused={page.focus === i && !picker}
                      value={valueOf(r)}
                      selected={r.style === 'option' && optionPageValue !== undefined && (r.value ?? r.id) === optionPageValue}
                      divider={i > 0 && rowTops[i] - rowTops[i - 1] === rowHeights[i - 1] + 8}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        )}
        {picker && <Picker picker={picker} value={valueOf(picker.item)} />}
        {P && <div className="as__dim" />}
      </div>
      {P && popup && <P host={host} item={popup} onClose={() => setPopup(null)} />}
      {toast && <div className="as__toast">{toast}</div>}
    </div>
  )
}

// ---- root page: account card, search field, categories ----

function RootPage({ focus }: { focus: number }) {
  // Focusing the account/search group shows the top; a category scrolls the header away (208 px)
  // so all six categories fill the 624 px viewport.
  const scroll = focus >= 2 ? 208 : 0
  return (
    <div className="as-root">
      <div className="as-root__list" style={{ transform: `translateY(${-scroll}px)` }}>
        <div className={`as-account ${focus === 0 ? 'is-focused' : ''}`}>
          <div className="as-account__text">
            <div className="as-account__title">Sign in</div>
            <div className="as-account__sub">Samsung account</div>
          </div>
          <img className="as-account__avatar" src={`${VD}/i_icon_thumbnailinfo_account.svg`} alt="" />
        </div>
        <div className={`as-search ${focus === 1 ? 'is-focused' : ''}`}>
          <span className="as-search__icon" />
          <span className="as-search__hint">Search</span>
        </div>
        {MENU.map((c, i) => {
          const focused = focus === i + 2
          // the focused category previews the first item of its first two groups
          const preview = (c.groups ?? [])
            .slice(0, 2)
            .map(g => g[0]?.title)
            .filter(Boolean)
            .join(', ')
          return (
            <div key={c.id} className={`as-category ${focused ? 'is-focused' : ''}`}>
              {c.icon && <img className="as-category__icon" src={`${MENU_RES}/menu_icon/${c.icon}`} alt="" />}
              <div className="as-category__text">
                <div className="as-category__title">{c.title}</div>
                {focused && preview && <div className="as-category__preview">{preview}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- rows ----

const ROW_HEIGHT: Record<string, number> = {
  'title': 80,
  'title.value': 112,
  'title.switch': 80,
  'title.slider.value': 112,
  'option': 80,
  'title.icon': 80,
  'button': 80,
  'category': 104,
}

function rowHeight(m: MenuItem) {
  if (m.picker || (m.style === 'title.value')) return 112
  return ROW_HEIGHT[m.style] ?? 80
}

function layoutGroups(item: MenuItem | null) {
  const rowTops: number[] = []
  const rowHeights: number[] = []
  const groupBoxes: { top: number; height: number }[] = []
  let y = 8 // the group background starts 8 px above its first row
  for (const g of item?.groups ?? []) {
    const gTop = y - 8
    g.forEach((r, i) => {
      if (i > 0) y += 8 // divider slot
      rowTops.push(y)
      rowHeights.push(rowHeight(r))
      y += rowHeight(r)
    })
    groupBoxes.push({ top: gTop, height: y - gTop })
    y += 16 // 8 px between groups + 8 px lead-in of the next group
  }
  return { rowTops, rowHeights, groupBoxes, contentHeight: y }
}

// Keep the focused row fully visible (the list scrolls with ~1000 ms ease).
function useScroll(page: Page, tops: number[], heights: number[], viewport: number, content: number) {
  const scroll = useRef(0)
  const f = page.focus
  if (f <= 0) scroll.current = 0
  else if (f < tops.length) {
    const top = tops[f] - 8
    const bottom = tops[f] + heights[f] + 8
    if (top < scroll.current) scroll.current = top
    else if (bottom > scroll.current + viewport) scroll.current = Math.min(bottom - viewport, Math.max(0, content - viewport))
  }
  return scroll.current
}

function Row({
  item,
  top,
  focused,
  value,
  selected,
  divider,
}: {
  item: MenuItem
  top: number
  focused: boolean
  value: string | number | undefined
  selected: boolean
  divider: boolean
}) {
  const valueText =
    item.options?.find(o => o.value === value)?.label ?? item.valueText ?? (value !== undefined && item.style !== 'title.switch' ? String(value) : '')
  const cls = ['as-row', focused ? 'is-focused' : '', item.disabled ? 'is-disabled' : '', divider ? 'has-divider' : ''].join(' ')
  const style = { top, height: rowHeight(item) }

  if (item.style === 'title.slider.value') {
    const min = item.min ?? 0
    const max = item.max ?? 100
    const pct = ((Number(value ?? min) - min) / (max - min)) * 100
    return (
      <div className={`${cls} as-row--slider`} style={style}>
        <div className="as-row__title">{item.title}</div>
        <div className="as-slider">
          <span className="as-slider__value">{item.format === 'tint' ? tintText(Number(value), max) : value}</span>
          <span className="as-slider__track">
            <span className="as-slider__fill" style={{ width: `${pct}%` }} />
            <span className="as-slider__handle" style={{ left: `${pct}%` }} />
          </span>
        </div>
      </div>
    )
  }
  const twoLine = rowHeight(item) === 112
  return (
    <div className={cls} style={style}>
      <div className="as-row__text">
        <div className="as-row__title">{item.title}</div>
        {twoLine && <div className="as-row__value">{valueText}</div>}
      </div>
      {item.style === 'title.switch' && <span className={`flux-switch ${Number(value) ? 'is-on' : ''}`} />}
      {item.picker && <span className="as-row__arrow" />}
      {item.style === 'option' && selected && <img className="as-row__check" src={`${MENU_RES}/res/check.svg`} alt="" />}
    </div>
  )
}

// ---- dropdown picker (P_ListOption_02) ----

function Picker({ picker, value }: { picker: { item: MenuItem; focus: number; rowTop: number }; value: unknown }) {
  const opts = picker.item.options ?? []
  const visible = Math.min(opts.length, 4)
  const height = [0, 136, 216, 296, 312][visible]
  // vertically centred on the row (panel-relative: list starts at y 88), kept inside the panel
  const centre = 88 + picker.rowTop + 56
  const top = Math.max(24, Math.min(696 - 24 - height, centre - height / 2))
  return (
    <div className="as-picker" style={{ top, height }}>
      {opts.map((o, i) => (
        <div key={String(o.value)} className={`as-picker__row ${i === picker.focus ? 'is-focused' : ''}`}>
          <span>{o.label}</span>
          {o.value === value && <img className="as-picker__check" src={`${VD}/i_icon_info_check.svg`} alt="" />}
        </div>
      ))}
    </div>
  )
}

// Tint (G/R): "G<n>" below the middle, "0/0" at it, "R<n>" above (BrightnessGadget Util.GetValueText).
function tintText(v: number, max: number) {
  const mid = max / 2
  if (v < mid) return `G${mid - v}`
  if (v > mid) return `R${v - mid}`
  return '0/0'
}
