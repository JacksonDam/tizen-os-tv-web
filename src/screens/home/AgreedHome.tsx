import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { Lottie } from '../../components/Lottie'
import { TV } from '../../assets'
import { useMoveSound } from '../../tv/sound'
import { getTv, setSetting, switchSource, tuneChannel, useSetting, useTv } from '../../tv/store'
import { useOnline } from '../../tv/online'
import { showToast } from '../setup/toastStore'
import { NowPlayingRow } from './NowPlayingRow'
import { ImmersiveBanner, MOVE_SLOT_MS } from './agreed/ImmersiveBanner'
import { LauncherRow } from './agreed/LauncherRow'
import { ContentRow } from './agreed/ContentRow'
import { useLauncher, type LauncherItem } from './launcher'
import { CONTENT_ROWS, PROMOS } from './serverContent'
import { cancelLaunch, launchApp, LaunchLoading, useLaunching } from './appLaunch'
import './agreed/agreed.css'

const NH = `${TV}/com.samsung.tv.coba.newhome`
const CS = `${TV}/com.samsung.tv.csfs`

// The home page once the Smart Hub terms are agreed and the TV is online, signed out
// (CompMediaCategoryCache: d/topbanner + d/tabs; CompHomeTabCache: d/recent.row@OnNow, d/launcher,
// d/external.vac.row, d/continuewatchrow, s/option.row, s/terra.bottom). Compared with the page before
// agreement (SetupHome): the immersive banner replaces the setup banner, the tab list is d/tabs
// (CompTabLayerCache: Discover, Live only in Samsung TV Plus countries with TV Plus running, and the
// Apps tab whose component ships with the store, which this firmware does not have, so Discover is the
// only tab), the launcher shows the apps and Edit instead of the sign-in banner, the server's content
// rows follow it (stubbed: Continue Watching, Recommended for You; the external VAC row stays empty),
// and the page has no dumb-TV pattern (CompMediaCategoryElement adds it only before agreement).
// Rows stack without gaps; heights, scroll policies and morphs as in spec/home.md 2-3.

type RowId = 'banner' | 'tab' | 'nowplaying' | 'launcher' | `content${number}` | 'options' | 'bottom'
type Row = { id: RowId; height: number; scroll: 'top' | 'launcher' | 'content' | 'fit'; morph: number }

const BANNER_SPREAD = 1080 - 344  // the banner row grows to the window (240 x 135 u)
const DESC_MORPH = 64             // focused rows with a description grow 8 u
const ON_NOW_MAX = 10
const SOUND_RANGE: [number, number] = [1, 60]

// Where the page was when an app was launched from it: csfs comes back with the same focus when the app
// closes (it was relocated below the app, __K_RELOCATE_BELOW).
let resume: { row: RowId; launcher: number; content: number[]; np: number } | null = null

type Props = { active: boolean; onSidebar: () => void; onHideHub: () => void }

