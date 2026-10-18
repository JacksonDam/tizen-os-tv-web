import { useRef, useState, type CSSProperties } from 'react'
import { stubArt } from '../../../../../shared/fictional'
import { useRemote } from '../../../../../input/remote'
import { openApp } from '../../../../shell'
import { playUi, UI_SOUND } from '../../../../tv/sound'
import { getSetting } from '../../../../tv/store'
import { APPS } from '../../data'
import type { OnlinePanelProps } from '../../panels'
import { fw, LIGHT, MEDIUM } from '../hubapps/assets'
import {
  appById, PROMOTED, RECOMMENDED, SAMSUNG_APPS, startDownload, useDownloads, useInstalled, useLocked,
  type Download,
} from '../hubapps/catalog'
import { ScrollText } from '../hubapps/ScrollText'
import type { RunParams } from '../hubapps/AppRunner'

// The Apps panel online (CHomeAppServicePanel, panel id 3): two CHomeTableLayoutListControls drawn by
// CHomeAppServiceListItemRenderer. Values: CHomeOSDInfo::t_InitResolution @02bf32bc (scale 1 at Full
// HD) and t_InitFullHDResolution @02bf4da8; m_InitializePanel @02bec8fc, m_InitializeTableInfo
// @02be7b2c; renderer t_OnCreate @02be6fcc, t_OnUpdate @02be9d48, m_ShowDefaultIcon @02be97b0,
// t_OnFocusIn @02be9c10. Spec: samsung-tv-qemu/extract/f13/spec/online-apps2013.md.
//   Recommended: 1 row x 10 columns at (116, 202), cells 160x186, 10 px apart; 9 data cells, the last
//     one merged over columns 8-9 (the promotion, "PIA").
//   My Apps: 3 rows x 10 at (116, 468), cells 160x160; 30 cells, empty ones drawn and focusable.
const GRID_X = 116             // GBHOME_APPS_GRID_POS_X
const MAIN_Y = 202             // GBHOME_APPS_MAIN_GRID_POS_Y
const SUB_Y = 468              // GBHOME_APPS_SUB_GRID_POS_Y
const CELL_W = 160             // GBHOME_APPS_GRID_DATA_WIDTH
const MAIN_H = 186             // GBHOME_APPS_MAIN_GRID_DATA_HEIGHT
const SUB_H = 160              // GBHOME_APPS_SUB_GRID_DATA_HEIGHT
const GAP = 10                 // GBHOME_APPS_GRID_CELL_SPACING
const COLS = 10                // GBHOME_APPS_MAIN/SUB_GRID_LAYOUT_COL
const SUB_ROWS = 3             // GBHOME_APPS_SUB_GRID_LAYOUT_ROW
const PIA_INDEX = 8            // the merged cell (mergence {row 0, col 8} - {row 0, col 9})
const TITLE_X = 114            // GBHOME_APPS_MAIN/SUB_GRID_TITLE_TEXT_POS_X
const ICON_W = 106             // GBHOME_APPS_ITEM_CONTENT_IMG_WIDTH
const ICON_H = 87              // GBHOME_APPS_ITEM_CONTENT_IMG_HEIGHT
const ENLARGE_W = 12           // GBHOME_APPS_GRID_DATA_ENLARGED_WIDTH_DIFF
const ENLARGE_H = 8            // GBHOME_APPS_MAIN/SUB_GRID_DATA_ENLARGED_HEIGHT_DIFF
const FOCUS_OFF = 27           // GBHOME_APPS_GRID_FOCUS_IMAGE_X/Y_OFFSET (-27)
const ANI_MS = 250             // GBHOME_COMMON_GRID_ANIMATION_DURATION

type Table = 'rec' | 'my'
type Pos = { t: Table; i: number }

function cellRect(t: Table, i: number) {
  if (t === 'rec') {
    const w = i === PIA_INDEX ? CELL_W * 2 + GAP : CELL_W
    return { x: GRID_X + i * (CELL_W + GAP), y: MAIN_Y, w, h: MAIN_H }
  }
  return { x: GRID_X + (i % COLS) * (CELL_W + GAP), y: SUB_Y + Math.floor(i / COLS) * (SUB_H + GAP), w: CELL_W, h: SUB_H }
}

