import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STUB_GAMES, stubArt, type StubGame } from '../../../../../shared/fictional'
import { useRemote, type RemoteKey } from '../../../../../input/remote'
import { getApp, openApp, type AppProps } from '../../../../shell'
import { playUi, UI_SOUND } from '../../../../tv/sound'
import { setSetting, useSetting } from '../../../../tv/store'
import { useSmartHub } from '../../../../tv/online'
import { GAMES } from '../../data'
import { fw } from '../hubapps/assets'
import type { RunParams } from '../hubapps/AppRunner'
import { getInstalledGames, setInstalledGames, startDownload, useDownloads, useInstalledGames } from '../hubapps/catalog'
import { ScrollText } from '../hubapps/ScrollText'
import { Nine, SHPage } from '../hubapps/sh'
import { NEW_GAMES } from './GamesPanel'

// The Game Hub (CGHApp, application 0xd6): "All Games" (CGHGamesView, content type 0x20130833), "My Page"
// (CGHMyGameView, 0x20130832) and a game's details (CGHDetailView, 0x20130837). The Games panel opens the
// details of a game; its sub menu items 0 and 1 (CHomeExecutor::m_GetSubMenuItemEnum(9, i) = 1, 2) open
// My Page and All Games (CGHApp::m_GetStartViewInfo @042ba9dc). The views are laid out in a 1280x720 OSD
// (GHOsdInfo::t_Init1280x720 @04382b54), drawn x1.5 here. Spec:
// samsung-tv-qemu/extract/f13/spec/online-apps2013.md.
//   Background GameHub/bg/game_bg.png (1280x720).
//   Colour tag (CGHViewColorTag::Create @042e3448, m_SetBg @042e1c9c): GH_GB_COLOR_TAG_BG 266x250 at
//     (0, 0), level-2 gradient (0.118, 0.580, 0.337) -> (0.008, 0.471, 0.227); title at (20, 20) in
//     246x52, size GH_GB_COLOR_TAG_TITLE_FONTSIZE_1 36, white.
//   Lists (CGHGamesView::t_InitialGridLayoutPara @04308648): 2 rows of GH_MYGAMESVIEW_LIST_ITEM 258x204
//     items, 41 / 1 px apart, centred on (768, 352); in an item the screenshot (0, 19, 258, 147), the text
//     band (0, 146, 258, 43) and the title (8, 166, 241, 31); focus image -20 px, the item enlarged 20x16.
//     Three columns are shown at a time (inferred: the CMMGridLayoutList paging was not traced).
//   Item index (GH_MYGAMESVIEW_ITEMINDEX_RECT) "i / n" at (1136, 133) 133x21.
//   Details (GH_APPDETAIL_*, text window GH_APPDETAIL_FULLWND_RECT at (480, 37)): title (45, 0) 340x49,
//     price (45, 51) 704x30, information lines (45, 79 / 107 / 135) 704x30, screenshots
//     GH_APPDETAIL_IRON_SCREENSHORT1..3 (45 / 264 / 482, 197) 195x110, description (45, 320) 653x97;
//     buttons on the screen at y 456: Download/Play (516) 177x61 (detail_btn_264 / _high), rating
//     (690) 180x61.
// Texts are g_GHWStringEng. Paid games would go through the billing application, which is not part of
// this area: their Buy button asks for a Samsung account (0x108) or says the function is unavailable.

// The Samsung account sign-in screen (area net2013), opened when it is registered.
export const SIGN_IN_APP = 'samsungaccount'

export type HubParams = { view: 'all' | 'mine' | 'detail'; game?: string; from?: 'hub' | 'panel' }

const ITEM_W = 258
const ITEM_H = 204
const SPACE_W = 41
const SPACE_H = 1
const COLS = 3 // (inferred) columns on screen
const ROWS = 2
const GRID_LEFT = Math.round(768 - (COLS * ITEM_W + (COLS - 1) * SPACE_W) / 2)
const GRID_TOP = Math.round(352 - (ROWS * ITEM_H + SPACE_H) / 2)

