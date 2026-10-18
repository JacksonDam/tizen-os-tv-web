import { F, idxOf, Juice } from './juice'

// Navigator widgets (juicenvc): a menu tree drawn as two columns, the current node's items on the
// left and a preview of the focused item's node (or the focused leaf widget) on the right.
// Record (0xb0 bytes, JuiceNavigators): +0x6c nodes (0x14 each: widget, -, property, -, flag),
// +0x70 node count, +0x74 "next" records (0x10 each: type | sub << 8, -, parent node, data).
// next types: 2 = item list (data: int[] nodes, u8 count), 4 = item list whose entries pick a node
// by a property value (data: 0x10 records {property, values[], nodes[], u8 count}), 1 = the node's
// widget depends on a property, 0/255 = leaf.
// Layout: +0x20 column height, +0x50/0x52 left column, +0x54/0x56 right column, +0x58..0x5e column
// background offsets, +0x7a row pitch, +0x7b first row offset, +0x7c rows, +0x87 breadcrumb flag,
// +0x88 breadcrumb label at +0x8a/0x8c, +0x8e separator string, +0x94/0x96 column background state
// styles (FUN_008d82b4, juicenvc__nvctv_TreeViewDraw, juicenvc__nvcmv_MenuViewDraw).

export type NavItem = { node: number; alts?: [number, number][]; prop?: number }

export class NavCtl {
  j: Juice
  w: number
  a: number
  cur = 0          // NavVars+6: node shown in the left column
  idx = 0          // NavVars+10: focused item of cur
  top = 0          // NavVars+0x12: first visible item
  leaf = false     // focus on the right column's leaf widget (NavVars+8 == next)
  history: { node: number; idx: number; top: number }[] = []
  // node availability and property-dependent item choice (the TV application's japiX callbacks)
  nodeAvail: (node: number) => boolean = () => true
  pick: (prop: number) => number = () => 0

  constructor(j: Juice, w: number) {
    this.j = j
    this.w = w
    this.a = j.T.JuiceNavigators + idxOf(w) * 0xb0
  }
  get m() { return this.j.m }
  nodeCount() { return this.m.u16(this.a + 0x70) }
  widget(node: number) { return this.m.u32(this.m.u32(this.a + 0x6c) + node * 0x14) }
  nodeFlag(node: number) { return this.m.u32(this.m.u32(this.a + 0x6c) + node * 0x14 + 0x10) }
  nextType(node: number) { return this.m.u8(this.m.u32(this.a + 0x74) + node * 0x10) }
  parentNode(node: number) { return this.m.s32(this.m.u32(this.a + 0x74) + node * 0x10 + 8) }
  isMenu(node: number) { const t = this.nextType(node); return t === 2 || t === 4 }

  // juicenvc__nvcmc_MenuCtrlGetWidget, per item index (all items, available or not)
  items(node: number): number[] {
    const m = this.m
    const nx = m.u32(this.a + 0x74) + node * 0x10
    const t = m.u8(nx)
    const d = m.u32(nx + 0xc)
    if (!d) return []
    const arr = m.u32(d)
    const n = m.u8(d + 4)
    const out: number[] = []
    for (let k = 0; k < n; k++) {
      if (t === 2) out.push(m.s32(arr + 4 * k))
      else if (t === 4) {
        const r = arr + 0x10 * k
        const prop = m.s32(r)
        const vals = m.u32(r + 4)
        const nodes = m.u32(r + 8)
        const cnt = m.u8(r + 12)
        const v = this.pick(prop)
        let node = m.s32(nodes)
        for (let i = 0; i < cnt; i++) if (m.s32(vals + 4 * i) === v) node = m.s32(nodes + 4 * i)
        out.push(node)
      }
    }
    return out
  }
  avail(node: number) {
    const w = this.widget(node)
    return this.nodeAvail(node) && this.j.env.avail(this.j.prop(w), w) && this.j.env.state(w) > 1
  }
  shown(node: number) {
    return this.items(node).map((n, k) => ({ n, k })).filter(e => this.avail(e.n))
  }
  rows() { return this.m.u8(this.a + 0x7c) }
  focusedNode() { return this.items(this.cur)[this.idx] }

  // ---- keys (juicenvc__nvctc_TreeCtrlKeyHandler behaviour) ----
  moveFocus(d: number) {
    const sh = this.shown(this.cur)
    if (!sh.length) return false
    let p = sh.findIndex(e => e.k === this.idx)
    if (p < 0) p = 0
    p = Math.max(0, Math.min(sh.length - 1, p + d))
    if (sh[p].k === this.idx) return false
    this.idx = sh[p].k
    const rows = this.rows()
    if (p < this.top) this.top = p
    if (p >= this.top + rows) this.top = p - rows + 1
    return true
  }
  enter() {
    const n = this.focusedNode()
    if (n === undefined || n < 0) return false
    if (this.isMenu(n)) {
      this.history.push({ node: this.cur, idx: this.idx, top: this.top })
      this.cur = n
      const sh = this.shown(n)
      this.idx = sh.length ? sh[0].k : 0
      this.top = 0
      this.leaf = false
      return true
    }
    this.leaf = true
    return true
  }
  back() {
    if (this.leaf) { this.leaf = false; return true }
    const h = this.history.pop()
    if (!h) return false
    this.cur = h.node
    this.idx = h.idx
    this.top = h.top
    return true
  }
  ensureFocusAvailable() {
    const sh = this.shown(this.cur)
    if (sh.length && !sh.some(e => e.k === this.idx)) this.idx = sh[0].k
  }

