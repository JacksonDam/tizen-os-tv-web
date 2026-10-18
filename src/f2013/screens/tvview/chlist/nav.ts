// Focus and scrolling of exeDSP's CSingleLineListWidget / CCSingleLineListControl as the Channel List
// uses it (one row per item, vertical).
export type ListPos = { focus: number; top: number }

// CCSingleLineListControl::t_GetWindowRectForNextFocus (0x01f503b4): the window scrolls only as far
// as needed to bring the focused item into view.
export function ensureVisible(focus: number, top: number, rows: number): number {
  if (focus < top) return focus
  if (focus >= top + rows) return focus - rows + 1
  return top
}

// The initial position: SetDatasource(ds, focusIndex) from the top of the list.
export function initialPos(focus: number, n: number, rows: number): ListPos {
  const f = Math.max(0, Math.min(focus, n - 1))
  return { focus: f, top: ensureVisible(f, 0, rows) }
}

// Up/Down: CSingleLineListWidget::Create calls m_SetLoopType -> SetLoopType(2), so the focus wraps
// from the last item to the first and back.
export function step(p: ListPos, dir: 1 | -1, n: number, rows: number): ListPos {
  if (n <= 1) return p
  const focus = (p.focus + dir + n) % n
  return { focus, top: ensureVisible(focus, p.top, rows) }
}

// CH +/-: CCSingleLineListControl::m_NextPage (0x01f5375c) / m_PrevPage (0x01f53c24). The window
// moves by one page (clamped to the ends) and the focus goes to the first item of the new window.
// On the last (first) page the focus goes to the last (first) item; from there the looping list
// wraps around (vfunc 300; the target of the wrap is inferred).
export function page(p: ListPos, dir: 1 | -1, n: number, rows: number): ListPos {
  if (n < 2) return p
  const maxTop = Math.max(0, n - rows)
  if (dir > 0) {
    if (p.top >= maxTop) {
      if (p.focus !== n - 1) return { focus: n - 1, top: p.top }
      return { focus: 0, top: 0 }
    }
    const top = Math.min(p.top + rows, maxTop)
    return { focus: top, top }
  }
  if (p.top <= 0) {
    if (p.focus !== 0) return { focus: 0, top: 0 }
    return { focus: n - 1, top: maxTop }
  }
  const top = Math.max(p.top - rows, 0)
  return { focus: top, top }
}
