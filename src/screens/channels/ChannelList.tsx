import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../apps/registry'
import { useRemote, type RemoteKey } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { tuneChannel, useTv } from '../../tv/store'
import { programmeAt, type Channel } from '../../tv/channels'
import { TV } from '../../assets'
import './channel-list.css'

// com.samsung.tv.channel-list (spec2/channels.md section 3): a 1080 px panel against the right edge with
// live TV visible at x 0-840. Category column (antenna/sort bar, "Channels" header, categories, Edit
// Channels) and the channel column (656x120 rows). Shows and hides with no animation (3.1).

const RES = `${TV}/channels`
const VD = `${TV}/VD_ICONS`
const ROWS = 8          // full channel rows in view
const DWELL_MS = 400    // category preview (cm:CategoryChangeTimer.cs:5)
const IDLE_MS = 60000   // auto-minimise (cl:App/ChannelListApp.cs:775-823)
const NUMBER_MS = 3000  // number entry commit (cm:NumberInput.cs)

type CatId = 'all' | 'genre' | 'type'
type Sub = { label: string; match: (c: Channel) => boolean }
type Cat = { id: CatId; title: string; icon: string; subs: Sub[] }
type Sel = { cat: CatId; sub: string }
type Entry = { ch: Channel; index: number }   // index into the stored lineup
type SortBy = 'number' | 'name'
type Area = 'bar' | 'cats' | 'edit' | 'list' | 'nochan'
type Options = { kind: 'sort'; focus: number } | { kind: 'sub'; cat: number; focus: number }

const KINDS: [string, Channel['kind']][] = [['TV', 'tv'], ['Radio', 'radio'], ['Data/Other', 'data']]
const SORTS: [SortBy, string][] = [['number', 'Number'], ['name', 'Name']]

// "News&Opinion" -> "News & Opinion" (EPG genre icon names written as labels)
const genreLabel = (g: string) => g.replace(/(\S)&(\S)/g, '$1 & $2')

// Category order, each added only when it has channels (cm25:TVState.cs:461-529): All, Genre, and
// Channel Type when at least two of its sub-categories are non-empty.
function categories(chs: Channel[]): Cat[] {
  const cats: Cat[] = [{ id: 'all', title: 'All', icon: 'epg_i_icon_category_All.svg', subs: [{ label: 'All', match: () => true }] }]
  const genres = [...new Set(chs.map(c => c.genre))]
  if (genres.length) {
    cats.push({
      id: 'genre', title: 'Genre', icon: 'epg_i_icon_filter_genre.svg',
      subs: genres.map(g => ({ label: genreLabel(g), match: c => c.genre === g })),
    })
  }
  const kinds = KINDS.filter(([, k]) => chs.some(c => c.kind === k))
  if (kinds.length >= 2) {
    cats.push({
      id: 'type', title: 'Channel Type', icon: 'epg_i_icon_category_TV-channel-.svg',
      subs: kinds.map(([label, k]) => ({ label, match: c => c.kind === k })),
    })
  }
  return cats
}

function entries(chs: Channel[], cats: Cat[], sel: Sel, sort: SortBy): Entry[] {
  const cat = cats.find(c => c.id === sel.cat) ?? cats[0]
  const sub = cat.subs.find(s => s.label === sel.sub) ?? cat.subs[0]
  const out = chs.map((ch, index) => ({ ch, index })).filter(e => sub.match(e.ch))
  return sort === 'name' ? out.sort((a, b) => a.ch.name.localeCompare(b.ch.name)) : out.sort((a, b) => a.ch.number - b.ch.number)
}

// Focus on the watched channel (index 0 if it is not in the list), positioned with no motion.
function place(list: Entry[], current: number) {
  const focus = Math.max(0, list.findIndex(e => e.index === current))
  return { focus, top: Math.max(0, Math.min(focus, list.length - ROWS)) }
}

// The app is minimised, not closed, so it keeps its category and sort between openings.
const mem: { sel: Sel; subs: Partial<Record<CatId, string>>; sort: SortBy } = {
  sel: { cat: 'all', sub: 'All' },
  subs: {},
  sort: 'number',
}