export function AgreedHome({ active, onSidebar, onHideHub }: Props) {
  const online = useOnline()
  const promos = online ? PROMOS : []
  const contentRows = online ? CONTENT_ROWS : []
  const launcher = useLauncher()
  const channels = useTv(s => s.channels)
  const onNow = channels.slice(0, ON_NOW_MAX)
  const autoplaySound = useSetting<number>('home-autoplay-sound', 1) === 1

  const [restored] = useState(() => {
    const r = resume
    resume = null
    return r
  })
  const [row, setRow] = useState<RowId>(restored?.row ?? 'tab')
  const [npItem, setNpItem] = useState(restored?.np ?? 0)
  const [lItem, setLItem] = useState(restored?.launcher ?? 0)
  const [cItems, setCItems] = useState<number[]>(restored?.content ?? CONTENT_ROWS.map(() => 0))
  const [banner, setBanner] = useState({ index: 0, dir: 1 as 1 | -1 })
  const launching = useLaunching()

  const rows: Row[] = [
    { id: 'banner', height: 344, scroll: 'top', morph: BANNER_SPREAD },
    { id: 'tab', height: 184, scroll: 'top', morph: 0 },
    { id: 'nowplaying', height: 328, scroll: 'top', morph: DESC_MORPH },
    ...(launcher.length ? [{ id: 'launcher' as const, height: 224, scroll: 'launcher' as const, morph: 0 }] : []),
    ...contentRows.map((_, i) => ({ id: `content${i}` as RowId, height: 400, scroll: 'content' as const, morph: DESC_MORPH })),
    { id: 'options', height: 336, scroll: 'fit', morph: 0 },
    { id: 'bottom', height: 152, scroll: 'fit', morph: 0 },
  ]
  const tops: number[] = []
  rows.reduce((y, r) => (tops.push(y), y + r.height), 0)
  const ri = Math.max(0, rows.findIndex(r => r.id === row))
  const cur = rows[ri]
  // the banner takes the focus only with a server banner (the default tile has no button)
  const focusable = (r: Row) => r.id !== 'banner' || promos.length > 0

  // list offset for the focused row (FSScrollViewBridge.GetScrollType / ScrollViewLayoutV)
  const scrollRef = useRef(0)
  const scroll = (() => {
    const top = tops[ri]
    switch (cur.scroll) {
      case 'top': return 0
      case 'launcher': return 16 - top   // offset 2 u
      case 'content': return 240 - top   // offset 30 u
      default: {
        // fit: the smallest move that shows the whole row
        let s = scrollRef.current
        if (top + cur.height + s > 1080) s = 1080 - top - cur.height
        if (top + s < 0) s = -top
        return s
      }
    }
  })()
  scrollRef.current = scroll

  const item = (r: RowId) =>
    r === 'nowplaying' ? Math.min(npItem, onNow.length)
      : r === 'launcher' ? Math.min(lItem, launcher.length)
        : r.startsWith('content') ? cItems[+r.slice(7)] ?? 0 : 0
  useMoveSound(`${row}:${item(row)}:${row === 'banner' ? banner.index : ''}`)

  const toDefaultFocus = () => setRow('tab')
  const moveBanner = (dir: 1 | -1) =>
    setBanner(b => ({ index: (b.index + dir + promos.length) % promos.length, dir }))

  // Slots move on every 5 s while the Discover tab has the focus (moveSlotTimer).
  useEffect(() => {
    if (!active || row !== 'tab' || promos.length < 2) return
    const t = setInterval(() => moveBanner(1), MOVE_SLOT_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, row, promos.length])

  const remember = () => {
    resume = { row, launcher: lItem, content: cItems, np: npItem }
  }
  const openLauncherItem = (it: LauncherItem) => {
    if (it.kind === 'webapp') {
      remember()
      launchApp(it.app)
    } else if (it.kind === 'livetv') {
      // SelectContent: tv-viewer with the tuner (the channel it was on)
      if (getTv().source === 'TV') onHideHub()
      else tuneChannel(getTv().channel)
    } else switchSource(it.source)
  }

  useRemote(key => {
    if (launching) {
      // OnSelectLoadingView takes every key but Home (OnDummyKeyEvent); Home drops the launch (inferred)
      if (key !== 'Home') return true
      cancelLaunch()
    }
    const move = (d: number) => {
      let j = ri + d
      while (rows[j] && !focusable(rows[j])) j += d
      if (rows[j]) setRow(rows[j].id)
    }
    switch (key) {
      case 'Left':
        if (row === 'banner') moveBanner(-1)
        else if (row === 'nowplaying' && item(row) > 0) setNpItem(item(row) - 1)
        else if (row === 'launcher' && item(row) > 0) setLItem(item(row) - 1)
        else if (row.startsWith('content') && item(row) > 0) {
          const k = +row.slice(7)
          setCItems(c => c.map((v, i) => (i === k ? v - 1 : v)))
        } else onSidebar()
        return true
      case 'Right':
        if (row === 'banner') moveBanner(1)
        else if (row === 'nowplaying' && item(row) < onNow.length) setNpItem(item(row) + 1)
        else if (row === 'launcher' && item(row) < launcher.length) setLItem(item(row) + 1)
        else if (row.startsWith('content')) {
          const k = +row.slice(7)
          if (item(row) < contentRows[k].items.length - 1) setCItems(c => c.map((v, i) => (i === k ? v + 1 : v)))
        }
        return true
      case 'Down':
        move(1)
        return true
      case 'Up':
        move(-1)
        return true
      case 'Enter':
        if (row === 'banner') {
          remember()
          launchApp(promos[banner.index].app)
        } else if (row === 'tab') setRow('nowplaying')
        else if (row === 'nowplaying') {
          if (item(row) === 0) onHideHub()
          else tuneChannel(item(row) - 1)
        } else if (row === 'launcher') {
          const i = item(row)
          if (i < launcher.length) openLauncherItem(launcher[i])
          else {
            // Edit (CompEdit.OnSelected): the guide toast, then the menu of the last launcher tile
            showToast('Choose an item to edit.') // TV_SID_HOME_CEFEB_CHOOSE_AN_ITEM_TO_EDIT
            setLItem(launcher.length - 1)
          }
        } else if (row.startsWith('content')) {
          const it = contentRows[+row.slice(7)].items[item(row)]
          remember()
          launchApp(it.app)
        } else if (row === 'options') setSetting('home-autoplay-sound', autoplaySound ? 0 : 1)
        else if (row === 'bottom') toDefaultFocus()
        return true
      case 'Back':
      case 'Home':
        toDefaultFocus()
        return true
      default:
        return false
    }
  }, active)

  const pageFocus = (id: RowId) => active && !launching && row === id
  const spread = row === 'banner' && active
  const playItem = !active || launching ? -1 : row === 'tab' ? 0 : row === 'nowplaying' ? item('nowplaying') : -1
  // rows after the focused one are pushed by its morph
  const pushAfter = (i: number) => (i > ri && (cur.id !== 'banner' || spread) ? cur.morph : 0)
  const style = (i: number) => ({ top: tops[i], height: rows[i].height, transform: `translateY(${pushAfter(i)}px)` })
  const bottomIdx = rows.findIndex(r => r.id === 'bottom')
  const knox = tops[bottomIdx] + scroll < 1080

  return (
    <div className={`home__page home__page--agreed ${spread ? 'is-spread' : ''}`}>
      <div className="home__list" style={{ transform: `translateY(${scroll}px)` }}>
        {rows.map((r, i) => {
          switch (r.id) {
            case 'banner':
              return (
                <section key={r.id} className="hrow hrow--ib" style={{ top: 0, height: 344 }}>
                  <ImmersiveBanner promos={promos} index={banner.index} dir={banner.dir} spread={spread} />
                </section>
              )
            case 'tab':
              return (
                <section key={r.id} className="hrow hrow--tab" style={style(i)}>
                  <img className="tab__fade" src={`${CS}/home_i_bg_banner_gradient_bottom_2k.webp`} alt="" />
                  <div className="tab__solid" />
                  <img className="tab__backplate" src={`${TV}/edenview-app/home_tab_backplate_192x64.png`} alt="" />
                  <div className={`home-tab ${pageFocus('tab') ? 'is-focused' : 'is-selected'}`}>
                    <span>Discover</span>
                  </div>
                </section>
              )
            case 'nowplaying':
              return (
                <section key={r.id} className={`hrow hrow--nowplaying ${row === r.id ? 'is-current' : ''}`} style={style(i)}>
                  <NowPlayingRow
                    onNow={onNow}
                    item={item('nowplaying')}
                    current={row === 'nowplaying'}
                    focused={pageFocus('nowplaying')}
                    playItem={playItem}
                    playKey={`${row}:${playItem}`}
                    sound={autoplaySound}
                  />
                </section>
              )
            case 'launcher':
              return (
                <section key={r.id} className="hrow hrow--launcher" style={style(i)}>
                  <LauncherRow items={launcher} focus={item('launcher')} current={row === 'launcher'} focused={pageFocus('launcher')} />
                </section>
              )
            case 'options':
              return (
                <section key={r.id} className="hrow hrow--options" style={style(i)}>
                  <div className={`group-title ${pageFocus('options') ? 'is-focused' : ''}`}>Media Options</div>
                  <div className={`option ${pageFocus('options') ? 'is-focused' : ''}`}>
                    <div className="option__plate">
                      <Lottie
                        className="option__icon"
                        src={`${NH}/home_i_icon_media_option_${autoplaySound ? 'soundon' : 'soundoff'}.json`}
                        playing={pageFocus('options')}
                        range={SOUND_RANGE}
                      />
                    </div>
                    <div className="option__title">Autoplay Sound</div>
                    <div className="option__subtitle">{autoplaySound ? 'On' : 'Off'}</div>
                  </div>
                </section>
              )
            case 'bottom':
              return (
                <section key={r.id} className="hrow hrow--bottom" style={style(i)}>
                  <div className={`flux-btn flux-btn--icon gototop ${pageFocus('bottom') ? 'is-focused' : ''}`}>
                    <span className="gototop__icon" />
                  </div>
                </section>
              )
            default: {
              const k = +r.id.slice(7)
              return (
                <section key={r.id} className={`hrow hrow--content ${row === r.id ? 'is-current' : ''}`} style={style(i)}>
                  <ContentRow row={contentRows[k]} item={item(r.id)} current={row === r.id} focused={pageFocus(r.id)} />
                </section>
              )
            }
          }
        })}
      </div>

      {/* "Secured by Knox", fixed to the screen while the bottom row is visible. */}
      <img className={`knox ${knox ? 'is-shown' : ''}`} src={`${CS}/i_logo_knox_default.svg`} alt="" />
      {launching && <LaunchLoading />}
    </div>
  )
}
