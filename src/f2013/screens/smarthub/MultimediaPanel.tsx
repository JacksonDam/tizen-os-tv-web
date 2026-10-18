import { useState } from 'react'
import { useRemote } from '../../../input/remote'
import { stubArt, STUB_POPULAR, type StubClip } from '../../../shared/fictional'
import { openApp } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { HP_SCALE, IMG, MULTIMEDIA } from './data'
import { Glow } from './kit'
import { registerOnlinePanel, type OnlinePanelProps } from './panels'

// Photos, Videos & Music online (CHomeMultimediaPanel, panel 7, ETableListType 10). Connected, the EU
// panel shows the server's "Most Popular" feed: four pages of 15 items (CHomeMultimediaPanel::
// m_RefreshContent @02c26250 steps the page 1-4), in a 3 x 5 table (m_InitializeTableInfo @02c23d0c,
// GBHOME_MULTIMEDIA_GRID_*): at (185, 265), cells 302 x 210, 10 / 18 apart. Above it the refresh button
// (170, 138, 82 x 82, mm_btn_refresh_n/s + the turning icon) and the title "Most Popular" (string 213) +
// "(%d/%d)" page / 4 at (248, 162), 454 x 43, size 30, Medium, 0xffdf5ed6 at
// GBHOME_ALLSHARE_TITLE_FONT_OPACITY 0.65 (m_CreateMMTitle @02c244cc, m_UpdateMMTitle @02c2468c). The
// content-provider logos row (185, 218) is drawn from each page's items' CP type
// (m_UpdateCPLogo @02c24b70); the stub feed carries no provider, so like an unknown CP type it stays
// empty. Items are stubs (STUB_POPULAR): videos play the stand-in loops, photos are generated art.

const GX = 185, GY = 265            // GBHOME_MULTIMEDIA_GRID_POS_X/Y
const CW = 302, CH = 210            // GBHOME_MULTIMEDIA_GRID_DATA_WIDTH/HEIGHT
const SW = 10, SH = 18              // GBHOME_MULTIMEDIA_GRID_CELL_SPACING_WIDTH/HEIGHT
const AREA_H = 170                  // GBHOME_MULTIMEDIA_GRID_ITEM_AREA_HEIGHT
const TEXT_X = 6, TEXT_Y = 170, TEXT_W = 302, TEXT_H = 40, TEXT_GAP = 6 // GBHOME_MULTIMEDIA_GRID_FOCUSED_TEXT_*
const ICON = 44, ICON_GAP = 6       // GBHOME_MULTIMEDIA_STATUS_ICON_WIDTH/HEIGHT, _GAP
const ENL_W = 10, ENL_H = 7         // GBHOME_MULTIMEDIA_GRID_DATA_ENLARGED_WIDTH/HEIGHT_DIFF
const GLOW_DX = -28, GLOW_DY = -30  // GBHOME_MULTIMEDIA_GRID_FOCUS_IMAGE_X/Y_OFFSET
const PAGES = 4, PER_PAGE = 15
const REFRESH = { x: 170, y: 138, w: 82 } // GBHOME_MULTIMEDIA_REFRESH_BUTTON_*