const SORT_ALL = ['Popularity', 'Rating', 'Release Date', 'Title A to Z', 'Title Z to A'] // 0x4f-0x53
const SORT_MINE = ['Recently Played', 'Date Downloaded', 'Title A to Z', 'Title Z to A'] // 0x61, 0x62, 0x52, 0x53

function hash(s: string) {
  let h = 0
  for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0
  return h
}

function sorted(list: StubGame[], how: string, played: string[]) {
  const a = [...list]
  switch (how) {
    case 'Rating': return a.sort((x, y) => (hash(y.id) % 5) - (hash(x.id) % 5))
    case 'Release Date': return a.reverse()
    case 'Title A to Z': return a.sort((x, y) => x.name.localeCompare(y.name))
    case 'Title Z to A': return a.sort((x, y) => y.name.localeCompare(x.name))
    case 'Recently Played': {
      const r = (id: string) => (played.includes(id) ? played.indexOf(id) : 1e6)
      return a.sort((x, y) => r(x.id) - r(y.id))
    }
    case 'Date Downloaded': return a.reverse()
    default: return a
  }
}

type Popup =
  | { kind: 'menu'; items: string[]; sel: number; checked?: number; onPick: (i: number) => void }
  | { kind: 'msg'; text: string; buttons: string[]; sel: number; onDone?: (b: number) => void; timeout?: number }

