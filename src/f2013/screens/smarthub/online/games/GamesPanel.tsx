import { useRef, useState } from 'react'
import { STUB_GAMES, stubArt } from '../../../../../shared/fictional'
import { useRemote } from '../../../../../input/remote'
import { openApp } from '../../../../shell'
import { playUi, UI_SOUND } from '../../../../tv/sound'
import type { OnlinePanelProps } from '../../panels'
import { fw, MEDIUM } from '../hubapps/assets'
import { useDownloads, useInstalledGames } from '../hubapps/catalog'
import type { HubParams } from './GameHub'

// The Games panel online (CHomeGamesServicePanel, panel id 6): one CHomeTableLayoutListControl of the
// server's eight recommended games drawn by CHomeGamesListItemRenderer. m_InitializeTableInfo @02c1fb84,
// m_InitializePanel @02c20168, renderer t_OnCreate @02c20eec / t_OnUpdate @02c21ef0; values from
// CHomeOSDInfo::t_InitFullHDResolution @02bf4da8. Spec: samsung-tv-qemu/extract/f13/spec/online-apps2013.md.
//   Grid at (154, 191), 4 columns x 3 rows, cells 382x215, 28 px apart horizontally, rows 16 then 38
//   apart; rows 0-1 of every column are merged (m_MergeGamesPanelCell), so the panel shows four tall
//   "hot" cells (382x446) over four small ones (382x215 at y 675).
//   "Recommended" (0xd1) at GBHOME_GAMES_BRANDING_POS (154, 140), 226x41, size 32, 0xff08a150, Medium.
//   Cell types (m_SetDifferItemUIInfo): 0 = items 0-3 (blank_games_hot.png until the server image
//   arrives), 2 = item 4, 1 = items 5-6, 2 = item 7 (blank_games_new.png).
//   Per item: the game's logo bottom-centred, the "new" bullet g_bullet_new.png at (323, -2), the
//   installed icon g_icon_installed.png at (337, 401 / 170), the download/install progress bar at
//   (20, item h - 20 - 14), item w - 40 wide (00_h_common_progress_bg / 00_h_common_progres.png).
// HomePanel bitmaps draw at 1.5x on the Full HD OSD (blank_games_hot.png 256x298 fills the 382x446 cell).

const X = 154
const Y = 191
const W = 382
const H_SMALL = 215
const H_BIG = 446
const GAP_X = 28
const SMALL_Y = Y + H_SMALL + 16 + H_SMALL + 38 // 675
const FOCUS_X = 25   // GBHOME_GAMES_GRID_FOCUS_IMAGE_X_OFFSET (-25)
const FOCUS_Y = 28   // GBHOME_GAMES_GRID_FOCUS_IMAGE_Y_OFFSET (-28)
const ENLARGE_W = 6  // GBHOME_GAMES_GRID_DATA_ENLARGED_WIDTH_DIFF
const ENLARGE_H = 4  // GBHOME_GAMES_GRID_DATA_ENLARGED_HEIGHT_DIFF
const ANI_MS = 250   // GBHOME_COMMON_GRID_ANIMATION_DURATION

// The server's recommended games (fictional): the eight stub games in catalogue order; content type 4
// ("new", g_bullet_new.png) on two of them.
export const NEW_GAMES = new Set(['reef-runner', 'quiz-night'])

function rect(i: number) {
  const col = i % 4
  const big = i < 4
  return { x: X + col * (W + GAP_X), y: big ? Y : SMALL_Y, w: W, h: big ? H_BIG : H_SMALL }
}

