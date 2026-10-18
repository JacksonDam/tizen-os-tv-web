import { useRemote } from '../../../input/remote'
import { stubArt, STUB_TITLES, type StubTitle } from '../../../shared/fictional'
import { openApp } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { MOVIES } from './data'
import { FLIP, FlipItem, type FlipTable } from './flip'
import { Glow, TextBox } from './kit'
import { registerOnlinePanel, useBodyFocus, type OnlinePanelProps } from './panels'

// Films and TV Shows online (CHomePreferredContentPanel, panel 2, ETableListType 5): the server's
// featured title and recommendations in a 3 x 4 table (m_InitializeTableInfo @02bd4234, CHomeOSDInfo
// GBHOME_PREFERRED_GRID_*): at (212, 176), columns 502 / 312 / 312 / 312 wide, 8 apart; 7 items:
//   0      the featured title, 502 x 752 (CONTENT_IMG_HEIGHT_0), caption at +754
//   1-3    recommended films, 312 x 468 (_1), caption at +470
//   4-6    recommended TV shows, 312 x 234 (_2) under them, caption at +236
// Over them the titles "Featured" (string 87) at (212, 132) and "Recommended" (g_HomePanelWStringEng 209)
// at (722, 132), 500 x 34, size 32, white at GBHOME_PREFERRED_GRID_TITLE_OPACITY 0.65. Captions size 28 at
// GBHOME_PREFERRED_GRID_ITEM_TITLE_OPACITY 0.8, 48 high. Content: the stub catalogue (STUB_TITLES) with
// generated posters.

const X0 = 212, Y0 = 176
const COLX = [212, 212 + 502 + 8, 212 + 502 + 8 + 320, 212 + 502 + 8 + 640]
const W = [502, 312, 312, 312]
const MID_H = 468, SMALL_H = 234, BIG_H = 752
const SMALL_Y = Y0 + MID_H + 48 + 2         // under the films' captions, GBHOME_PREFERRED_GRID_CELL_SPACING_Y 2
const CAP_H = 48                            // GBHOME_PREFERRED_GRID_ITEM_TXT_HEIGHT
const BOX_H = 56                            // GBHOME_PREFERRED_GRID_HIGHLIGHT_TEXT_BOX_HEIGHT
const ENL_W = 12, ENL_H = 8                 // GBHOME_PREFERRED_GRID_DATA_ENLARGED_*_DIFF
const GLOW_DX = -28, GLOW_DY = -31          // GBHOME_PREFERRED_GRID_FOCUS_IMAGE_X/Y_OFFSET

type Slot = { x: number; y: number; w: number; h: number; t: StubTitle }

// the item flip (flip.tsx): the table's cells, rows 234 / 282 / 282 high (GBHOME_PREFERRED_GRID_DATA_HEIGHT,
// + ITEM_TXT_HEIGHT) 0 then 2 apart; merged: column 0 rows 0-2 (featured), columns 1-3 rows 0-1 (films)
const ROW_Y = [Y0, Y0 + 234, SMALL_Y]
const ROW_H = [234, 282, 282]
const FLIP_TABLE: FlipTable = {
  layout: FLIP.movies,
  rect: k => ({ x: COLX[k % 4], y: ROW_Y[Math.floor(k / 4)], w: W[k % 4], h: ROW_H[Math.floor(k / 4)] }),
  merged: [[0, 4, 8], [1, 5], [2, 6], [3, 7]],
}

function featuredSlots(): Slot[] {
  const films = STUB_TITLES.filter(t => t.kind === 'movie')
  const shows = STUB_TITLES.filter(t => t.kind === 'show')
  return [
    { x: X0, y: Y0, w: W[0], h: BIG_H, t: films[0] },
    ...[1, 2, 3].map(c => ({ x: COLX[c], y: Y0, w: W[c], h: MID_H, t: films[c] })),
    ...[1, 2, 3].map(c => ({ x: COLX[c], y: SMALL_Y, w: W[c], h: SMALL_H, t: shows[c - 1] })),
  ]
}

// Key moves through the table (CCTableLayoutListControl, inferred from the geometry).
function step(i: number, key: 'Up' | 'Down' | 'Left' | 'Right'): number | null {
  if (i === 0) return key === 'Right' ? 1 : null
  const col = i <= 3 ? i : i - 3
  const top = i <= 3
  if (key === 'Left') return col === 1 ? 0 : i - 1
  if (key === 'Right') return col === 3 ? null : i + 1
  if (key === 'Up') return top ? null : i - 3
  return top ? i + 3 : null
}

export function MoviesPanel({ active, exitUp, exitDown, launch }: OnlinePanelProps) {
  const [focus, setFocus] = useBodyFocus('focus', 0)
  const slots = featuredSlots()
  const run = (fn: () => void) => (launch ? launch(fn) : fn())

  useRemote(key => {
    switch (key) {
      case 'Up':
      case 'Down':
      case 'Left':
      case 'Right': {
        const j = step(focus, key)
        if (j === null) {
          if (key === 'Up') exitUp()
          else if (key === 'Down') (exitDown ?? (() => playUi(UI_SOUND.NOKEY)))()
          else return false
          return true
        }
        playUi(UI_SOUND.MOVE)
        setFocus(j)
        return true
      }
      case 'Enter': {
        // the title's info page in Films and TV Shows (application 0xbf, CNOADetailViewBase)
        playUi(UI_SOUND.SELECT)
        const t = slots[focus].t
        run(() => openApp('movies2013', { detail: t.id, from: 'panel' }))
        return true
      }
      default:
        return false
    }
  }, active)

  const f = slots[focus]
  return (
    <div className="mvp">
      <div className="mvp__title" style={{ left: 212, top: 132 }}>Featured</div>
      <div className="mvp__title" style={{ left: 722, top: 132 }}>Recommended</div>
      {slots.map((s, i) => {
        const fo = active && focus === i
        const ex = fo ? ENL_W / 2 : 0, ey = fo ? ENL_H / 2 : 0
        return (
          <FlipItem key={s.t.id} table={FLIP_TABLE} cell={i <= 3 ? i : 8 + (i - 3)}>
            <div className="mvp__item" style={{ left: s.x - ex, top: s.y - ey, width: s.w + ex * 2, zIndex: fo ? 2 : 1 }}>
              <img src={stubArt(s.t.id, s.w, s.h, { label: s.t.title, size: Math.round(s.w * 0.09) })} alt="" style={{ height: s.h + ey * 2 }} />
              {fo ? <TextBox style={{ left: 0, top: s.h + ey * 2, width: s.w + ex * 2, height: BOX_H }} /> : null}
              <div className="mvp__cap" style={{ top: s.h + ey * 2 + 2, height: CAP_H, color: fo ? '#000' : 'rgba(255, 255, 255, 0.8)' }}>{s.t.title}</div>
            </div>
          </FlipItem>
        )
      })}
      <Glow x={f.x - ENL_W / 2} y={f.y - ENL_H / 2} w={f.w + ENL_W} h={f.h + ENL_H + BOX_H} dx={GLOW_DX} dy={GLOW_DY} show={active} />
    </div>
  )
}

registerOnlinePanel(MOVIES, MoviesPanel)
