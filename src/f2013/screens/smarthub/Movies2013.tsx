import { useState } from 'react'
import { useRemote } from '../../../input/remote'
import { stubArt, STUB_TITLES, type StubTitle } from '../../../shared/fictional'
import { openApp, registerApp, type AppProps } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getSetting, setSetting } from '../../tv/store'
import { IMG, MOVIES, PANELS } from './data'
import { GB, GBFrame } from './GBFrame'
import { VideoPlayer } from './MMBrowser'

// Films and TV Shows (exeDSP application 0xbf, the "NOA" content app: CNOAApp, CNOABrowserViewMgr,
// CNOAContentViewBase, CNOADetailViewBase), opened from the Smart Hub panel (an item's info page) or its
// sub menu (Favourites 1, Featured 5, Movies 4, TV Shows 3, Purchased 2: CHomeExecutor
// m_GetSubMenuItemEnum). It runs on the GoldenBridge 1280 x 720 layout (CNOAOSDInfo::t_Init1280x720
// @041c73c0), x 1.5. Titles, posters and synopses are the stub catalogue (STUB_TITLES); things the stub
// has no data for (age rating, director, cast, critics' score, social counts) are left out, as the
// firmware does for a title the server sends without them. Watch Now plays the title's stand-in loop in
// the Photos, Videos & Music player (the provider's own app is not run; inferred hand-over).

export type MoviesTab = 'favourites' | 'featured' | 'movies' | 'tvshows' | 'purchased'
export type MoviesParams = { tab?: MoviesTab; detail?: string; from?: 'panel' }

const NOA = `${IMG}/noa`
const TABS: MoviesTab[] = ['favourites', 'featured', 'movies', 'tvshows', 'purchased']
// g_HomePanelWStringEng 88, 87, 89, 90, 91 (the Smart Hub sub menu the colour tag came from)
const TAB_LABEL: Record<MoviesTab, string> = {
  favourites: 'Favourites', featured: 'Featured', movies: 'Movies', tvshows: 'TV Shows', purchased: 'Purchased',
}
const FAV_KEY = 'smarthub.favourites'

function favourites(): string[] {
  const v = getSetting<string>(FAV_KEY, '')
  return v ? v.split(',') : []
}
function titlesFor(tab: MoviesTab): StubTitle[] {
  if (tab === 'favourites') return favourites().map(id => STUB_TITLES.find(t => t.id === id)).filter((t): t is StubTitle => !!t)
  if (tab === 'movies') return STUB_TITLES.filter(t => t.kind === 'movie')
  if (tab === 'tvshows') return STUB_TITLES.filter(t => t.kind === 'show')
  if (tab === 'featured') return STUB_TITLES
  return [] // Purchased: no Samsung account, nothing bought
}
// empty views: g_NOAWStringEng 19 (with <<A>> = string 5 "♥") and 93
function emptyText(tab: MoviesTab) {
  return tab === 'favourites'
    ? 'Add items to your favourites by pressing the ♥ button on their individual info pages.'
    : 'No content found.'
}

// Content list (NOA_MOVIE_CONTENT_VIEW_*): 2 rows of 134 x 226 cells (the poster 128 x 192, focused
// 150 x 224), columns 1-9 of an 11-column list centred at (643, 384); the title on a strip at (3, 174),
// size 18. Page arrows at NOA_MOVIE_CONTENT_VIEW_RENDER_PAGE_LEFT/RIGHT_ARROW_X -638 / 591.
const L = { w: 134, h: 226, tw: 128, th: 192, fw: 150, fh: 224, rows: 2, cols: 9, cx: 643, cy: 384 }