export function GameHub({ params, close }: AppProps) {
  const p = (params ?? { view: 'all' }) as HubParams
  const installed = useInstalledGames()
  const downloads = useDownloads()
  const account = useSmartHub().account
  const played = useSetting<string>('hubapps.played', '')
  const playedList = useMemo(() => played.split(',').filter(Boolean), [played])
  const autoUpdate = useSetting<string>('hubapps.gamesautoupdate', 'on')

  const [view, setView] = useState<'all' | 'mine' | 'detail'>(p.view)
  const [listView, setListView] = useState<'all' | 'mine'>(p.view === 'mine' ? 'mine' : 'all')
  const [game, setGame] = useState<string | undefined>(p.game)
  const [sortAll, setSortAll] = useState(0)
  const [sortMine, setSortMine] = useState(1)
  const [area, setArea] = useState<'grid' | 'top'>('grid')
  const [gi, setGi] = useState(0)
  const [ti, setTi] = useState(0)
  const [editing, setEditing] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const [popup, setPopup] = useState<Popup | null>(null)

  const list = useMemo(() => {
    if (listView === 'all') return sorted(STUB_GAMES, SORT_ALL[sortAll], playedList)
    return sorted(STUB_GAMES.filter(g => installed.includes(g.id)), SORT_MINE[sortMine], playedList)
  }, [listView, sortAll, sortMine, installed, playedList])

  const st = useRef({ view, listView, game, area, gi, ti, popup, list, editing, checked })
  st.current = { view, listView, game, area, gi, ti, popup, list, editing, checked }

  useEffect(() => {
    if (popup?.kind !== 'msg' || !popup.timeout) return
    const t = setTimeout(() => {
      setPopup(null)
      popup.onDone?.(0)
    }, popup.timeout)
    return () => clearTimeout(t)
  }, [popup])

  const g = game ? STUB_GAMES.find(x => x.id === game) : undefined

  function leaveHub() {
    openApp('smarthub', { panel: GAMES })
  }

  function openDetail(id: string) {
    playUi(UI_SOUND.SELECT)
    setGame(id)
    setView('detail')
  }

  function playOrDownload(game: StubGame) {
    const dl = downloads.get(game.id)
    if (dl) return playUi(UI_SOUND.NOKEY)
    if (installed.includes(game.id)) {
      playUi(UI_SOUND.SELECT)
      setSetting('hubapps.played', [game.id, ...playedList.filter(x => x !== game.id)].join(','))
      openApp('hubapp', {
        id: game.id, name: game.name, from: GAMES, back: { app: 'gamehub', params: { view: 'detail', game: game.id, from: p.from } satisfies HubParams },
      } satisfies RunParams)
      return
    }
    playUi(UI_SOUND.SELECT)
    if (!game.free) {
      // paid: the billing application (not built) needs the Samsung account first
      if (!account) {
        setPopup({ kind: 'msg', text: 'You must sign in to your Samsung account to use this feature. Do you want to sign in?', buttons: ['Yes', 'No'], sel: 0, onDone: b => { if (b === 0 && getApp(SIGN_IN_APP)) openApp(SIGN_IN_APP, { from: 'gamehub' }) } })
      } else {
        setPopup({ kind: 'msg', text: 'The function is currently unavailable.', buttons: ['OK'], sel: 0 })
      }
      return
    }
    startDownload(game.id, 'game')
  }

  function optionsMenu() {
    if (listView === 'all') {
      setPopup({ kind: 'menu', items: SORT_ALL, sel: sortAll, checked: sortAll, onPick: i => { setSortAll(i); setGi(0) } })
    } else {
      setPopup({
        kind: 'menu', items: ['Sort by', 'Delete', 'Auto Update Games'], sel: 0,
        onPick: i => {
          if (i === 0) {
            setPopup({ kind: 'menu', items: SORT_MINE, sel: sortMine, checked: sortMine, onPick: k => { setSortMine(k); setGi(0) } })
          } else if (i === 1) {
            if (!list.length) return
            setEditing(true)
            setChecked([])
            setArea('grid')
          } else {
            setPopup({ kind: 'menu', items: ['On', 'Off'], sel: autoUpdate === 'off' ? 1 : 0, checked: autoUpdate === 'off' ? 1 : 0, onPick: k => setSetting('hubapps.gamesautoupdate', k === 0 ? 'on' : 'off') })
          }
        },
      })
    }
  }

  function popupKey(key: RemoteKey) {
    const pp = st.current.popup!
    if (pp.kind === 'menu') {
      const n = pp.items.length
      if (key === 'Up' || key === 'Down') {
        playUi(UI_SOUND.MOVE)
        setPopup({ ...pp, sel: (pp.sel + (key === 'Down' ? 1 : n - 1)) % n })
      } else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        setPopup(null)
        pp.onPick(pp.sel)
      } else if (key === 'Back' || key === 'Left' || key === 'Right') {
        if (key === 'Back') playUi(UI_SOUND.BACK)
        setPopup(null)
      }
      return true
    }
    if (key === 'Left' || key === 'Right') {
      if (pp.buttons.length > 1) {
        playUi(UI_SOUND.MOVE)
        setPopup({ ...pp, sel: (pp.sel + 1) % pp.buttons.length })
      }
    } else if (key === 'Enter' && pp.buttons.length) {
      playUi(UI_SOUND.SELECT)
      setPopup(null)
      pp.onDone?.(pp.sel)
    } else if (key === 'Back' && pp.buttons.length) {
      playUi(UI_SOUND.BACK)
      setPopup(null)
    }
    return true
  }

  useRemote(key => {
    const s = st.current
    if (key === 'Exit') {
      close()
      return true
    }
    if (key === 'Home' || key === 'VolumeUp' || key === 'VolumeDown' || key === 'Mute' || key === 'Power') return false
    if (s.popup) return popupKey(key)
    if (s.view === 'detail') {
      const game = STUB_GAMES.find(x => x.id === s.game)
      if (key === 'Back') {
        playUi(UI_SOUND.BACK)
        if (p.view === 'detail' && p.from !== 'hub') leaveHub() // opened from the Games panel
        else setView(s.listView)
        return true
      }
      if (key === 'Enter' && game) playOrDownload(game)
      return true
    }
    // list views
    if (key === 'Back') {
      playUi(UI_SOUND.BACK)
      if (s.editing) {
        setEditing(false)
        setChecked([])
      } else leaveHub()
      return true
    }
    if (key === 'Tools') {
      playUi(UI_SOUND.SELECT)
      optionsMenu()
      return true
    }
    if (s.area === 'top') {
      if (key === 'Left' || key === 'Right') {
        const n = key === 'Right' ? 1 : 0
        if (n !== s.ti) {
          playUi(UI_SOUND.MOVE)
          setTi(n)
        }
      } else if (key === 'Down') {
        playUi(UI_SOUND.MOVE)
        setArea('grid')
      } else if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        if (s.ti === 0) {
          // switch between All Games and My Page (the colour tag's sub categories)
          const other = s.listView === 'all' ? 'mine' : 'all'
          setListView(other)
          setView(other)
          setGi(0)
          setEditing(false)
        } else optionsMenu()
      }
      return true
    }
    const n = s.list.length
    const col = Math.floor(s.gi / ROWS)
    const row = s.gi % ROWS
    switch (key) {
      case 'Up':
        playUi(UI_SOUND.MOVE)
        if (row > 0) setGi(s.gi - 1)
        else setArea('top')
        return true
      case 'Down':
        if (row < ROWS - 1 && s.gi + 1 < n) {
          playUi(UI_SOUND.MOVE)
          setGi(s.gi + 1)
        }
        return true
      case 'Left':
        if (col > 0) {
          playUi(UI_SOUND.MOVE)
          setGi(s.gi - ROWS)
        }
        return true
      case 'Right':
        if (s.gi + ROWS < n || (col + 1) * ROWS < n) {
          playUi(UI_SOUND.MOVE)
          setGi(Math.min(s.gi + ROWS, n - 1))
        }
        return true
      case 'Enter': {
        const it = s.list[s.gi]
        if (!it) return playUi(UI_SOUND.NOKEY), true
        if (s.editing) {
          playUi(UI_SOUND.SELECT)
          setChecked(c => (c.includes(it.id) ? c.filter(x => x !== it.id) : [...c, it.id]))
          return true
        }
        openDetail(it.id)
        return true
      }
      case 'Red':
        // edit mode: A deletes the selected games (0x102 "Delete selected items?")
        if (s.editing && s.checked.length) {
          const ids = s.checked
          setPopup({
            kind: 'msg', text: ids.length > 1 ? 'Delete selected items?' : 'Delete the selected item?', buttons: ['Yes', 'No'], sel: 0,
            onDone: b => {
              if (b !== 0) return
              setPopup({
                kind: 'msg', text: 'Deleting…', buttons: [], sel: 0, timeout: 1500, onDone: () => {
                  setInstalledGames(getInstalledGames().filter(x => !ids.includes(x)))
                  setEditing(false)
                  setChecked([])
                  setGi(0)
                },
              })
            },
          })
        }
        return true
      default:
        return true
    }
  })

  const title = listView === 'all' ? 'All Games' : 'My Page'
  return (
    <div className="hub-runner">
      <SHPage>
        <img src={fw('GameHub/bg/game_bg.png')} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720 }} />
        {/* the details page covers the colour tag with the game's picture (inferred) */}
        {view !== 'detail' && <ColorTag title={title} />}
        {view !== 'detail' && (
          <>
            <TopButtons sel={area === 'top' && !popup ? ti : -1} other={listView === 'all' ? 'My Page' : 'All Games'} options={listView === 'all' ? 'Sort by' : 'Options'} />
            <ItemIndex text={list.length ? `${Math.min(gi + 1, list.length)} / ${list.length}` : ''} />
            {list.length === 0 && (
              // GH_NO_FILE_TEXT: at x 18, size 20, white, the full height, centred
              <div style={{ position: 'absolute', left: 300, top: 0, width: 960, height: 720, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 20, whiteSpace: 'pre-line' }}>
                {"You haven't downloaded or purchased any games. \nCheck out what's available from All Games and start playing now!"}
              </div>
            )}
            <Grid list={list} focus={area === 'grid' && !popup ? gi : -1} installed={installed} downloads={downloads} editing={editing} checked={checked} />
            {list[gi] && area === 'grid' && <InfoBar game={list[gi]} />}
            {editing && (
              <div style={{ position: 'absolute', left: 340, top: 600, width: 860, fontSize: 20, color: '#fff' }}>
                {/* the edit menu's guide (CGHEditMenu): A deletes, RETURN cancels (layout inferred) */}
                Selected items : {checked.length}   <span style={{ color: '#ff5050' }}>A</span> Delete   RETURN Cancel
              </div>
            )}
          </>
        )}
        {view === 'detail' && g && <Detail game={g} installed={installed.includes(g.id)} dl={downloads.get(g.id)} />}
        {popup?.kind === 'menu' && <GHMenu items={popup.items} sel={popup.sel} checked={popup.checked} />}
        {popup?.kind === 'msg' && <GHMessage text={popup.text} buttons={popup.buttons} sel={popup.sel} />}
      </SHPage>
    </div>
  )
}