  // ---- drawing ----
  breadcrumb(): string {
    const parts: string[] = []
    for (const h of this.history) parts.push(this.j.env.str(this.capId(this.widget(h.node))))
    return parts.join(this.j.env.str(this.m.s16(this.a + 0x8e)))
  }
  capId(w: number) {
    const jwc = this.j.jwcOf(w)
    const b = this.m.s16(jwc)
    return b < 0 ? -1 : this.m.s16(this.j.b2(b) + 0xc)
  }

  draw(j: Juice, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.a
    const h = m.s16(a + 0x20)
    const st = j.st(this.w, flags & 1)
    j.jss(m.s16(a + 0x96), m.s16(a + 0x54) + m.s16(a + 0x58), m.s16(a + 0x56) + m.s16(a + 0x5a), 0, h, st)
    j.jss(m.s16(a + 0x94), m.s16(a + 0x50) + m.s16(a + 0x5c), m.s16(a + 0x52) + m.s16(a + 0x5e), 0, h, st)
    this.treeView(j, x, y, flags)
    if (m.u8(a + 0x87) && this.history.length) {
      j.user = this.breadcrumb()
      j.bel2Draw(m.s16(a + 0x88), x + m.u16(a + 0x8a), y + m.u16(a + 0x8c), j.st(this.w, 1))
    }
  }

  treeView(j: Juice, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.a
    const focus = flags & F.FOCUS
    const nxt = this.focusedNode()
    // right column: preview of the focused item's node, or the leaf widget
    if (nxt !== undefined && nxt >= 0 && m.u8(a + 100)) {
      const lw = this.widget(nxt)
      if (j.env.state(lw) > 1 && j.env.avail(j.prop(lw), lw)) {
        let f = (flags & 0xffcf) | F.ALT
        if (!(this.leaf && focus)) f &= ~F.FOCUS
        const rx = x + m.u16(a + 0x54)
        const ry = y + m.u16(a + 0x56)
        if (this.isMenu(nxt)) this.menuView(j, nxt, rx, ry, f & 0xfbfe, false)
        else {
          if (this.leaf && focus) f |= F.FOCUS
          j.draw(lw, rx, ry, f | F.NOCAPTION | (this.leaf ? F.ITEMS : 0))
          if (m.u8(a + 0x65)) j.draw(lw, rx, ry, (f & 0xfbf7) | 5)
        }
      }
    }
    // left column: the current node
    if (this.isMenu(this.cur)) {
      let f = (flags & 0xffbf) | F.CURRENT
      if (!focus) f &= ~F.FOCUS
      this.menuView(j, this.cur, x + m.u16(a + 0x50), y + m.u16(a + 0x52), f, true)
    }
  }

  menuView(j: Juice, node: number, x: number, y: number, flags: number, current: boolean) {
    const m = this.m
    const a = this.a
    const nw = this.widget(node)
    if (m.u8(a + 0x65)) j.draw(nw, x, y, current ? F.NOBODY : 0x45)
    let yy = y + m.s8(a + 0x7b)
    const pitch = m.s8(a + 0x7a)
    const sh = this.shown(node)
    const rows = this.rows()
    const start = current ? this.top : 0
    const vis = sh.slice(start, start + rows)
    // juicenvc__nvcmv_MenuViewDraw: the scroll bar (+0x90, mode +0x92 0: n by N) of a column, at +0xa2 /
    // +0xa4 for the current column and +0xa6 / +0xa8 for the preview
    const sb = m.s16(a + 0x90)
    if (sb >= 0 && m.u8(a + 0x92) === 0 && sh.length) {
      const sx = current ? m.s16(a + 0xa2) : m.s16(a + 0xa6)
      const sy = current ? m.s16(a + 0xa4) : m.s16(a + 0xa8)
      j.scrollBarDraw(sb, x + sx, y + sy, 1, sh.length, rows, start)
    }
    vis.forEach((e, r) => {
      const w = this.widget(e.n)
      let f = flags | F.NOBODY
      if (current) {
        f |= F.ITEMS
        if (e.k === this.idx) {
          if (!this.leaf && flags & F.FOCUS) {
            f |= F.FOCUS | F.HELP
            if (r === rows - 1) f |= F.LAST
          } else f = (f & 0xfbec) | F.SELECTED
        } else f &= ~(F.FOCUS | F.HELP)
      } else f &= ~(F.FOCUS | F.HELP)
      if (this.nodeFlag(e.n)) f &= ~F.NOBODY
      j.draw(w, x, yy, f)
      yy += pitch
    })
  }
}