// App icon: the server's 106x87 icon; here the stub artwork with the app's first word.
export function appIcon(id: string, name: string) {
  const word = id === SAMSUNG_APPS ? 'Samsung Apps' : name.split(' ')[0]
  return stubArt(id, ICON_W, ICON_H, { label: word, size: word.length > 9 ? 14 : 18 })
}

export function AppsPanel({ active, exitUp, exitDown, launch }: OnlinePanelProps) {
  const installed = useInstalled()
  const locked = useLocked()
  const downloads = useDownloads()
  const myApps = installed.slice(0, SUB_ROWS * COLS)
  const [pos, setPos] = useState<Pos>({ t: 'rec', i: 0 })
  const posRef = useRef(pos)
  posRef.current = pos
  // the column the focus entered the merged promotion cell from, to go back down the same column
  const piaCol = useRef(PIA_INDEX)
  // "Ad" outside the US, "Sponsored" in the US (m_InitializePanel: country code "US" -> string 0xdc)
  const piaLabel = getSetting<string>('country', 'United Kingdom') === 'USA' ? 'Sponsored' : 'Ad'

  function move(p: Pos) {
    playUi(UI_SOUND.MOVE)
    setPos(p)
  }

  function run(id: string) {
    const app = appById(id)
    if (!app) return
    const go = () => openApp('hubapp', { id, name: app.name, from: APPS } satisfies RunParams)
    if (launch) launch(go)
    else go()
  }

  function enter() {
    const { t, i } = posRef.current
    if (t === 'rec') {
      if (i === PIA_INDEX) {
        // "Press Enter for more information": the promoted app's page in Samsung Apps
        playUi(UI_SOUND.SELECT)
        const go = () => openApp('hubapp', { id: SAMSUNG_APPS, name: 'Samsung Apps', from: APPS } satisfies RunParams)
        if (launch) launch(go)
        else go()
        return
      }
      const id = RECOMMENDED[i]
      if (!id) return playUi(UI_SOUND.CANCEL)
      if (downloads.has(id)) return playUi(UI_SOUND.CANCEL) // CheckItemExcutable: not while downloading
      playUi(UI_SOUND.SELECT)
      if (id === SAMSUNG_APPS || installed.includes(id)) run(id)
      else startDownload(id, 'app') // the item downloads in place (renderer state 3, m_SetDownloaingState)
      return
    }
    const id = myApps[i]
    if (!id) return playUi(UI_SOUND.CANCEL) // an empty cell has no content: sound 9
    playUi(UI_SOUND.SELECT)
    run(id)
  }

  useRemote(key => {
    const { t, i } = posRef.current
    switch (key) {
      case 'Left':
        if (t === 'rec') {
          if (i === 0) return false // IfMoveOut left: the carousel turns (0x11900f)
          move({ t, i: i - 1 })
          return true
        }
        if (i % COLS === 0) return false
        move({ t, i: i - 1 })
        return true
      case 'Right':
        if (t === 'rec') {
          if (i === PIA_INDEX) return false // 0x119010
          if (i + 1 === PIA_INDEX) piaCol.current = PIA_INDEX
          move({ t, i: i + 1 })
          return true
        }
        if (i % COLS === COLS - 1) return false
        move({ t, i: i + 1 })
        return true
      case 'Up':
        if (t === 'rec') {
          playUi(UI_SOUND.MOVE) // IfMoveOut up: 0x119012 with sound 16
          exitUp()
          return true
        }
        if (i < COLS) {
          const col = i
          playUi(UI_SOUND.MOVE)
          if (col >= PIA_INDEX) piaCol.current = col
          setPos({ t: 'rec', i: Math.min(col, PIA_INDEX) })
          return true
        }
        move({ t, i: i - COLS })
        return true
      case 'Down':
        if (t === 'rec') {
          playUi(UI_SOUND.MOVE) // 0x119011: on to the My Apps table, same column (inferred)
          setPos({ t: 'my', i: i === PIA_INDEX ? piaCol.current : i })
          return true
        }
        if (i + COLS < SUB_ROWS * COLS) {
          move({ t, i: i + COLS })
          return true
        }
        playUi(UI_SOUND.MOVE)
        exitDown?.()
        return true
      case 'Enter':
        enter()
        return true
      case 'Tools':
        // TOOLS on an item (event 0x29 -> 0x119075 -> CHomeExecutor::ExecuteAppsEditMode): More Apps in
        // its edit mode
        playUi(UI_SOUND.SELECT)
        openApp('moreapps', { edit: true, from: APPS })
        return true
      default:
        return false
    }
  }, active)

  // the focus stays where it was while the top menu or the sub menu has the keys, and is shown again
  // when the body gets them back (CHomeTableLayoutListControl SetPrevFocusFlag / HasPrevFocusFlag)
  const focus = active ? pos : null
  return (
    <div className="hub">
      {/* "Recommended" (0x35) and "My Apps" (0x36): 500x38, size 32, Medium, left/middle, 0xff3ba9c2 at
          GBHOME_APPS_GRID_TITLE_FONT_OPACITY 0.7 */}
      <Title x={TITLE_X} y={160} text="Recommended" />
      <Title x={TITLE_X} y={426} text="My Apps" />
      {Array.from({ length: PIA_INDEX + 1 }, (_, i) => {
        const r = cellRect('rec', i)
        const focused = focus?.t === 'rec' && focus.i === i
        if (i === PIA_INDEX) return <PiaCell key={i} r={r} focused={focused} label={piaLabel} />
        const id = RECOMMENDED[i]
        const app = id ? appById(id) : undefined
        return (
          <AppCell
            key={i} r={r} focused={focused} kind="rec"
            id={id} name={app?.name} locked={!!id && locked.includes(id)} download={id ? downloads.get(id) : undefined}
          />
        )
      })}
      {Array.from({ length: SUB_ROWS * COLS }, (_, i) => {
        const id = myApps[i]
        const app = id ? appById(id) : undefined
        return (
          <AppCell
            key={`m${i}`} r={cellRect('my', i)} focused={focus?.t === 'my' && focus.i === i} kind="my"
            id={id} name={app?.name} locked={!!id && locked.includes(id)} download={undefined}
          />
        )
      })}
      {focus && <Highlight table={focus.t} r={cellRect(focus.t, focus.i)} />}
    </div>
  )
}