function minutes(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`
}

export function Movies2013({ params, close }: AppProps) {
  const p = (params ?? {}) as MoviesParams
  const [tab, setTab] = useState<MoviesTab>(p.tab ?? 'featured')
  const [focus, setFocus] = useState(0)
  const [bar, setBar] = useState<number | null>(null)
  const [detail, setDetail] = useState<string | null>(p.detail ?? null)
  const [playing, setPlaying] = useState<StubTitle | null>(null)
  const [, bump] = useState(0)
  const items = titlesFor(tab)
  const toHub = () => openApp('smarthub', { panel: MOVIES })

  useRemote(key => {
    if (detail || playing) return false
    if (bar !== null) {
      switch (key) {
        case 'Left':
        case 'Right': {
          const j = bar + (key === 'Left' ? -1 : 1)
          if (j < 0 || j >= TABS.length) playUi(UI_SOUND.NOKEY)
          else {
            playUi(UI_SOUND.MOVE)
            setBar(j)
          }
          return true
        }
        case 'Enter':
          playUi(UI_SOUND.SELECT)
          setTab(TABS[bar])
          setFocus(0)
          setBar(null)
          return true
        case 'Up':
          if (items.length) {
            playUi(UI_SOUND.MOVE)
            setBar(null)
          } else playUi(UI_SOUND.NOKEY)
          return true
        case 'Back':
          playUi(UI_SOUND.BACK)
          setBar(null)
          return true
        case 'Exit':
          close()
          return true
        default:
          return true
      }
    }
    const per = L.rows * L.cols
    const page = Math.floor(focus / per)
    const c = focus % L.cols, r = Math.floor((focus % per) / L.cols)
    switch (key) {
      case 'Back':
        playUi(UI_SOUND.BACK)
        toHub()
        return true
      case 'Exit':
        close()
        return true
      case 'Left':
      case 'Right':
      case 'Up':
      case 'Down': {
        if (!items.length) {
          if (key === 'Down') {
            playUi(UI_SOUND.MOVE)
            setBar(TABS.indexOf(tab))
          } else playUi(UI_SOUND.NOKEY)
          return true
        }
        let j = focus
        if (key === 'Left') j = c > 0 ? focus - 1 : page > 0 ? focus - per + L.cols - 1 : -1
        if (key === 'Right') j = c < L.cols - 1 ? focus + 1 : focus + per - L.cols + 1
        if (key === 'Up') j = r > 0 ? focus - L.cols : -1
        if (key === 'Down') {
          if (r < L.rows - 1 && focus + L.cols < items.length) j = focus + L.cols
          else {
            playUi(UI_SOUND.MOVE)
            setBar(TABS.indexOf(tab))
            return true
          }
        }
        if (j < 0 || j >= items.length) {
          playUi(UI_SOUND.NOKEY)
          return true
        }
        playUi(UI_SOUND.MOVE)
        setFocus(j)
        return true
      }
      case 'Enter':
        if (items[focus]) {
          playUi(UI_SOUND.SELECT)
          setDetail(items[focus].id)
        }
        return true
      default:
        return false
    }
  })

  if (playing) {
    return (
      <VideoPlayer
        list={[{ id: playing.id, title: playing.title, kind: 'video', video: playing.video, seconds: playing.minutes * 60 }]}
        index={0}
        onIndex={() => {}}
        onReturn={() => setPlaying(null)}
        onExit={close}
      />
    )
  }
  if (detail) {
    const t = STUB_TITLES.find(x => x.id === detail)
    if (t) {
      return (
        <Detail
          t={t}
          onBack={() => {
            if (p.from === 'panel' && p.detail === detail) toHub()
            else setDetail(null)
          }}
          onExit={close}
          onWatch={() => setPlaying(t)}
          onOpen={id => setDetail(id)}
          onFavourite={() => bump(x => x + 1)}
        />
      )
    }
  }

  const per = L.rows * L.cols
  const page = Math.floor(focus / per)
  const pages = Math.max(1, Math.ceil(items.length / per))
  const shown = items.slice(page * per, page * per + per)
  const left = L.cx - (L.cols * L.w) / 2
  const top = L.cy - (L.rows * L.h) / 2
  return (
    <GBFrame
      panel={MOVIES}
      tabs={TABS.map(x => TAB_LABEL[x])}
      current={TABS.indexOf(tab)}
      barFocus={bar}
      focusSet="ma"
      bg={<MoviesBg />}
    >
      {items.length ? (
        <>
          <div className="nv__page" style={{ right: (1280 - 1253) * GB, top: 9 * GB, height: 60 * GB }}>{page + 1}/{pages}</div>
          {shown.map((t, k) => {
            const c = k % L.cols, r = Math.floor(k / L.cols)
            const f = bar === null && k === focus - page * per
            const tw = (f ? L.fw : L.tw) * GB, th = (f ? L.fh : L.th) * GB
            const x = (left + c * L.w + L.w / 2) * GB - tw / 2
            const y = (top + r * L.h + 3) * GB - (f ? (L.fh - L.th) * GB / 2 : 0)
            return (
              <div key={t.id} className="nv__cell" style={{ left: x, top: y, width: tw, zIndex: f ? 2 : 1 }}>
                <img src={stubArt(t.id, 256, 384, { label: t.title, size: 26 })} alt="" style={{ height: th }} />
                <div className="nv__title" style={{ fontSize: 18 * GB }}>{t.title}</div>
                {f ? <i className="mmb__focus" style={{ borderImageSource: `url("${IMG}/mm/thumb_high_focus.png")`, bottom: 30 }} /> : null}
              </div>
            )
          })}
          {page > 0 ? <img className="mmb__arrow" src={`${IMG}/mm/arrow_left_n.png`} alt="" style={{ left: (L.cx - 638) * GB, top: L.cy * GB - 44 }} /> : null}
          {page < pages - 1 ? <img className="mmb__arrow" src={`${IMG}/mm/arrow_right_n.png`} alt="" style={{ left: (L.cx + 591) * GB, top: L.cy * GB - 44 }} /> : null}
        </>
      ) : (
        // NOA_SHOW_NOFILE_TEXT (640, 360) centred, NOA_NOFILE_TEXT_FONTSIZE 26
        <div className="mmb__empty" style={{ top: 340 * GB, fontSize: 26 * GB, padding: '0 120px', boxSizing: 'border-box' }}>{emptyText(tab)}</div>
      )}
    </GBFrame>
  )
}

// The application's background: background3_1280.mir in the Films and TV Shows colours (inferred from the
// Smart Hub panel's HOMEPANEL_BACKGROUND_MIRAGE_COLOR, the CES footage's purple).
function MoviesBg() {
  const [a, b] = PANELS[MOVIES].bg.map(([r, g, bl]) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bl)})`)
  return <div className="nv__bg" style={{ background: `linear-gradient(to bottom, ${a}, ${b})` }} />
}