export function MultimediaPanel({ active, exitUp, exitDown, launch }: OnlinePanelProps) {
  const [page, setPage] = useState(1)
  const [focus, setFocus] = useState(0)          // item index on the page, -1 = refresh button
  const [spin, setSpin] = useState(0)
  const items = STUB_POPULAR.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const run = (fn: () => void) => (launch ? launch(fn) : fn())

  useRemote(key => {
    if (focus === -1) {
      // refresh button (CHomeMMInputListener): Down back to the table, Up to the top menu (inferred)
      if (key === 'Up') exitUp()
      else if (key === 'Down') {
        playUi(UI_SOUND.MOVE)
        setFocus(0)
      } else if (key === 'Enter') {
        // event 0x11907f: the icon turns (m_DoRefreshAni) and the next page comes in (m_RefreshContent)
        playUi(UI_SOUND.SELECT)
        setSpin(s => s + 1)
        setPage(p => (p < PAGES ? p + 1 : 1))
      } else if (key === 'Left' || key === 'Right') return false
      else return false
      return true
    }
    const c = focus % 5, r = Math.floor(focus / 5)
    switch (key) {
      case 'Left':
        if (c === 0) return false
        playUi(UI_SOUND.MOVE)
        setFocus(focus - 1)
        return true
      case 'Right':
        if (c === 4 || focus + 1 >= items.length) return false
        playUi(UI_SOUND.MOVE)
        setFocus(focus + 1)
        return true
      case 'Up':
        if (r === 0) {
          // the refresh button sits above the table's first column (inferred move)
          playUi(UI_SOUND.MOVE)
          setFocus(-1)
          return true
        }
        playUi(UI_SOUND.MOVE)
        setFocus(focus - 5)
        return true
      case 'Down':
        if (r === 2 || focus + 5 >= items.length) {
          ;(exitDown ?? (() => playUi(UI_SOUND.NOKEY)))()
          return true
        }
        playUi(UI_SOUND.MOVE)
        setFocus(focus + 5)
        return true
      case 'Enter': {
        // CHomeExecutor::m_ExecuteMMCPServiceItem: the item plays in the Photos, Videos & Music player
        playUi(UI_SOUND.SELECT)
        const it = items[focus]
        if (it) run(() => openApp('mmbrowser', { play: it, list: items, from: MULTIMEDIA }))
        return true
      }
      default:
        return false
    }
  }, active)

  const fc = focus % 5, fr = Math.floor(focus / 5)
  const cellX = (c: number) => GX + (CW + SW) * c
  const cellY = (r: number) => GY + (CH + SH) * r
  return (
    <div className="mmp">
      <div className={`mmp__refresh${active && focus === -1 ? ' mmp__refresh--focus' : ''}`} style={{ left: REFRESH.x, top: REFRESH.y, width: REFRESH.w, height: REFRESH.w }}>
        <img src={`${IMG}/icon/mm_btn_refresh_${active && focus === -1 ? 's' : 'n'}.png`} alt="" />
        <img key={spin} className={spin ? 'mmp__spin' : ''} src={`${IMG}/icon/mm_btn_refresh_icon.png`} alt="" />
      </div>
      <div className="mmp__title">Most Popular({page}/{PAGES})</div>
      {items.map((it, i) => {
        const c = i % 5, r = Math.floor(i / 5)
        const f = active && focus === i
        return <Cell key={it.id} it={it} x={cellX(c) - (f ? ENL_W / 2 : 0)} y={cellY(r) - (f ? ENL_H / 2 : 0)} focused={f} />
      })}
      <Glow
        x={focus === -1 ? REFRESH.x : cellX(fc) - ENL_W / 2}
        y={focus === -1 ? REFRESH.y : cellY(fr) - ENL_H / 2}
        w={focus === -1 ? REFRESH.w : CW + ENL_W}
        h={focus === -1 ? REFRESH.w : CH + ENL_H}
        dx={focus === -1 ? -25 : GLOW_DX}
        dy={focus === -1 ? -25 : GLOW_DY}
        show={active && focus !== -1}
      />
    </div>
  )
}

// CHomeMultimediaListItemRenderer (t_OnCreate @02c23434, t_OnUpdate @02c23100): a white plate at
// GBHOME_ALLSHARE_ITEM_THUMBNAIL_BACKGROUND_OPACITY 0.1 under the 302 x 170 picture (the server's, else
// thumbnail/13_mm_h_default_{video,photo,music}.png), the content-type icon (contents_*.PNG, 44 x 44)
// 6 px in from the top-right corner, and the title on a black box at (6, 170) 302 x 40: SVD Light 28,
// white, centred, scrolling when focused.
function Cell({ it, x, y, focused }: { it: StubClip; x: number; y: number; focused: boolean }) {
  const w = CW + (focused ? ENL_W : 0)
  const h = AREA_H + (focused ? ENL_H : 0)
  return (
    <div className="mmp__cell" style={{ left: x, top: y, width: w, zIndex: focused ? 2 : 1 }}>
      <div className="mmp__plate" style={{ height: h }} />
      <img className="mmp__thumb" style={{ height: h }} src={stubArt(it.id, CW, AREA_H, { label: false })} alt="" />
      <img
        className="mmp__type"
        src={`${IMG}/icon/contents_${it.kind}.PNG`}
        alt=""
        style={{ left: w - ICON - ICON_GAP, top: ICON_GAP, width: 29 * HP_SCALE, height: 29 * HP_SCALE }}
      />
      <div className="mmp__tbg" style={{ left: TEXT_X, top: TEXT_Y + h - AREA_H, width: TEXT_W + (focused ? ENL_W : 0) - TEXT_X, height: TEXT_H }} />
      <div className={`mmp__text${focused ? ' mmp__text--scroll' : ''}`} style={{ left: TEXT_X + TEXT_GAP, top: TEXT_Y + h - AREA_H, width: TEXT_W - TEXT_GAP * 2, height: TEXT_H }}>
        <span>{it.title}</span>
      </div>
    </div>
  )
}

registerOnlinePanel(MULTIMEDIA, MultimediaPanel)