export function GamesPanel({ active, exitUp, exitDown, launch }: OnlinePanelProps) {
  const installed = useInstalledGames()
  const downloads = useDownloads()
  const [i, setI] = useState(0)
  const ref = useRef(i)
  ref.current = i

  function move(n: number) {
    playUi(UI_SOUND.MOVE)
    setI(n)
  }

  useRemote(key => {
    const cur = ref.current
    const col = cur % 4
    const big = cur < 4
    switch (key) {
      case 'Left':
        if (col === 0) return false // the carousel turns
        move(cur - 1)
        return true
      case 'Right':
        if (col === 3) return false
        move(cur + 1)
        return true
      case 'Up':
        if (big) {
          exitUp()
          return true
        }
        move(col)
        return true
      case 'Down':
        if (big) {
          move(col + 4)
          return true
        }
        exitDown?.()
        return true
      case 'Enter': {
        // a game item runs the Game Hub (app 0xd6) on that game's details (CHomeExecutorData type 1 with
        // the content id -> CGHApp::m_GetStartViewInfo view 0x20130837)
        const g = STUB_GAMES[cur]
        if (!g) return playUi(UI_SOUND.CANCEL), true
        playUi(UI_SOUND.SELECT)
        const go = () => openApp('gamehub', { view: 'detail', game: g.id } satisfies HubParams)
        if (launch) launch(go)
        else go()
        return true
      }
      default:
        return false
    }
  }, active)

  const focus = active ? rect(i) : null
  return (
    <div className="hub">
      <div
        className="hub-abs"
        style={{ left: 154, top: 140, width: 226, height: 41, lineHeight: '41px', fontSize: 32, fontWeight: MEDIUM, color: '#08a150', whiteSpace: 'nowrap' }}
      >
        Recommended
      </div>
      {STUB_GAMES.slice(0, 8).map((g, k) => {
        const r = rect(k)
        const big = k < 4
        const focused = active && i === k
        const ex = focused ? ENLARGE_W / 2 : 0
        const ey = focused ? ENLARGE_H / 2 : 0
        const dl = downloads.get(g.id)
        const isInstalled = installed.includes(g.id)
        return (
          <div key={g.id} className="hub-cell" style={{ left: r.x - ex, top: r.y - ey, width: r.w + 2 * ex, height: r.h + 2 * ey, transition: `all ${ANI_MS}ms` }}>
            <img src={fw(big ? 'HomePanel/thumbnail/blank_games_hot.png' : 'HomePanel/thumbnail/blank_games_new.png')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            <img src={stubArt(`game-${g.id}-${big ? 'hot' : 'new'}`, W, big ? H_BIG : H_SMALL, { label: g.name, size: big ? 40 : 30 })} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {NEW_GAMES.has(g.id) && <img src={fw('HomePanel/icon/g_bullet_new.png')} alt="" style={{ position: 'absolute', left: 323, top: -2, width: 53, height: 38 }} />}
            {isInstalled && !dl && <img src={fw('HomePanel/icon/g_icon_installed.png')} alt="" style={{ position: 'absolute', left: 337, top: big ? 401 : 170, width: 45, height: 45 }} />}
            {dl && (
              <>
                <div className="hub-progress" style={{ left: 20, top: r.h - 20 - 14, width: W - 40, height: 14, borderWidth: '6px 7px', borderImage: `url(${fw(dl.phase === 'installing' ? 'HomePanel/progress/00_h_common_progress_installing_bg.png' : 'HomePanel/progress/00_h_common_progress_bg.png')}) 4 5 fill` }} />
                {dl.phase === 'downloading' && dl.progress >= 10 && (
                  <div className="hub-progress" style={{ left: 20, top: r.h - 20 - 14, width: ((W - 40) * dl.progress) / 100, height: 14, borderWidth: '6px 7px', borderImage: `url(${fw('HomePanel/progress/00_h_common_progres.png')}) 4 5 fill` }} />
                )}
                {dl.phase === 'installing' && (
                  // installing: the moving 00_h_common_progress_installing.png (69x12) over the bar
                  <div style={{ position: 'absolute', left: 20, top: r.h - 20 - 14, width: W - 40, height: 14, overflow: 'hidden' }}>
                    <img src={fw('HomePanel/progress/00_h_common_progress_installing.png')} alt="" style={{ position: 'absolute', top: -2, height: 18, animation: 'hub-installing 1200ms linear infinite' }} />
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
      {focus && (
        <div
          className="hub-focus"
          style={{
            left: focus.x - ENLARGE_W / 2 - FOCUS_X, top: focus.y - ENLARGE_H / 2 - FOCUS_Y,
            width: focus.w + ENLARGE_W + 2 * FOCUS_X, height: focus.h + ENLARGE_H + 2 * FOCUS_Y,
            borderImageSource: `url(${fw('HomePanel/icon/highlight_all.png')})`,
            transition: `left ${ANI_MS}ms, top ${ANI_MS}ms, width ${ANI_MS}ms, height ${ANI_MS}ms`,
          }}
        />
      )}
    </div>
  )
}
