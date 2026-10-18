import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { APPS, GAMES, MOVIES, MULTIMEDIA, ONTV, PERSPECTIVE } from './data'

// The item flip ("origami") of the Smart Hub tables. Spec: samsung-tv-qemu/extract/f13/spec/
// online-smarthub2013.md, "Item flip".
//
// Every panel table (CHomeTableLayoutListControl over the toolkit's CCTableLayoutListControl) gets a
// second layout from its panel's m_InitializeTableInfo (TableLayoutListControlUIInfo +0x80, added by
// CHomeUtil::CreateTableLayoutListControl @046b67a8 -> CCTableLayoutListControl::AddLayout @04615f04): per
// cell a position offset, an alpha, a rotation and a link. When Smart Hub hands over to an item it runs
// (CHomePanelWindowBase::OnBeginMinimizeWindow @02bc048c) the centred panel's tables play layout 1
// (CHomeTableLayoutListControl::PlayFlipAnimation @0469bfa0 -> PlayLayoutAnimation @046129a8, type 5);
// coming back to Smart Hub from it (OnBeginNormalizeWindow @02bc066c) they play layout 0 again.
// - Links (m_LinkLayout @04610c28): 0 the cell above, 1 below, 2 left, 3 right, 4 none. A linked cell's
//   node becomes a child of its neighbour's node, placed at the shared edge (m_LinkedPosAdj @04610620),
//   so it turns with the neighbour on top of its own turn: strips fold like paper.
// - Every node sits at its cell's top-left corner (SetPivotPoint(3, 0); m_ObjectPosAdj @04610fb8 puts
//   the drawing at +w/2, -h/2), so a cell turns about its top edge (x) or its left edge (y).
// - A merged cell is cut into one piece per cell for the motion (m_SeparateForLayoutAni @04611400 renders
//   the item into an image once and gives every cell its part), and joined again after layout 0. The
//   pieces tile the item: a piece after the first column also covers the spacing before it, a piece
//   above the last row the spacing below it, and m_LinkedPosAdj puts no spacing between pieces of one item.
// - Per cell three animations (m_SetLayoutAnimation @04611a48): node position, node rotation (Euler
//   angles, degrees) and the item's MotionAlpha (int, 255 -> 0 in every flip layout); alpha is on the
//   item's panel, not the node, so it does not pass to linked cells.
// - Timing: cell i starts order[i] x interval after the motion (PlayLayoutAnimation type 5) and runs
//   GBHOME_ANI_MINIMIZE_WINDOW_ITEM_FLIP_TOTAL_DURATION - interval x steps (UIInfo +0x84, +0x88), easing
//   SetAcceleration(2, 2, 0.3) (effect 3; the 0.3 from CCTableLayoutListControl::SetAnimation @046104f0).
// - Only the centred panel flips (OnBeginMinimizeWindow: panel state +0x3c == 0) and not on the default
//   "Set Up Smart Hub" page; the focus glow goes at once (HideFocus) and the focused item loses its focus
//   look (OnFocusOut).
// Mirage (y up) to CSS (y down): rotY keeps its sign, rotX changes it; -90 brings the far edge towards
// the viewer, as the footage shows (kq5n4mhcynk).

export const FLIP_TOTAL_MS = 660        // CHomeOSDInfo::GBHOME_ANI_MINIMIZE_WINDOW_ITEM_FLIP_TOTAL_DURATION @094481a4
const I17 = 17                          // GBHOME_ANI_MINIMIZE_WINDOW_ITEM_FLIP_INTERVAL_TIME_17 @094481a0
const I33 = 33                          // GBHOME_ANI_MINIMIZE_WINDOW_ITEM_FLIP_INTERVAL_TIME_33 @0944819c
const EASE_K = 0.3

type Link = 0 | 1 | 2 | 3 | 4
// per cell: Mirage rotation about x and y (degrees, relative to the linked cell) and the link
type Cell = readonly [number, number, Link]
export type FlipLayout = {
  cols: number
  interval: number
  steps: number          // duration = FLIP_TOTAL_MS - interval x steps (UIInfo +0x84)
  order: readonly number[]
  cells: readonly Cell[]
}

const X: Cell = [-90, 0, 4]   // turns about its top edge
const Y: Cell = [0, -90, 4]   // turns about its left edge
const lk = (c: Cell, link: Link): Cell => [c[0], c[1], link]
const O: Cell = [0, 0, 4]
const rx = (a: number, link: Link): Cell => [a, 0, link]
const ry = (a: number, link: Link): Cell => [0, a, link]

