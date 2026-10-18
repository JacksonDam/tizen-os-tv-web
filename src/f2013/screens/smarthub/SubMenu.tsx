import type { CSSProperties } from 'react'
import {
  GRID_MS, HP_SCALE, IMG, SUB_FONT, SUB_H, SUB_LINE_X, SUB_LINE_Y, SUB_MOVE_Y, SUB_SHOW_MS, SUB_STAGGER_MS,
  SUB_TEXT_GAP, SUB_W, SUB_X, SUB_Y, SUBMENU_FOCUS_IMG,
} from './data'

// The bottom sub menu of one panel (CHomeSubMenuWindow, one window per panel). Buttons and boundary
// lines rest at GBHOME_SUBMENU_BUTTON_POS_Y / _BOUNDARY_POS_Y and hide GBHOME_SUBMENU_Y_MOVE_DISTANCE
// lower (off screen); showing and hiding slides each element in turn, button then line, 250 ms linear,
// 34 ms apart (t_AnimateSubMenuPosSet @02bce178, SetAcceleration(1, 1, 0.7) = linear), from `base` ms.
// The focus box (the panel's sub image as a 9-part composite) moves between buttons in 250 ms; entering
// from the panel it rises from y 1080 at half height, leaving it drops back and fades in its last 50 ms
// (AnimateSubmenuFocus @02bd0ca8 cases 2-5).
// Coming back from an item (`back` set: the index of the button that ran it, or -1) the elements rise
// on CHomeSubMenuWindow::OnBeginNormalizeWindow @02bd16d8's own schedule, that button already in place.

export type SubSlide = { shown: boolean; base: number; back?: number }

// OnBeginNormalizeWindow: element k (button 2i, line 2i + 1) rises with delay and duration both from
// GBHOME_COMMON_GRID_ANIMATION_DURATION - 30; each element starts GBHOME_ANI_SUBMENU_PRECEDENCE_TIME - 10 i
// after the one before, and each item's pair runs 30 + PRECEDENCE - 10 n ms shorter than the last.
function normalizeTiming(n: number, k: number) {
  let delay = GRID_MS - 30
  let ms = GRID_MS - 30
  for (let i = 0; i < n; i++) {
    if (k === 2 * i) return { ms, delay }
    delay += SUB_STAGGER_MS - 10 * i
    if (i < n - 1) {
      if (k === 2 * i + 1) return { ms, delay }
      delay += SUB_STAGGER_MS - 10 * i
    }
    ms -= 30 + SUB_STAGGER_MS - 10 * n
  }
  return { ms, delay }
}
export type SubFocus = { index: number; visible: boolean }

export function SubMenu({ panel, items, slide, focus }: { panel: number; items: string[]; slide: SubSlide; focus: SubFocus }) {
  const n = items.length
  if (!n) return null
  const w = SUB_W[n]
  const xs = SUB_X[n]
  const lines = SUB_LINE_X[n] ?? []
  const el = (k: number): CSSProperties => {
    if (slide.back !== undefined && slide.shown) {
      if (k === slide.back * 2) return { transform: 'translateY(0)' }
      const t = normalizeTiming(n, k)
      return { transform: 'translateY(0)', transition: `transform ${t.ms}ms linear ${t.delay}ms` }
    }
    return {
      transform: `translateY(${slide.shown ? 0 : SUB_MOVE_Y}px)`,
      transition: `transform ${SUB_SHOW_MS}ms linear ${slide.base + SUB_STAGGER_MS * k}ms`,
    }
  }
  const fx = xs[Math.max(0, Math.min(n - 1, focus.index))]
  const img = `${IMG}/${SUBMENU_FOCUS_IMG[panel]}`
  return (
    <div className="sh-sub">
      {/* focus box: 24/24/12/6/24/110 composite rects in the 1.5x image (16/8/16 x 16/4/73 image px) */}
      <div
        className="sh-sub__focus"
        style={{
          left: fx, top: focus.visible ? SUB_Y : SUB_Y + SUB_MOVE_Y, width: w, height: SUB_H,
          borderImageSource: `url("${img}")`,
          transform: `scaleY(${focus.visible ? 1 : 0.5})`,
          opacity: focus.visible ? 1 : 0,
          transition: focus.visible
            ? `left ${GRID_MS}ms linear, top ${GRID_MS}ms linear, transform ${GRID_MS}ms linear, opacity ${GRID_MS / 5}ms linear`
            : `left ${GRID_MS}ms linear, top ${GRID_MS}ms linear, transform ${GRID_MS}ms linear, opacity ${GRID_MS / 5}ms linear ${GRID_MS - GRID_MS / 5}ms`,
        }}
      />
      {items.map((label, i) => (
        <div key={i} className="sh-sub__btn" style={{ left: xs[i], top: SUB_Y, width: w, height: SUB_H, ...el(i * 2) }}>
          {/* text: CHomeWindowManager::GetFont (SVD Medium), GBHOME_SUBMENU_FONT_SIZE, white, centred
              (alignment 1, 4) in the button less GBHOME_SUBMENU_BUTTON_TEXT_SIDE_GAP each side */}
          <span style={{ left: SUB_TEXT_GAP, width: w - SUB_TEXT_GAP * 2, fontSize: SUB_FONT, lineHeight: `${SUB_H}px` }}>{label}</span>
        </div>
      ))}
      {lines.slice(0, n - 1).map((x, i) => (
        <img
          key={`l${i}`}
          className="sh-sub__line"
          src={`${IMG}/sub/sub_boundary_line.png`}
          alt=""
          style={{ left: x, top: SUB_LINE_Y, width: 6 * HP_SCALE, height: 48 * HP_SCALE, ...el(i * 2 + 1) }}
        />
      ))}
    </div>
  )
}