function ColorTag({ title }: { title: string }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 266, height: 250, background: 'linear-gradient(#1e9456, #02783a)' }}>
      <div style={{ position: 'absolute', left: 20, top: 20, width: 246, fontSize: 36, lineHeight: '45px', color: '#fff' }}>{title}</div>
    </div>
  )
}

// The view's buttons at the top right (the other list and the view's options; icon_view / icon_edit
// images of GameHub/icon; placement inferred from the widget manager's TopTools).
function TopButtons({ sel, other, options }: { sel: number; other: string; options: string }) {
  const w = (t: string) => Math.round(t.length * 10.4) + 62
  const ow = w(options)
  const vw = w(other)
  const right = 1260
  const btn = (x: number, width: number, icon: string, text: string, hi: boolean): ReactNode => (
    <div style={{ position: 'absolute', left: x, top: 9, width, height: 55 }}>
      <img src={fw(`GameHub/icon/icon_${icon}_${hi ? 'high' : 'nor'}.png`)} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
      <div style={{ position: 'absolute', left: 56, top: 0, lineHeight: '55px', fontSize: 20, whiteSpace: 'nowrap', color: hi ? '#fdd911' : '#fff' }}>{text}</div>
    </div>
  )
  return (
    <>
      {btn(right - ow, ow, 'edit', options, sel === 1)}
      {btn(right - ow - 10 - vw, vw, 'view', other, sel === 0)}
    </>
  )
}