export function ChannelList({ onExit, launch }: AppProps) {
  const channels = useTv(s => s.channels)
  const current = useTv(s => s.channel)
  const watching = useTv(s => (s.source === 'TV' ? s.channel : -1))
  const cats = useMemo(() => categories(channels), [channels])
  const [sort, setSort] = useState(mem.sort)
  const [subs, setSubs] = useState(mem.subs)        // each Genre / Channel Type tile's sub-category
  const tileSel = (i: number): Sel => {
    const c = cats[i]
    const s = subs[c.id]
    return { cat: c.id, sub: c.subs.some(x => x.label === s) ? s! : c.subs[0].label }
  }
  const [committed, setCommitted] = useState<Sel>(() => (cats.some(c => c.id === mem.sel.cat) ? mem.sel : { cat: 'all', sub: 'All' }))
  const [shown, setShown] = useState<Sel>(committed)  // what the channel column lists (preview or committed)
  const list = useMemo(() => entries(channels, cats, shown, sort), [channels, cats, shown, sort])
  const [pos, setPos] = useState(() => place(list, current))
  const [area, setArea] = useState<Area>(channels.length ? 'list' : 'nochan')
  const [catFocus, setCatFocus] = useState(0)
  const [opts, setOpts] = useState<Options | null>(null)
  const [noChanFocus, setNoChanFocus] = useState(0)  // Scan Now, Cancel
  const [digits, setDigits] = useState('')
  const [keySeq, setKeySeq] = useState(0)
  const [scrolled, setScrolled] = useState(0)        // bumps on a scroll: the scrollbar shows for 1 s
  const [animate, setAnimate] = useState(false)      // first positioning has no motion
  const catIndex = Math.max(0, cats.findIndex(c => c.id === committed.cat))

  useMoveSound(`${area}:${area === 'list' ? pos.focus : area === 'cats' ? catFocus : area === 'nochan' ? noChanFocus : ''}`)
  useMoveSound(opts?.focus, !!opts)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ---- list content and position ----
  const showSel = (sel: Sel, reposition = false) => {
    const same = sel.cat === shown.cat && sel.sub === shown.sub
    if (same && !reposition) return
    setShown(sel)
    setPos(place(entries(channels, cats, sel, sort), current))
  }
  const commit = (sel: Sel) => {
    mem.sel = sel
    setCommitted(sel)
    showSel(sel, true)
    setArea('list')
  }
  const moveList = (focus: number, page = 0) => {
    const n = list.length
    const f = Math.max(0, Math.min(n - 1, focus))
    let top = Math.max(0, Math.min(Math.max(0, n - ROWS), pos.top + page))
    if (f < top) top = f
    else if (f >= top + ROWS) top = f - ROWS + 1
    if (top !== pos.top) setScrolled(s => s + 1)
    setPos({ focus: f, top })
  }
  const tune = (index: number) => {
    tuneChannel(index)   // the TV shows the channel banner
    onExit('live')
  }

  // ---- category preview after a 400 ms dwell (also for the sub-category list) ----
  const dwell: Sel | null =
    area !== 'cats' ? null
    : opts?.kind === 'sub' ? { cat: cats[opts.cat].id, sub: cats[opts.cat].subs[opts.focus].label }
    : tileSel(catFocus)
  const dwellKey = dwell ? `${dwell.cat}\n${dwell.sub}` : ''
  const preview = useRef(showSel)
  preview.current = showSel
  useEffect(() => {
    if (!dwellKey) return
    const [cat, sub] = dwellKey.split('\n')
    const t = setTimeout(() => preview.current({ cat: cat as CatId, sub }), DWELL_MS)
    return () => clearTimeout(t)
  }, [dwellKey])

  // ---- timers: 60 s idle, 3 s number entry ----
  const exit = useRef(onExit)
  exit.current = onExit
  useEffect(() => {
    const t = setTimeout(() => exit.current('live'), IDLE_MS)
    return () => clearTimeout(t)
  }, [keySeq])
  const commitDigits = (d: string) => {
    setDigits('')
    const i = channels.findIndex(c => c.number === Number(d))
    if (i >= 0) tune(i)
  }
  const commitRef = useRef(commitDigits)
  commitRef.current = commitDigits
  useEffect(() => {
    if (!digits) return
    const t = setTimeout(() => commitRef.current(digits), NUMBER_MS)
    return () => clearTimeout(t)
  }, [digits])

  // ---- keys (3.5) ----
  useRemote((key: RemoteKey) => {
    if (key === 'Home' || key === 'Source' || key === 'Settings') return false
    setKeySeq(n => n + 1)
    if (key === 'ChannelList' || key === 'Exit') {
      onExit('live')
      return true
    }
    if (digits) {
      // a leading 0 is ignored; up to 4 digits (DVB, inferred)
      if (key.startsWith('Digit')) setDigits(d => (d + key.slice(5)).slice(0, 4))
      else if (key === 'Enter') commitDigits(digits)
      else if (key === 'Back') setDigits('')
      return true
    }
    if (opts) {
      const n = opts.kind === 'sort' ? SORTS.length : cats[opts.cat].subs.length
      if (key === 'Up' || key === 'Down') setOpts({ ...opts, focus: Math.max(0, Math.min(n - 1, opts.focus + (key === 'Up' ? -1 : 1))) })
      else if (key === 'Back') setOpts(null)
      else if (key === 'Enter' && opts.kind === 'sort') {
        const s = SORTS[opts.focus][0]
        mem.sort = s
        setSort(s)
        setPos(place(entries(channels, cats, shown, s), current))
        setOpts(null)
      } else if (key === 'Enter' && opts.kind === 'sub') {
        const c = cats[opts.cat]
        const sub = c.subs[opts.focus].label
        mem.subs = { ...subs, [c.id]: sub }
        setSubs(mem.subs)
        setOpts(null)
        commit({ cat: c.id, sub })
      }
      return true
    }
    if (key === 'Back') {
      onExit('live')
      return true
    }
    switch (area) {
      case 'nochan':
        if (key === 'Up' || key === 'Down') setNoChanFocus(key === 'Up' ? 0 : 1)
        else if (key === 'Enter') {
          if (noChanFocus === 0) launch('channel-search')   // Scan Now: the Auto Program flow (3.6)
          else onExit('live')
        }
        return true
      case 'bar':
        if (key === 'Down') {
          setArea('cats')
          setCatFocus(0)
        } else if (key === 'Enter') setOpts({ kind: 'sort', focus: SORTS.findIndex(s => s[0] === sort) })
        return true
      case 'edit':
        if (key === 'Up') {
          setArea('cats')
          setCatFocus(cats.length - 1)
        } else if (key === 'Enter') onExit('live')   // launches com.samsung.tv.channel-manager (not modelled)
        return true
      case 'cats':
        if (key === 'Up') {
          if (catFocus > 0) setCatFocus(catFocus - 1)
          else setArea('bar')
        } else if (key === 'Down') {
          if (catFocus < cats.length - 1) setCatFocus(catFocus + 1)
          else setArea('edit')
        } else if (key === 'Right' || (key === 'Enter' && cats[catFocus].id === 'all')) commit(tileSel(catFocus))
        else if (key === 'Enter') {
          const c = cats[catFocus]
          setOpts({ kind: 'sub', cat: catFocus, focus: Math.max(0, c.subs.findIndex(s => s.label === tileSel(catFocus).sub)) })
        }
        return true
      case 'list':
        if (key === 'Up' || key === 'Down') moveList(pos.focus + (key === 'Up' ? -1 : 1))
        else if (key === 'ChannelUp') moveList(pos.focus - ROWS, -ROWS)   // previous page
        else if (key === 'ChannelDown') moveList(pos.focus + ROWS, ROWS)  // next page
        else if (key === 'Left') {
          setArea('cats')
          setCatFocus(catIndex)
        } else if (key === 'Enter' && list[pos.focus]) tune(list[pos.focus].index)
        else if (key.startsWith('Digit') && key !== 'Digit0') setDigits(key.slice(5))
        return true
    }
    return true
  })

  const empty = channels.length === 0
  const now = new Date()
  return (
    <div className="cl">
      {/* ---- category column (3.2.1) ---- */}
      <div className="cl-cats">
        <div className="cl-bar">
          <div className="cl-dropdown is-disabled">
            <span className="cl-dropdown__label">Air</span>
            <span className="cl-dropdown__divider" />
            <span className="cl-dropdown__arrow" />
          </div>
          <div className={`cl-sort ${area === 'bar' && !opts ? 'is-focused' : ''}`}>
            <span className="cl-sort__icon" style={{ maskImage: `url(${RES}/i_chl_icon_dropdown_language.svg)`, WebkitMaskImage: `url(${RES}/i_chl_icon_dropdown_language.svg)` }} />
          </div>
        </div>
        <div className="cl-header">Channels</div>
        {!empty && (
          <div className="cl-catlist">
            {cats.map((c, i) => {
              const focused = area === 'cats' && catFocus === i && !opts
              const selected = i === catIndex
              return (
                <div
                  key={c.id}
                  className={`cl-cat ${i > 0 ? 'has-divider' : ''} ${focused ? 'is-focused' : ''} ${selected ? 'is-selected' : ''}`}
                  style={{ top: 8 + i * 88 }}
                >
                  <img className="cl-cat__icon" src={`${RES}/${c.icon}`} alt="" />
                  {selected && <img className="cl-cat__check" src={`${VD}/i_icon_info_check.svg`} alt="" />}
                  <div className="cl-cat__text">
                    <div className="cl-cat__title">{c.title}</div>
                    {c.id !== 'all' && <div className="cl-cat__sub">{tileSel(i).sub}</div>}
                  </div>
                  {c.id !== 'all' && (
                    <span className="cl-cat__arrow" style={{ maskImage: `url(${RES}/i_chl_icon_dropdown_arrow.svg)`, WebkitMaskImage: `url(${RES}/i_chl_icon_dropdown_arrow.svg)` }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
        {!empty && <div className={`flux-btn cl-edit ${area === 'edit' ? 'is-focused' : ''}`}>Edit Channels</div>}
      </div>

      {/* ---- channel column (3.2.2, 3.3) ---- */}
      <div className="cl-chans">
        {empty ? (
          <div className="cl-nochan">
            <img className="cl-nochan__image" src={`${RES}/i_chl_icon_ris_nochannel.svg`} alt="" />
            <div className="cl-nochan__text">Try performing a channel scan or changing the channel source from the menu bar on the left.</div>
            <div className={`flux-btn cl-nochan__button ${noChanFocus === 0 ? 'is-focused' : ''}`} style={{ top: 680 }}>Scan Now</div>
            <div className={`flux-btn cl-nochan__button ${noChanFocus === 1 ? 'is-focused' : ''}`} style={{ top: 760 }}>Cancel</div>
          </div>
        ) : (
          <>
            <div className={`cl-rows ${animate ? 'is-animated' : ''}`} style={{ transform: `translateY(${-pos.top * 120}px)` }}>
              {list.map((e, i) => (
                <ChannelRow
                  key={e.index}
                  entry={e}
                  top={24 + i * 120}
                  title={programmeAt(e.ch, now).title}
                  focused={area === 'list' && pos.focus === i}
                  watching={e.index === watching}
                  divider={i > 0 && !(area === 'list' && (pos.focus === i || pos.focus === i - 1))}
                />
              ))}
            </div>
            {scrolled > 0 && list.length > ROWS && (
              <div key={scrolled} className="cl-scrollbar">
                <span
                  className="cl-scrollbar__thumb"
                  style={{
                    height: (1032 * ROWS) / list.length,
                    transform: `translateY(${(1032 * pos.top) / list.length}px)`,
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {opts && <OptionList opts={opts} cats={cats} sort={sort} tileSel={tileSel} />}

      {/* ---- number entry (3.7) ---- */}
      {digits && (
        <div className="cl-num" style={{ backgroundImage: `url(${RES}/ch_bg_default.webp)` }}>
          {digits}
        </div>
      )}
    </div>
  )
}

function ChannelRow({ entry, top, title, focused, watching, divider }: {
  entry: Entry
  top: number
  title: string
  focused: boolean
  watching: boolean
  divider: boolean
}) {
  const { ch } = entry
  const cls = ['cl-row', focused ? 'is-focused' : '', watching ? 'is-selected' : '', divider ? 'has-divider' : ''].join(' ')
  return (
    <div className={cls} style={{ top }}>
      <div className="cl-row__logo">{ch.number}</div>
      {watching && <img className="cl-row__check" src={`${VD}/i_icon_info_check.svg`} alt="" />}
      {title ? (
        // C_TextTileDoubleLine_02: programme title, then number + channel name
        <div className="cl-row__text">
          <div className="cl-row__line1">{title}</div>
          <div className="cl-row__line2">
            <span className="cl-row__num">{ch.number}</span>
            <span className="cl-row__name">{ch.name}</span>
          </div>
        </div>
      ) : (
        // C_TextTileSingleLine_02: number + name on one T28 line
        <div className="cl-row__text cl-row__text--single">
          <span className="cl-row__num">{ch.number}</span>
          <span className="cl-row__name">{ch.name}</span>
        </div>
      )}
    </div>
  )
}

// P_ListOption_02 (3.4): sort list under the antenna bar (41 u), sub-category list under its tile (48 u).
function OptionList({ opts, cats, sort, tileSel }: { opts: Options; cats: Cat[]; sort: SortBy; tileSel: (i: number) => Sel }) {
  const items = opts.kind === 'sort' ? SORTS.map(s => s[1]) : cats[opts.cat].subs.map(s => s.label)
  const chosen = opts.kind === 'sort' ? SORTS.find(s => s[0] === sort)![1] : tileSel(opts.cat).sub
  const visible = Math.min(items.length, 8)
  const height = 16 + visible * 80
  const x = opts.kind === 'sort' ? 16 : 40                       // anchor x + 2 u (panel-relative)
  const anchorBottom = opts.kind === 'sort' ? 88 : 128 + (opts.cat + 1) * 88
  const y = Math.min(anchorBottom, 1080 - 24 - height)
  const first = Math.max(0, Math.min(items.length - visible, opts.focus - visible + 1))
  return (
    <div className={`cl-options cl-options--${opts.kind}`} style={{ left: x, top: y, height }}>
      <div className="cl-options__inner" style={{ transform: `translateY(${-first * 80}px)` }}>
        {items.map((label, i) => (
          <div key={label} className={`cl-options__row ${i === opts.focus ? 'is-focused' : ''}`}>
            <span>{label}</span>
            {label === chosen && <img src={`${TV}/VD_ICONS/i_icon_info_check.svg`} alt="" />}
          </div>
        ))}
      </div>
    </div>
  )
}