// The layouts as each m_InitializeTableInfo writes them (cells row by row).
export const FLIP = {
  // CHomeAppServicePanel::m_InitializeTableInfo @02be7b2c, Recommended (1 x 10)
  appsRecommended: {
    cols: 10, interval: I17, steps: 2,
    order: [2, 2, 2, 2, 1, 1, 0, 0, 0, 0],
    cells: [X, X, lk(Y, 2), lk(O, 2), X, X, X, X, lk(Y, 2), lk(O, 2)],
  },
  // the same, My Apps (3 x 10); order table at 0x072168e8
  appsMine: {
    cols: 10, interval: I17, steps: 7,
    order: [7, 7, 6, 6, 5, 5, 5, 5, 4, 4, 3, 3, 2, 2, 2, 2, 0, 0, 0, 0, 3, 3, 1, 1, 1, 1, 1, 1, 0, 0],
    cells: [
      X, X, X, X, lk(Y, 2), lk(X, 2), lk(Y, 2), lk(O, 2), X, X,
      X, X, X, X, lk(Y, 2), lk(O, 2), X, X, lk(Y, 2), lk(O, 2),
      lk(X, 0), lk(X, 0), Y, lk(O, 2), ry(180, 2), lk(O, 2), ry(-180, 2), lk(O, 2), lk(X, 0), lk(X, 0),
    ],
  },
  // CHomeGamesServicePanel::m_InitializeTableInfo @02c1fb84 (3 x 4); its steps (2) end the cells of
  // order 3-4 after 660 ms
  games: {
    cols: 4, interval: I17, steps: 2,
    order: [4, 2, 2, 1, 3, 3, 2, 1, 0, 0, 0, 0],
    cells: [X, X, lk(Y, 2), X, X, lk(Y, 2), lk(X, 0), lk(X, 0), Y, lk(O, 2), ry(180, 2), lk(O, 2)],
  },
  // CHomeSmartLivePanel::m_InitializeTableInfo @02bd88b4 (3 x 6); order table at 0x07214534
  onTv: {
    cols: 6, interval: I17, steps: 4,
    order: [4, 4, 4, 3, 1, 1, 4, 4, 4, 3, 3, 1, 4, 2, 2, 2, 0, 0],
    cells: [
      O, O, O, Y, X, lk(Y, 2),
      O, O, O, lk(X, 0), lk(Y, 2), lk(X, 0),
      X, Y, ry(180, 2), ry(-180, 2), X, lk(Y, 2),
    ],
  },
  // CHomePreferredContentPanel::m_InitializeTableInfo @02bd4234 (3 x 4)
  movies: {
    cols: 4, interval: I33, steps: 3,
    order: [3, 2, 1, 1, 3, 2, 2, 1, 3, 0, 0, 0],
    cells: [X, X, X, lk(Y, 2), rx(180, 0), lk(X, 0), lk(Y, 2), lk(X, 0), rx(-180, 0), Y, ry(180, 2), ry(-180, 2)],
  },
  // CHomeMultimediaPanel::m_InitializeTableInfo @02c23d0c (3 x 5); its steps (3) end the cells of order
  // 4-6 after 660 ms
  multimedia: {
    cols: 5, interval: I33, steps: 3,
    order: [6, 6, 4, 2, 2, 5, 6, 4, 4, 1, 5, 3, 3, 3, 1],
    cells: [
      X, lk(Y, 2), Y, Y, ry(180, 2),
      Y, lk(X, 0), lk(X, 0), lk(Y, 2), Y,
      lk(X, 0), Y, ry(180, 2), ry(-180, 2), lk(X, 0),
    ],
  },
} satisfies Record<string, FlipLayout>

// The tables of each panel the exhibit draws (the Social panel shows its banners, no tables).
const PANEL_FLIPS: Record<number, FlipLayout[]> = {
  [APPS]: [FLIP.appsRecommended, FLIP.appsMine],
  [GAMES]: [FLIP.games],
  [ONTV]: [FLIP.onTv],
  [MOVIES]: [FLIP.movies],
  [MULTIMEDIA]: [FLIP.multimedia],
}

const flipMs = (L: FlipLayout) => FLIP_TOTAL_MS - L.interval * L.steps
const flipEnd = (L: FlipLayout) => Math.max(...L.order) * L.interval + flipMs(L)

// Coming back waits for every table's layout animation and the panel's own (CHomePanelApp::
// SetNormalizeWatingEventCount(tables + 1) in OnBeginNormalizeWindow).
export function normalizeMs(panel: number) {
  return Math.max(FLIP_TOTAL_MS, ...(PANEL_FLIPS[panel] ?? []).map(flipEnd))
}

// CMInterpolater::CalcHermiteInterpolation @01f35630 for SetAcceleration(2, 2, k): time runs along a
// Hermite curve with tangents 3k, the value along one with tangents 0 (= cubic-bezier(k, 0, 1-k, 1));
// the firmware finds the curve parameter with four halvings and one linear step.
function hermite(m0: number, m1: number, s: number) {
  return s * s * (3 - 2 * m0 - m1) + s * s * s * (m0 + m1 - 2) + m0 * s
}
function ease(t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const m = 3 * EASE_K
  let lo = 0, hi = 1, xlo = 0, xhi = 1
  for (let i = 0; i < 4; i++) {
    const mid = (lo + hi) / 2
    const x = hermite(m, m, mid)
    if (x < t) {
      lo = mid
      xlo = x
    } else {
      hi = mid
      xhi = x
    }
  }
  const s = lo + (hi - lo) * ((t - xlo) / (xhi - xlo))
  return Math.min(1, Math.max(0, hermite(0, 0, s)))
}

