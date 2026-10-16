import { useState, type ReactNode } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { useTv } from '../../tv/store'
import type { GadgetProps } from '../allsettings/extensions'
import { getMenu } from '../allsettings/menu'
import type { MenuItem } from '../allsettings/menuData'
import { Keyboard, InputText } from '../../components/keyboard/Keyboard'
import { useTextEntry } from '../../components/keyboard/textEntry'

// All Settings > Search (org.tizen.menu SearchPage / SearchView / SearchManager): the search field in a
// 65x10 u area, the keyboard next to the panel ("action=dynamic_ui&entrylimit=30&action=search", placed
// at the panel's right edge, bottom at the panel bottom: SearchInputField.GetShowIMEInfo), results
// updated as you type: every row whose name contains the keyword (DBSQL: DisplayName like '%kw%'),
// grouped by category in menu order, the keyword in CC_Point3100 (CommonUIData.SetCustomColor).
// OK on a result opens its page with the row focused. spec3/connections.md 1.6.

type Hit = { item: MenuItem; path: string[]; category: string }

function searchMenu(keyword: string): Hit[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []
  const hits: Hit[] = []
  const walk = (items: MenuItem[], path: string[], category: string) => {
    for (const it of items) {
      if (it.style === 'option') continue
      const p = [...path, it.id]
      if (it.title.toLowerCase().includes(kw)) hits.push({ item: it, path: p, category })
      if (it.groups && !it.picker) walk(it.groups.flat(), p, category)
    }
  }
  for (const cat of getMenu()) walk((cat.groups ?? []).flat(), [cat.id], cat.title)
  return hits
}

function marked(text: string, keyword: string): ReactNode {
  const kw = keyword.trim()
  if (!kw) return text
  const out: ReactNode[] = []
  const low = text.toLowerCase()
  let at = 0
  for (let i = low.indexOf(kw.toLowerCase()); i >= 0; i = low.indexOf(kw.toLowerCase(), at)) {
    out.push(text.slice(at, i), <span key={i} className="ss-mark">{text.slice(i, i + kw.length)}</span>)
    at = i + kw.length
  }
  out.push(text.slice(at))
  return out
}

const ROW_H = 112
const CAT_H = 48

export function SettingsSearch({ host, active, onClose }: GadgetProps) {
  const entry = useTextEntry('', 30)
  const [typing, setTyping] = useState(true) // the keyboard opens with the page
  const [f, setF] = useState(0)              // -1 back, 0 field, 1.. results
  const values = useTv(s => s.settings)
  useMoveSound(f)
  const hits = searchMenu(entry.text)
  const valueText = (m: MenuItem) => {
    const v = values[m.id] ?? m.value
    if (m.style === 'title.switch') return Number(v) ? 'On' : 'Off'
    return m.options?.find(o => o.value === v)?.label ?? m.valueText ?? (m.style.includes('value') && v !== undefined ? String(v) : '')
  }

  // results grouped by category (category title rows are not focusable)
  const rows: ({ cat: string } | { hit: Hit })[] = []
  for (const h of hits) {
    const last = rows[rows.length - 1]
    if (!last || !('hit' in last) || last.hit.category !== h.category) rows.push({ cat: h.category })
    rows.push({ hit: h })
  }
  // VPSearchTitleValueTile (two lines) for rows with a value, VPSearchTitleTile (one line) otherwise
  const heightOf = (r: (typeof rows)[number]) => ('cat' in r ? CAT_H : valueText(r.hit.item) ? ROW_H : 80)
  const tops: number[] = []
  let y = 0
  for (const r of rows) {
    tops.push(y)
    y += heightOf(r) + ('cat' in r ? 0 : 8)
  }
  const hitRows = rows.flatMap((r, i) => ('hit' in r ? [i] : []))
  const viewH = 696 - 184 - 24
  const focusedRow = f >= 1 ? hitRows[f - 1] : -1
  const scroll = focusedRow >= 0 ? Math.max(0, Math.min(y - viewH, tops[focusedRow] + heightOf(rows[focusedRow]) + 8 - viewH)) : 0

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false
    if (key === 'Back') {
      playFeedback('back')
      if (f >= 1) setF(0)
      else onClose()
    } else if (key === 'Up') setF(x => Math.max(-1, x - 1))
    else if (key === 'Down') setF(x => Math.min(hits.length, x + 1))
    else if (key === 'Enter') {
      if (f === -1) onClose()
      else if (f === 0) setTyping(true)
      else host.openPath?.(hits[f - 1].path)
    }
    return true
  }, active && !typing)

  return (
    <div className="net">
      <div className="as__top">
        <div className={`as__back ${f === -1 && !typing ? 'is-focused' : ''}`}>
          <span className="as__back-icon" />
        </div>
        <div className="as__title">Search</div>
      </div>
      <div className={`ss-field ${typing || f === 0 ? 'is-focused' : ''}`}>
        <span className="ss-field__icon" />
        <InputText entry={entry} hint="Search" editing={typing} />
      </div>
      {!hits.length ? (
        <div className="ss-hint">
          {entry.text.trim() ? `No search result for ${entry.text.trim()}.` : 'Enter search keyword.'}
        </div>
      ) : (
        <div className="ss-results">
          <div className="ss-results__scroll" style={{ transform: `translateY(${-scroll}px)` }}>
            {rows.map((r, i) =>
              'cat' in r ? (
                <div key={`c${i}`} className="ss-cat" style={{ top: tops[i] }}>{r.cat}</div>
              ) : (
                <div
                  key={r.hit.path.join('/')}
                  className={`net-item ss-row ${focusedRow === i && !typing ? 'is-focused' : ''}`}
                  style={{ top: tops[i], height: heightOf(r) }}
                >
                  <span className="net-item__text">{marked(r.hit.item.title, entry.text)}</span>
                  {valueText(r.hit.item) && <span className="net-item__sub">{valueText(r.hit.item)}</span>}
                </div>
              ),
            )}
          </div>
        </div>
      )}
      {active && typing && (
        <Keyboard
          entry={entry}
          search
          style={{ left: 600, top: 952 - 360 }}
          onDone={() => {
            setTyping(false)
            setF(hits.length ? 1 : 0)
          }}
          onCancel={() => {
            setTyping(false)
            setF(0)
          }}
        />
      )}
    </div>
  )
}