function Title({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div
      className="hub-abs"
      style={{ left: x, top: y, width: 500, height: 38, lineHeight: '38px', fontSize: 32, fontWeight: MEDIUM, color: '#3ba9c2', opacity: 0.7, whiteSpace: 'nowrap' }}
    >
      {text}
    </div>
  )
}

// The focus image (table image 0 = highlight_all.png) around the focused cell, which grows by
// GBHOME_APPS_GRID_DATA_ENLARGED_WIDTH/HEIGHT_DIFF; it slides from cell to cell within a table over
// GBHOME_COMMON_GRID_ANIMATION_DURATION (each table has its own, so it jumps between the tables).
function Highlight({ table, r }: { table: Table; r: { x: number; y: number; w: number; h: number } }) {
  const x = r.x - ENLARGE_W / 2 - FOCUS_OFF
  const y = r.y - ENLARGE_H / 2 - FOCUS_OFF
  const w = r.w + ENLARGE_W + FOCUS_OFF * 2
  const h = r.h + ENLARGE_H + FOCUS_OFF * 2
  return (
    <div
      key={table}
      className="hub-focus"
      style={{
        left: x, top: y, width: w, height: h,
        borderImageSource: `url(${fw('HomePanel/icon/highlight_all.png')})`,
        transition: `left ${ANI_MS}ms, top ${ANI_MS}ms, width ${ANI_MS}ms, height ${ANI_MS}ms`,
      }}
    />
  )
}

type R = { x: number; y: number; w: number; h: number }