export type Rect = { x: number; y: number; w: number; h: number }
// A table as drawn: its flip layout, the flat rectangle of each cell (stage px) and its merged cells
// (each the list of cells one item covers).
export type FlipTable = { layout: FlipLayout; rect: (cell: number) => Rect; merged?: number[][] }

const groupOf = (T: FlipTable, k: number) => T.merged?.find(g => g.includes(k)) ?? [k]

// The rectangle of a cell's piece (the cell itself unless it is part of a merged item).
function pieceRect(T: FlipTable, k: number): Rect {
  const g = groupOf(T, k)
  const r = T.rect(k)
  if (g.length < 2) return r
  const cols = T.layout.cols
  const firstCol = Math.min(...g.map(c => c % cols))
  const lastRow = Math.max(...g.map(c => Math.floor(c / cols)))
  const x0 = k % cols === firstCol ? r.x : T.rect(k - 1).x + T.rect(k - 1).w
  const y1 = Math.floor(k / cols) === lastRow ? r.y + r.h : T.rect(k + cols).y
  return { x: x0, y: r.y, w: r.x + r.w - x0, h: y1 - r.y }
}

function parentOf(L: FlipLayout, k: number) {
  const link = L.cells[k][2]
  const p = link === 0 ? k - L.cols : link === 1 ? k + L.cols : link === 2 ? k - 1 : link === 3 ? k + 1 : -1
  return p >= 0 && p < L.cells.length ? p : -1
}

const STEP_MS = 10
// Keyframes for one cell: the camera (eye 2000 px in front of the screen centre, as .sh-3d) and the
// chain of linked nodes from the root to the cell, each turned by its own eased progress.
function keyframes(T: FlipTable, k: number, dir: 'out' | 'in'): Keyframe[] {
  const L = T.layout
  const chain: number[] = []
  for (let c = k; c >= 0 && chain.length <= L.cells.length; c = parentOf(L, c)) chain.unshift(c)
  const end = flipEnd(L)
  const ms = flipMs(L)
  const frac = (c: number, t: number) => {
    const e = ease((t - L.order[c] * L.interval) / ms)
    return dir === 'out' ? e : 1 - e
  }
  const frames: Keyframe[] = []
  for (let t = 0; ; t = Math.min(end, t + STEP_MS)) {
    let tr = `translate(960px, 540px) perspective(${PERSPECTIVE}px) translate(-960px, -540px)`
    let px = 0, py = 0
    for (const c of chain) {
      const r = pieceRect(T, c)
      const f = frac(c, t)
      tr += ` translate(${r.x - px}px, ${r.y - py}px) rotateX(${-L.cells[c][0] * f}deg) rotateY(${L.cells[c][1] * f}deg)`
      px = r.x
      py = r.y
    }
    tr += ` translate(${-px}px, ${-py}px)`
    frames.push({ offset: t / end, transform: tr, opacity: 1 - frac(k, t) })
    if (t >= end) break
  }
  return frames
}

// The motion running on a panel: 'out' plays layout 1 (minimize), 'in' layout 0 (normalize); t0 is the
// document timeline time it started (-1: not yet, held at its first frame).
export type Flip = { dir: 'out' | 'in'; t0: number }
export const FlipContext = createContext<Flip | null>(null)
export const useFlip = () => useContext(FlipContext)

// One table item, at its (first) cell; the children are drawn in panel coordinates. During a flip a
// merged item is drawn once per cell, cut to that cell's piece.
export function FlipItem({ table, cell, children }: { table: FlipTable; cell: number; children: ReactNode }) {
  const flip = useFlip()
  const list = groupOf(table, cell)
  const pieces = flip && list.length > 1 ? list : list.slice(0, 1)
  return (
    <>
      {pieces.map(c => (
        <FlipPiece key={c} table={table} cell={c} clip={pieces.length > 1}>
          {children}
        </FlipPiece>
      ))}
    </>
  )
}

function FlipPiece({ table, cell, clip, children }: { table: FlipTable; cell: number; clip: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const flip = useFlip()
  const dir = flip?.dir
  const frames = useMemo(() => (dir ? keyframes(table, cell, dir) : null), [table, cell, dir])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !flip || !frames) return
    const a = el.animate(frames, { duration: flipEnd(table.layout), fill: 'both' })
    // t0 < 0: held at the start until the motion begins
    if (flip.t0 < 0) a.pause()
    else a.startTime = flip.t0
    return () => a.cancel()
  }, [flip, frames, table])
  const r = pieceRect(table, cell)
  return (
    <div
      ref={ref}
      className="sh-flip"
      style={clip ? { clipPath: `inset(${r.y}px ${1920 - r.x - r.w}px ${1080 - r.y - r.h}px ${r.x}px)` } : undefined}
    >
      {children}
    </div>
  )
}