// ---- info page (CNOADetailViewBase, NOA_MOVIE_CONTENT_DETAIL_VIEW_*) ----
// Poster (40, 40) 266 x 400; title (332, 40) 853 x 50, size 42; the info line (332, 94), size 24; the
// synopsis (332, 230) 866 wide, size 26, rows 8 apart; buttons on y 329, 58 high: Watch Now (330, 190),
// Favourite (520, 62), Like (582, 140), Dislike (722, 140) (detail_btn_* images, *_high when focused);
// "Trailer" and "Related movies" (470, 506) titles over the bottom row, the related posters 82 x 122
// (88 x 154 cells) on y 622, separated by 2 x 126 lines at x 247 / 425 (y 548).
type DetailFocus = { row: 'btn' | 'low'; i: number }

function Detail({ t, onBack, onExit, onWatch, onOpen, onFavourite }: {
  t: StubTitle; onBack: () => void; onExit: () => void; onWatch: () => void; onOpen: (id: string) => void; onFavourite: () => void
}) {
  const [f, setF] = useState<DetailFocus>({ row: 'btn', i: 0 })
  const [fav, setFav] = useState(() => favourites().includes(t.id))
  const [vote, setVote] = useState<0 | 1 | -1>(0)
  const related = STUB_TITLES.filter(x => x.kind === t.kind && x.id !== t.id).slice(0, 8)
  const btns = 4
  const lowCount = 1 + related.length // trailer + related

  useRemote(key => {
    switch (key) {
      case 'Back':
        playUi(UI_SOUND.BACK)
        onBack()
        return true
      case 'Exit':
        onExit()
        return true
      case 'Left':
      case 'Right': {
        const n = f.row === 'btn' ? btns : lowCount
        const j = f.i + (key === 'Left' ? -1 : 1)
        if (j < 0 || j >= n) playUi(UI_SOUND.NOKEY)
        else {
          playUi(UI_SOUND.MOVE)
          setF({ ...f, i: j })
        }
        return true
      }
      case 'Up':
      case 'Down':
        if ((key === 'Down') === (f.row === 'btn')) {
          playUi(UI_SOUND.MOVE)
          setF({ row: f.row === 'btn' ? 'low' : 'btn', i: 0 })
        } else playUi(UI_SOUND.NOKEY)
        return true
      case 'Enter':
        playUi(UI_SOUND.SELECT)
        if (f.row === 'btn') {
          if (f.i === 0) onWatch()
          else if (f.i === 1) {
            const list = favourites()
            const next = fav ? list.filter(x => x !== t.id) : [...list, t.id]
            setSetting(FAV_KEY, next.join(','))
            setFav(!fav)
            onFavourite()
          } else setVote(v => (v === (f.i === 2 ? 1 : -1) ? 0 : f.i === 2 ? 1 : -1))
        } else if (f.i === 0) onWatch() // the trailer: the title's stand-in loop
        else onOpen(related[f.i - 1].id)
        return true
      default:
        return false
    }
  })

  const btnOn = (i: number) => f.row === 'btn' && f.i === i
  const info = [t.genre, String(t.year), t.kind === 'show' ? `${t.seasons ?? 1} Season${(t.seasons ?? 1) > 1 ? 's' : ''}` : `Duration : ${minutes(t.minutes)}`]
  return (
    <div className="nv">
      <MoviesBg />
      <img className="nv__poster" src={stubArt(t.id, 532, 800, { label: t.title, size: 44 })} alt="" style={{ left: 40 * GB, top: 40 * GB, width: 266 * GB, height: 400 * GB }} />
      <div className="nv__dtitle" style={{ left: 332 * GB, top: 40 * GB, width: 853 * GB, height: 50 * GB, fontSize: 42 * GB }}>{t.title}</div>
      <div className="nv__dinfo" style={{ left: 332 * GB, top: 94 * GB, width: 853 * GB, fontSize: 24 * GB }}>
        {info.map((s, i) => (
          <span key={i}>{i ? <i className="nv__bar" /> : null}{s}</span>
        ))}
      </div>
      <div className="nv__syn" style={{ left: 332 * GB, top: 230 * GB, width: 866 * GB, fontSize: 26 * GB }}>{t.synopsis}</div>
      <DBtn x={330} w={190} img="detail_btn_248" on={btnOn(0)} label="Watch Now" />
      <DBtn x={520} w={62} img="detail_btn_88" on={btnOn(1)} icon={fav ? 'icon_favorite.png' : 'icon_favorite_unselected.png'} />
      <DBtn x={582} w={140} img="detail_btn_154" on={btnOn(2)} icon="icon_recommendation_up.png" label={String(vote === 1 ? 1 : 0)} />
      <DBtn x={722} w={140} img="detail_btn_154" on={btnOn(3)} icon="icon_recommendation_down.png" label={String(vote === -1 ? 1 : 0)} />

      {/* bottom row: Trailer | Related */}
      <div className="nv__ltitle" style={{ left: 40 * GB, top: 506 * GB, fontSize: 22 * GB }}>Trailer</div>
      <div className={`nv__trailer${f.row === 'low' && f.i === 0 ? ' nv__trailer--on' : ''}`} style={{ left: 40 * GB, top: 548 * GB, width: 190 * GB, height: 112 * GB }}>
        <img src={stubArt(`${t.id}-trailer`, 380, 224, { label: false })} alt="" />
        <img className="nv__play" src={`${NOA}/trailers_play_nor.png`} alt="" />
      </div>
      <i className="nv__vline" style={{ left: 247 * GB, top: 548 * GB, height: 126 * GB }} />
      <div className="nv__ltitle" style={{ left: 270 * GB, top: 506 * GB, fontSize: 22 * GB }}>{t.kind === 'show' ? 'Related TV shows' : 'Related movies'}</div>
      {related.map((r, k) => {
        const on = f.row === 'low' && f.i === k + 1
        return (
          <div key={r.id} className="nv__rel" style={{ left: (270 + k * 88) * GB, top: 540 * GB, width: 82 * GB, zIndex: on ? 2 : 1 }}>
            <img src={stubArt(r.id, 164, 244, { label: r.title, size: 18 })} alt="" style={{ height: 122 * GB }} />
            <div style={{ fontSize: 20 * GB }}>{r.title}</div>
            {on ? <i className="mmb__focus" style={{ borderImageSource: `url("${IMG}/mm/thumb_high_focus.png")`, bottom: 40 }} /> : null}
          </div>
        )
      })}
      {f.row === 'low' && f.i === 0 ? <i className="mmb__focus" style={{ borderImageSource: `url("${IMG}/mm/thumb_high_focus.png")`, left: 40 * GB - 16, top: 548 * GB - 16, width: 190 * GB + 32, height: 112 * GB + 32, inset: 'auto' }} /> : null}
    </div>
  )
}

function DBtn({ x, w, img, on, label, icon }: { x: number; w: number; img: string; on: boolean; label?: string; icon?: string }) {
  return (
    <div className="nv__btn" style={{ left: x * GB, top: 329 * GB, width: w * GB, height: 58 * GB, fontSize: 24 * GB }}>
      <img src={`${NOA}/${img}${on ? '_high' : ''}.png`} alt="" />
      {icon ? <img className="nv__icon" src={`${NOA}/${icon}`} alt="" style={{ width: 30 * GB, height: 30 * GB }} /> : null}
      {label ? <span>{label}</span> : null}
    </div>
  )
}

registerApp({ id: 'movies2013', component: Movies2013, z: 210 })