function AppCell({ r, focused, kind, id, name, locked, download }: {
  r: R; focused: boolean; kind: 'rec' | 'my'; id?: string; name?: string; locked: boolean; download?: Download
}) {
  const has = !!id && !!name
  // the focused cell is drawn enlarged (inferred: the background grows, the content stays centred)
  const ex = focused ? ENLARGE_W / 2 : 0
  const ey = focused ? ENLARGE_H / 2 : 0
  const iconY = kind === 'rec' ? 38 : 32         // GBHOME_APPS_MAIN_GRID_RECOMMEND/MYAPPS_ITEM_POS
  const textY = kind === 'rec' ? 136 : 124       // GBHOME_APPS_MAIN_GRID_RECOMMEND/MYAPPS_ITEM_TXT_POS_Y
  const dl = download
  return (
    <div className="hub-cell" style={{ left: r.x - ex, top: r.y - ey, width: r.w + ex * 2, height: r.h + ey * 2, transition: `all ${ANI_MS}ms` }}>
      <div className="hub-cell__bg" style={{ opacity: has ? 0.15 : 0.06 }} />
      {has && (
        <div className="hub-abs" style={{ left: ex, top: ey, width: r.w, height: r.h }}>
          <img className="hub-cell__icon" src={appIcon(id!, name!)} alt="" style={{ left: 27, top: iconY, width: ICON_W, height: ICON_H }} />
          {/* title: CCTextAniDrawing 148x26 (GBHOME_APPS_MAIN_GRID_ITEM_TXT_WIDTH 160 - 2 x 6) at x 6, size 24,
              Light, centred; white, 0xfffdd911 and scrolling while focused */}
          <ScrollText
            className="hub-cell__text"
            text={name!}
            scroll={focused && !dl}
            style={{ left: 6, top: textY, width: 148, height: 26, lineHeight: '26px', fontSize: 24, fontWeight: LIGHT, color: focused && !dl ? '#fdd911' : '#fff' }}
          />
          {/* badges (GBHOME_APPS_ITEM_ICON_IMAGE_SIZE 28 boxes from the right edge, 4 px in): lock first */}
          {locked && !dl && (
            <img className="hub-cell__badge" src={fw('HomePanel/apps/icon_apps_lock.png')} alt="" style={{ left: r.w - 4 - 28, top: 4 }} />
          )}
          {dl && (
            <>
              {/* states 2/3: a black rectangle at 1 - GBHOME_APPS_MAIN_GRID_ITEM_UPDATING_ALPHA (0.7) and, while
                  downloading, the progress bar (apps_progress_wh_bg.png / apps_progress.png composites) at
                  GBHOME_APPS_MAIN/SUB_GRID_ITEM_PROGRESS_POS (32, 100 / 96), 96x20 */}
              <div className="hub-cell__dim" style={{ opacity: 0.7 }} />
              <div className="hub-progress" style={{ left: 32, top: kind === 'rec' ? 100 : 96, width: 96, height: 20, borderImage: `url(${fw('HomePanel/progress/apps_progress_wh_bg.png')}) 6 5 fill` }} />
              {dl.progress > 0 && (
                <div className="hub-progress" style={{ left: 32, top: kind === 'rec' ? 100 : 96, width: Math.max(10, (96 * dl.progress) / 100), height: 20, borderImage: `url(${fw('HomePanel/progress/apps_progress.png')}) 6 5 fill` }} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// The promotion (PIA, renderer user type 1) in the merged cell: the server's banner image; here a stub
// banner for the promoted app. Its label "Ad" (0xdd; "Sponsored" 0xdc in the US) is a separate text
// drawing at HOMEPANEL_PIA_LABEL_X/Y (1545, 368), 190x21, size 16, right/middle, 0xffffff7f at
// GBHOME_APPS_PIA_TEXT_OPACITY 0.5.
function PiaCell({ r, focused, label }: { r: R; focused: boolean; label: string }) {
  const app = appById(PROMOTED)
  const ex = focused ? ENLARGE_W / 2 : 0
  const ey = focused ? ENLARGE_H / 2 : 0
  const style: CSSProperties = { left: r.x - ex, top: r.y - ey, width: r.w + ex * 2, height: r.h + ey * 2, transition: `all ${ANI_MS}ms` }
  return (
    <>
      <div className="hub-cell" style={style}>
        <div className="hub-cell__bg" style={{ opacity: 0.15 }} />
        <img src={stubArt(`pia-${PROMOTED}`, r.w, r.h, { label: app?.name ?? '', size: 30 })} alt="" style={{ position: 'absolute', left: ex, top: ey, width: r.w, height: r.h }} />
      </div>
      <div className="hub-abs" style={{ left: 1545, top: 368, width: 190, height: 21, lineHeight: '21px', fontSize: 16, textAlign: 'right', color: '#ffff7f', opacity: 0.5, fontWeight: MEDIUM }}>
        {label}
      </div>
    </>
  )
}