function ItemIndex({ text }: { text: string }) {
  return <div style={{ position: 'absolute', left: 1136 - 60, top: 133, width: 133 + 60, height: 21, fontSize: 20, lineHeight: '21px', textAlign: 'right' }}>{text}</div>
}

function Grid({ list, focus, installed, downloads, editing, checked }: {
  list: StubGame[]; focus: number; installed: string[]; downloads: Map<string, { progress: number; phase: string }>; editing: boolean; checked: string[]
}) {
  // page by whole screens of COLS columns
  const page = focus >= 0 ? Math.floor(Math.floor(focus / ROWS) / COLS) : 0
  const items = list.slice(page * COLS * ROWS, (page + 1) * COLS * ROWS)
  return (
    <>
      {items.map((g, k) => {
        const idx = page * COLS * ROWS + k
        const col = Math.floor(k / ROWS)
        const row = k % ROWS
        const x = GRID_LEFT + col * (ITEM_W + SPACE_W)
        const y = GRID_TOP + row * (ITEM_H + SPACE_H)
        const f = idx === focus
        const dl = downloads.get(g.id)
        return (
          <div key={g.id} style={{ position: 'absolute', left: x, top: y, width: ITEM_W, height: ITEM_H, transform: f ? `scale(${(ITEM_W + 20) / ITEM_W}, ${(ITEM_H + 16) / ITEM_H})` : 'none', transition: 'transform 90ms', zIndex: f ? 1 : 0 }}>
            {/* focus: 00_h_comn_thumb_highlight.png around the item, GH_MYGAMESVIEW_LIST_ITEM_FOCUS_IMAGE_X_OFFSET -20 */}
            {f && <Nine src="GameHub/highlight/00_h_comn_thumb_highlight.png" slice={[30, 30, 30, 30]} x={-20} y={0} w={ITEM_W + 40} h={ITEM_H + 4} />}
            <img src={stubArt(`game-${g.id}-hot`, ITEM_W, 147, { label: g.name, size: 22 })} alt="" style={{ position: 'absolute', left: 0, top: 19, width: ITEM_W, height: 147 }} />
            <div style={{ position: 'absolute', left: 0, top: 146, width: ITEM_W, height: 43, background: 'rgba(0,0,0,0.6)' }} />
            <ScrollText text={g.name} scroll={f} style={{ position: 'absolute', left: 8, top: 152, width: 241, height: 31, lineHeight: '31px', fontSize: 20, color: f ? '#fdd911' : '#fff' }} />
            {installed.includes(g.id) && !dl && <img src={fw('GameHub/game/g_icon_installed.png')} alt="" style={{ position: 'absolute', right: 4, top: 23, width: 27, height: 27 }} />}
            {NEW_GAMES.has(g.id) && !installed.includes(g.id) && <img src={fw('GameHub/game/g_bullet_new.png')} alt="" style={{ position: 'absolute', right: 6, top: 19 }} />}
            {dl && <div style={{ position: 'absolute', left: 10, top: 136, width: ITEM_W - 20, height: 6, background: 'rgba(255,255,255,0.25)' }}><div style={{ width: `${dl.phase === 'installing' ? 100 : dl.progress}%`, height: '100%', background: '#23a7ff' }} /></div>}
            {editing && (
              <>
                <img src={fw('InfoLink3/images/checkBox/check_box_n.png')} alt="" style={{ position: 'absolute', left: 4, top: 23 }} />
                {checked.includes(g.id) && <img src={fw('InfoLink3/images/checkBox/check_icon.png')} alt="" style={{ position: 'absolute', left: 4, top: 23 }} />}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}

// CGHGamesViewInfoBar (GH_MOSTPOPULARVIEW_INFOBAR_WHOLE_RECT (42, 586) 864x134; lines at y 0 / 40 /
// 70 / 106): the focused game's name, genre, size and players.
function InfoBar({ game }: { game: StubGame }) {
  return (
    <div style={{ position: 'absolute', left: 42, top: 586, width: 864, height: 134 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 816, height: 39, fontSize: 26, lineHeight: '39px', color: '#4cdfff', whiteSpace: 'nowrap' }}>{game.name}</div>
      <div style={{ position: 'absolute', left: 0, top: 40, width: 816, height: 29, fontSize: 18, lineHeight: '29px' }}>Genre : {game.genre}</div>
      <div style={{ position: 'absolute', left: 0, top: 70, width: 816, height: 29, fontSize: 18, lineHeight: '29px' }}>Size : {game.sizeMB} MB</div>
    </div>
  )
}

function Detail({ game, installed, dl }: { game: StubGame; installed: boolean; dl?: { progress: number; phase: string } }) {
  const ox = 480
  const oy = 37
  const label = dl ? (dl.phase === 'installing' ? 'Installing' : 'Download') : installed ? 'Play' : game.free ? 'Download' : 'Buy'
  const stars = 1 + (hash(game.id) % 5)
  return (
    <>
      {/* the game's picture, GH_APPDETAIL_THUMBNAIL_ICON_RECT (30, 30) 457x267 */}
      <img src={stubArt(`game-${game.id}-hot`, 457, 267, { label: game.name, size: 34 })} alt="" style={{ position: 'absolute', left: 30, top: 30, width: 457, height: 267 }} />
      <div style={{ position: 'absolute', left: ox + 45, top: oy, width: 340, height: 49, fontSize: 30, lineHeight: '49px', whiteSpace: 'nowrap' }}>{game.name}</div>
      <div style={{ position: 'absolute', left: ox + 45, top: oy + 51, width: 704, height: 30, fontSize: 20, lineHeight: '30px', color: '#4cdfff' }}>{game.free ? 'Free' : 'Paid'}</div>
      {[`Genre : ${game.genre}`, `Size : ${game.sizeMB} MB`, `Players : ${game.players}`].map((t, i) => (
        <div key={i} style={{ position: 'absolute', left: ox + 45, top: oy + 79 + i * 28, width: 704, height: 30, fontSize: 18, lineHeight: '30px' }}>{t}</div>
      ))}
      {[45, 264, 482].map((x, i) => (
        <img key={i} src={stubArt(`game-${game.id}-ss${i}`, 195, 110, { label: false })} alt="" style={{ position: 'absolute', left: ox + x, top: oy + 197, width: 195, height: 110 }} />
      ))}
      <div style={{ position: 'absolute', left: ox + 45, top: oy + 320, width: 653, height: 97, fontSize: 18, lineHeight: '26px' }}>{game.description}</div>
      <div style={{ position: 'absolute', left: 516, top: 456, width: 177, height: 61 }}>
        <img src={fw('GameHub/button/detail_btn_264_high.png')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, lineHeight: '61px', textAlign: 'center', fontSize: 22 }}>{label}</div>
        {dl && (
          // the download bar under the button (t_ShowDownloadBar; line_progress_blue_* images)
          <div style={{ position: 'absolute', left: 0, top: 66, width: 177, height: 10 }}>
            <img src={fw('GameHub/progress/line_progress_blue_s_bg.png')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            <img src={fw('GameHub/progress/line_progress_blue_sel.png')} alt="" style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${dl.phase === 'installing' ? 100 : dl.progress}%` }} />
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 690, top: 456, width: 180, height: 61 }}>
        <img src={fw('GameHub/button/detail_btn_264.png')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', left: 20, top: 20, display: 'flex', gap: 4 }}>
          {[0, 1, 2, 3, 4].map(k => (
            <img key={k} src={fw(k < stars ? 'GameHub/game/icon_star_nor.png' : 'GameHub/game/icon_star_dim.png')} alt="" style={{ width: 21, height: 21 }} />
          ))}
        </div>
      </div>
    </>
  )
}

function GHMenu({ items, sel, checked }: { items: string[]; sel: number; checked?: number }) {
  const W = 320
  const H = items.length * 48 + 34
  return (
    <div style={{ position: 'absolute', left: 1280 - 46 - W, top: 67, width: W, height: H }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)' }} />
      <Nine src="GameHub/highlight/list_highlight.png" slice={[40, 42, 40, 42]} x={0} y={sel * 48} w={W} h={85} style={{ transition: 'top 90ms linear' }} />
      {items.map((t, i) => (
        <div key={t} style={{ position: 'absolute', left: 33, top: 27 + i * 48, width: W - 66, height: 30, lineHeight: '30px', fontSize: 24, color: i === sel ? '#fdd911' : '#fff', paddingLeft: checked !== undefined ? 40 : 0 }}>
          {checked === i && <img src={fw('InfoLink3/images/popup/list_check_icon.png')} alt="" style={{ position: 'absolute', left: 0, top: -1 }} />}
          {t}
        </div>
      ))}
    </div>
  )
}

function GHMessage({ text, buttons, sel }: { text: string; buttons: string[]; sel: number }) {
  const W = 600
  const lines = text.split('\n').length + Math.floor(text.length / 46)
  const textH = lines * 32 + 20
  const H = 40 + textH + (buttons.length ? 53 + 36 : 20)
  const bw = 150
  const bx = (W - buttons.length * bw - (buttons.length - 1) * 20) / 2
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ position: 'absolute', left: (1280 - W) / 2, top: (720 - H) / 2, width: W, height: H }}>
        <div style={{ position: 'absolute', inset: 2, background: 'rgba(30,32,36,0.95)' }} />
        <Nine src="GameHub/bg/message_popup_bg.png" slice={[20, 40, 20, 40]} x={0} y={0} w={W} h={H} />
        <div style={{ position: 'absolute', left: 30, top: 40, width: W - 60, height: textH, fontSize: 22, lineHeight: '32px', textAlign: 'center', whiteSpace: 'pre-line' }}>{text}</div>
        {buttons.map((b, i) => (
          <div key={b} style={{ position: 'absolute', left: bx + i * (bw + 20), top: 40 + textH, width: bw, height: 53 }}>
            <Nine src={`GameHub/button/${i === sel ? 'btn_focused' : 'btn_normal'}.PNG`} slice={[16, 16, 16, 16]} x={0} y={0} w={bw} h={53} />
            <div style={{ position: 'absolute', inset: 0, lineHeight: '53px', textAlign: 'center', fontSize: 22 }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
