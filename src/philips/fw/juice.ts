import type { Mem } from './mem'

// Port of the "Juice" OSD toolkit of the 42PFL5603D/12 TV application (philips/apps/mtv522eu, TV520
// software Q522E 0.64.79). The UI is a static widget database (Juice* tables) drawn into an 852x480
// 8-bit CLUT plane; this module re-implements the draw functions on a canvas, reading the widget
// records at the firmware's own offsets (addresses are the MIPS virtual addresses of mtv522eu).
// Function names in comments are the firmware's (dynamic symbols) or Ghidra's FUN_<address>.
// Spec and offsets: philips-fw/eu/spec.md.

export const OSD_W = 852 // juicejbmp__bmp_DrawBitmap clips x < 0x354, y < 0x1e0
export const OSD_H = 480

// Widget id = class << 11 | index (juicew__wid_Draw dispatches on (id & 0xf800) >> 9).
export const CLS = {
  animator: 1, button: 3, encap: 4, list: 5, dgrid: 6, panel: 7, radio: 8, slider: 9, status: 10, text: 11,
  numgroup: 12, layout: 13, mover: 14, nav: 15, organizer: 16, datetime: 17, multiline: 18, icon: 19,
} as const
export const W = (cls: keyof typeof CLS, i: number) => (CLS[cls] << 11) | i
export const clsOf = (w: number) => (w >> 11) & 0x1f
export const idxOf = (w: number) => w & 0x7ff

// Draw flags (the param_4 bits of the draw functions)
export const F = {
  FOCUS: 1, SELECTED: 2, NOBODY: 4, NOCAPTION: 8, ITEMS: 0x10, CURRENT: 0x20, ALT: 0x40, NOOFFSET: 0x80,
  HELP: 0x400, LAST: 0x800, FOCUS2: 0x2000,
}

// Font: Philips Screen Font 4 (philips/data/ceapps/Fonts/PHLSC4.ttf, the only vector font of the
// draw styles; fntVectorFontMap entry 0). Sizes are the draw styles' pixel sizes (17, 19).
// The firmware's font engine (gfxfe) draws glyphs narrower than their em: 0.9 in x, measured on
// footage of the TV menu (text/bar width ratios and where captions are cut with "...") (inferred).
export const FONT = 'PhilipsScreenFont4'
export const XSCALE = 0.9
const ASC = 2190 / 2048 // hhea ascender / descender of PHLSC4.ttf
const DESC = 580 / 2048

// State styles (juicessc__jss_StateStyle): 6 disabled, 7 normal, 8 selected, 9 disabled+focus,
// 10 focus, 11 focus+selected, 12 focus with 0x2000.
export function stateStyle(controllable: boolean, focus: number, selected: boolean) {
  if (!controllable) return focus ? 9 : 6
  if (focus) return focus & 0x2000 ? 12 : selected ? 11 : 10
  return selected ? 8 : 7
}

export interface Env {
  str(id: number): string                  // juicejstr__js_GetString (static + dynamic ids)
  userString(): string                     // caption -2: the string set by SetBel2String
  avail(prop: number, w: number): boolean  // juiceappreg__japiX_IsAvailable
  ctrl(prop: number, w: number): boolean   // juiceappreg__japiX_IsControllable
  get(prop: number, w: number): number     // juiceappreg__japiX_Get
  range(prop: number, w: number): [number, number] // japiX_First / japiX_Last
  state(w: number): number                 // juicew__wid_State (> 1 drawn, > 3 children drawn)
  statusValue?(w: number): string | number | undefined // status controls of type 1/2/5
  list?(w: number): ListState | undefined
  textOverride?(w: number, alt: boolean): string | undefined
  allowed?(w: number, value: number): boolean // juiceappreg__japiX_ValueAllowed
  panelFocus?(w: number): number | undefined  // PanelVars+0xf: the focused child of a panel
}

export type ListState = { focus: number; top: number; expanded: boolean }

export class Juice {
  m: Mem
  ctx!: CanvasRenderingContext2D
  env: Env
  atlas: HTMLImageElement
  user = ''
  // table addresses
  T: Record<string, number> = {}

  constructor(m: Mem, atlas: HTMLImageElement, env: Env) {
    this.m = m
    this.atlas = atlas
    this.env = env
    for (const k of ['JuicePanels', 'JuicePanelViews', 'JuicePanelControls', 'JuiceStatuss', 'JuiceStatusViews',
      'JuiceStatusControls', 'JuiceLists', 'JuiceSliders', 'JuiceButtons', 'JuiceTexts', 'JuiceNavigators',
      'JuiceBel2s', 'JuiceStyleTexts', 'JuiceStateStyles', 'JuiceBitmapGroups', 'JuiceDynamicGrids',
      'JuiceNumericGroupEdits', 'JuiceIcons', 'JuiceAnimators', 'JuiceMultiLineStatuss', 'JuiceDateTimes',
      'JuiceOrganizers']) {
      this.T[k] = m.addr(k)
    }
  }

  // ---------- resources ----------
  color(ci: number) {
    const v = this.m.palette[ci] >>> 0
    const a = (v >>> 24) / 255
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`
  }
  // draw styles: 0x20-byte records at 0xbae1a0 + 0x20 * id (juicejrsc__rsc_getForegroundColor etc.)
  dsFg(ds: number) { return ds > 0 && ds <= 37 ? this.m.u8(0xbae1a0 + 0x20 * ds) : 0 }
  dsBg(ds: number) { return ds > 0 && ds <= 37 ? this.m.u8(0xbae1a1 + 0x20 * ds) : 0 }
  dsSize(ds: number) { return ds > 0 && ds <= 37 ? this.m.u32(0xbae1a4 + 0x20 * ds) : 0 }

  bmpW(id: number) { const a = this.m.atlas[id]; return a ? a[2] : 0 }
  bmpH(id: number) { const a = this.m.atlas[id]; return a ? a[3] : 0 }

  // juicejbmp__bmp_DrawBitmap: tiles the bitmap over w x h
  drawBitmap(id: number, x: number, y: number, w?: number, h?: number) {
    const a = this.m.atlas[id]
    if (!a || id <= 0) return
    const [ax, ay, bw, bh] = a
    w = w || bw
    h = h || bh
    if (w <= 0 || h <= 0) return
    for (let yy = 0; yy < h; yy += bh) {
      if (y + yy >= OSD_H) break
      const ch = Math.min(bh, h - yy)
      for (let xx = 0; xx < w; xx += bw) {
        if (x + xx >= OSD_W) break
        const cw = Math.min(bw, w - xx)
        this.ctx.drawImage(this.atlas, ax, ay, cw, ch, x + xx, y + yy, cw, ch)
      }
    }
  }

  // juicejlld__lld_FillRectangle with the draw style's background colour (0xfe = transparent)
  fill(ds: number, x: number, y: number, w: number, h: number) {
    if (ds <= 0 || w <= 0 || h <= 0) return
    const c = this.dsBg(ds)
    if (c === 0xfe) return
    this.ctx.fillStyle = this.color(c)
    this.ctx.fillRect(x, y, w, h)
  }

  // juicessc__jss_Draw: a state style is top / middle (stretched) / bottom bitmaps per state
  ssBitmaps(ss: number, st: number): [number, number, number] {
    const a = this.T.JuiceStateStyles + ss * 0x2a
    const o = ({ 6: 6, 7: 0, 8: 0xc, 9: 0x18, 10: 0x12, 11: 0x1e, 12: 0x24 } as Record<number, number>)[st & 0xf]
    if (o === undefined) return [0, 0, 0]
    return [this.m.s16(a + o), this.m.s16(a + o + 2), this.m.s16(a + o + 4)]
  }
  jss(ss: number, x: number, y: number, w: number, h: number, st: number) {
    if (!ss) return
    const [top, mid, bot] = this.ssBitmaps(ss, st)
    if (top) {
      this.drawBitmap(top, x, y, w || this.bmpW(top), this.bmpH(top))
      y += this.bmpH(top)
    }
    if (mid) {
      const hh = h ? h - this.bmpH(top) - this.bmpH(bot) : this.bmpH(mid)
      this.drawBitmap(mid, x, y, w || this.bmpW(mid), hh)
      y += hh
    }
    if (bot && !(st & 0x10)) this.drawBitmap(bot, x, y, w || this.bmpW(bot), this.bmpH(bot))
  }
  ssWidth(ss: number, st: number) {
    const [t, m, b] = this.ssBitmaps(ss, st)
    return Math.max(this.bmpW(t), this.bmpW(m), this.bmpW(b))
  }
  ssHeight(ss: number, st: number) {
    const [t, m, b] = this.ssBitmaps(ss, st)
    return this.bmpH(t) + this.bmpH(m) + this.bmpH(b)
  }

  // juicestxtc__jstxt_GetTextStyle: text style -> draw style for a state
  textStyle(t: number, st: number) {
    if (!t) return 0
    const o = ({ 6: 0, 7: 2, 8: 4, 9: 10, 10: 6, 11: 8, 12: 12 } as Record<number, number>)[st & 0xf]
    return o === undefined ? 0 : this.m.s16(this.T.JuiceStyleTexts + t * 0xe + o)
  }

  // ---------- text (juicejlld / gfxfe) ----------
  font(ds: number) {
    return `${this.dsSize(ds)}px ${FONT}`
  }
  textWidth(s: string, ds: number) {
    if (!s || !ds) return 0
    this.ctx.font = this.font(ds)
    let w = 0
    for (const line of s.split('\r')) w = Math.max(w, this.ctx.measureText(line).width)
    return Math.round(w * XSCALE)
  }
  lineHeight(ds: number) {
    return Math.round(this.dsSize(ds) * (ASC + DESC))
  }
  // juicejstr__js_JStringHeight -> lld_GetStringHeight(str, 1, style): the height of one line, also
  // for captions with line breaks (anchoring a two-line help text by its bottom keeps the second
  // line below the anchor, as on footage of the help line)
  textHeight(s: string, ds: number) {
    if (!s || !ds) return 0
    return this.lineHeight(ds)
  }
  // fit a line into clip px with "..." (juicejstr__js_DrawStringClip mode 3)
  clipLine(line: string, ds: number, clip: number) {
    if (!clip || this.textWidth(line, ds) <= clip) return line
    let t = line
    while (t && this.textWidth(t + '...', ds) > clip) t = t.slice(0, -1)
    return t + '...'
  }
  drawText(s: string, x: number, y: number, ds: number, clip = 0) {
    if (!s || !ds) return
    const fg = this.dsFg(ds)
    if (((this.m.palette[fg] >>> 24) & 255) === 0) return
    const ctx = this.ctx
    ctx.font = this.font(ds)
    ctx.fillStyle = this.color(fg)
    ctx.textBaseline = 'alphabetic'
    const size = this.dsSize(ds)
    const lh = this.lineHeight(ds)
    s.split('\r').forEach((line, i) => {
      const t = this.clipLine(line, ds, clip)
      ctx.save()
      ctx.translate(x, y + i * lh + size * ASC)
      ctx.scale(XSCALE, 1)
      ctx.fillText(t, 0, 0)
      ctx.restore()
    })
  }

  // ---------- bel2 (juicebel2c): a label = optional bitmap group (left/middle/right) + caption ----------
  b2(i: number) { return this.T.JuiceBel2s + i * 0x10 }
  b2Caption(i: number, override?: string) {
    if (override !== undefined) return override
    const c = this.m.s16(this.b2(i) + 0xc)
    if (c === -1) return ''
    if (c < 0) return this.user // -2 / -4: user string (SetBel2String)
    return this.env.str(c)
  }
  bmpGroup(g: number, st: number): [number, number, number] {
    const a = this.T.JuiceBitmapGroups + g * 0x12
    const o = st === 6 || st === 9 ? 0 : st === 10 || st === 11 ? 0xc : 6
    return [this.m.s16(a + o), this.m.s16(a + o + 2), this.m.s16(a + o + 4)]
  }
  b2Style(i: number, st: number) {
    return i < 0 ? 0 : this.textStyle(this.m.u16(this.b2(i) + 0xe), st)
  }
  b2StyledWidth(i: number, st: number, cap?: string) {
    if (i < 0) return 0
    const a = this.b2(i)
    const w = this.m.s16(a + 10)
    if (w) return w
    const [l, m, r] = this.bmpGroup(this.m.u16(a + 6), st)
    const c = this.m.s16(a + 0xc)
    const mid = c === -1 && cap === undefined ? this.bmpW(m) : this.textWidth(this.b2Caption(i, cap), this.b2Style(i, st))
    return this.bmpW(l) + this.bmpW(r) + mid
  }
  b2StyledHeight(i: number, st: number, cap?: string) {
    if (i < 0) return 0
    const a = this.b2(i)
    let h = this.m.s16(a + 8)
    if (!h) {
      const th = this.textHeight(this.b2Caption(i, cap), this.b2Style(i, st))
      const [l, m, r] = this.bmpGroup(this.m.u16(a + 6), st)
      h = Math.max(this.bmpH(l), this.bmpH(m), this.bmpH(r))
      if (h < th && th > 0) h = th
    }
    if ((st & 0xff) - 9 < 4 && (st & 0xff) >= 9) h += this.m.s8(a + 1)
    return h
  }
  // juicebel2c__bel2_Draw
  bel2Draw(i: number, x: number, y: number, st: number, cap?: string, clip = 0) {
    if (i < 0) return
    const a = this.b2(i)
    const sw = this.b2StyledWidth(i, st, cap)
    const sh = this.b2StyledHeight(i, st, cap)
    if (sw <= 0 || sh <= 0) return
    const ds = this.b2Style(i, st)
    const [l, m, r] = this.bmpGroup(this.m.u16(a + 6), st)
    const x0 = Math.max(0, x - ((sw * this.m.u8(a + 4)) >> 1))
    const y0 = Math.max(0, y - ((sh * this.m.u8(a + 5)) >> 1))
    this.fill(ds, x0, y0, sw, sh)
    if (this.m.u8(a) === 0) {
      let inner = sw - this.bmpW(l) - this.bmpW(r)
      let xx = x0
      if (inner < 0) { xx += inner; inner = -inner }
      this.drawBitmap(l, xx, y0, this.bmpW(l), this.bmpH(l))
      xx += this.bmpW(l)
      if (this.bmpW(m) > 0) this.drawBitmap(m, xx, y0, inner, this.bmpH(m))
      const t = this.b2Caption(i, cap)
      if (t) {
        const tw = this.textWidth(t, ds)
        let dy = 0
        if (this.m.s16(a + 8) !== 0 || Math.max(this.bmpH(l), this.bmpH(m), this.bmpH(r)) !== 0) dy = sh - this.textHeight(t, ds)
        const avail = Math.max(inner, 0)
        const cl = clip > 0 && tw > clip ? clip : tw > avail && avail > 0 ? avail : 0
        const shown = cl ? Math.min(tw, cl) : tw
        this.drawText(t, xx + ((this.m.u8(a + 2) * Math.max(0, inner - shown)) >> 1), y0 + ((this.m.u8(a + 3) * dy) >> 1), ds, cl)
      }
      xx += inner
      this.drawBitmap(r, xx, y0, this.bmpW(r), this.bmpH(r))
    } else {
      this.drawBitmap(l, x0, y0)
      this.drawBitmap(m, x0, y0 + this.bmpH(l), this.bmpW(m), sh - this.bmpH(l) - this.bmpH(r))
      this.drawBitmap(r, x0, y0 + sh - this.bmpH(r))
    }
  }

  // ---------- widget common part (juicewidgetcommon), the caption block of every widget record ----------
  // shorts: [0] bel2, [1] alt bel2, [2,3] caption pos, [4,5] alt pos, [6..7] help widget (u32),
  // [8,9] help pos, [10] help abs flag (byte), [11] ss, [12] alt ss, [13,14] ss pos, [15,16] alt ss pos,
  // [17] clip width, [18] scroll id, [19] alt clip width.
  jwcOf(w: number) {
    const c = clsOf(w)
    const i = idxOf(w)
    const T = this.T
    switch (c) {
      case CLS.panel: return T.JuicePanels + i * 0x48 + 8
      case CLS.status: return T.JuiceStatuss + i * 0x3c + 8
      case CLS.list: return T.JuiceLists + i * 0xe0 + 0x20
      case CLS.slider: return T.JuiceSliders + i * 0xcc + 0x10
      case CLS.button: return T.JuiceButtons + i * 0x74 + 0x10
      case CLS.text: return T.JuiceTexts + i * 0x9c + 0x10
      case CLS.dgrid: return T.JuiceDynamicGrids + i * 0xc0 + 0x10
      case CLS.numgroup: return T.JuiceNumericGroupEdits + i * 0x94 + 0x10
      case CLS.nav: return T.JuiceNavigators + i * 0xb0 + 0x24
      case CLS.multiline: return T.JuiceMultiLineStatuss + i * 0x70 + 0x20
      case CLS.datetime: return T.JuiceDateTimes + i * 0xa0 + 0x10
      case CLS.organizer: return T.JuiceOrganizers + i * 0x70 + 0x14
      default: return 0
    }
  }
  // juicewidgetcommon__jwc_Draw2 + FUN_008fe45c (the scrolling-caption path is drawn clipped)
  jwcDraw(w: number, x: number, y: number, st: number, alt: boolean) {
    const j = this.jwcOf(w)
    if (!j || this.env.state(w) < 2) return
    const m = this.m
    const bi = m.s16(j + (alt ? 2 : 0))
    if (bi < 0) return
    const cap = this.env.textOverride?.(w, alt)
    const ew = m.s16(this.b2(bi) + 10)
    const eh = m.s16(this.b2(bi) + 8)
    if (alt) {
      this.jss(m.s16(j + 24), x + m.s16(j + 30), y + m.s16(j + 32), ew, eh, st)
      this.bel2Draw(bi, x + m.s16(j + 8), y + m.s16(j + 10), st & 0xf, cap, m.s16(j + 38))
    } else {
      this.jss(m.s16(j + 22), x + m.s16(j + 26), y + m.s16(j + 28), ew, eh, st)
      this.bel2Draw(bi, x + m.s16(j + 4), y + m.s16(j + 6), st & 0xf, cap, m.s16(j + 34))
    }
  }
  // juicewidgetcommon__jwc_HelpDraw2
  helpDraw(w: number, x: number, y: number) {
    const j = this.jwcOf(w)
    if (!j) return
    const hw = this.m.u32(j + 0xc)
    if (!hw || !this.env.avail(this.prop(hw), hw)) return
    let hx = this.m.s16(j + 0x10)
    let hy = this.m.s16(j + 0x12)
    if (this.m.u8(j + 0x14)) { hx += x; hy += y }
    this.draw(hw, hx, hy, F.FOCUS)
  }

  // juicew__wid_Property per class
  prop(w: number): number {
    const m = this.m
    const i = idxOf(w)
    const T = this.T
    switch (clsOf(w)) {
      case CLS.panel: return m.s32(T.JuicePanelControls + m.u16(T.JuicePanels + i * 0x48 + 0x36) * 0x10)
      case CLS.status: return m.s32(T.JuiceStatusControls + m.u16(T.JuiceStatuss + i * 0x3c + 0x36) * 0x18)
      case CLS.list: return m.s32(T.JuiceLists + i * 0xe0 + 8)
      case CLS.slider: return m.s32(T.JuiceSliders + i * 0xcc + 8)
      case CLS.button: return m.s32(T.JuiceButtons + i * 0x74 + 8)
      case CLS.text: return m.s32(T.JuiceTexts + i * 0x9c + 8)
      case CLS.dgrid: return m.s32(T.JuiceDynamicGrids + i * 0xc0 + 0xc)
      case CLS.numgroup: return m.s32(T.JuiceNumericGroupEdits + i * 0x94 + 8)
      case CLS.nav: return m.s32(T.JuiceNavigators + i * 0xb0 + 8)
      default: return -1
    }
  }
  st(w: number, flags: number, sel = 0) {
    const p = this.prop(w)
    return stateStyle(this.env.ctrl(p, w), flags & 0x2001, !!sel)
  }

  // panel children: (u32 id, s16 x, s16 y) at +0x30, count u16 at +0x34
  children(w: number): [number, number, number][] {
    if (clsOf(w) !== CLS.panel) return []
    const a = this.T.JuicePanels + idxOf(w) * 0x48
    const p = this.m.u32(a + 0x30)
    const n = this.m.u16(a + 0x34)
    const out: [number, number, number][] = []
    for (let k = 0; k < n; k++) out.push([this.m.u32(p + 8 * k), this.m.s16(p + 8 * k + 4), this.m.s16(p + 8 * k + 6)])
    return out
  }
  parent(w: number): number {
    const i = idxOf(w)
    const T = this.T
    switch (clsOf(w)) {
      case CLS.panel: return this.m.u32(T.JuicePanels + i * 0x48 + 4)
      case CLS.status: return this.m.u32(T.JuiceStatuss + i * 0x3c + 4)
      case CLS.list: return this.m.u32(T.JuiceLists + i * 0xe0 + 4)
      case CLS.slider: return this.m.u32(T.JuiceSliders + i * 0xcc + 4)
      case CLS.button: return this.m.u32(T.JuiceButtons + i * 0x74 + 4)
      default: return 0
    }
  }

  // ---------- class draw functions ----------
  draw(w: number, x: number, y: number, flags = 0) {
    if (!w || this.env.state(w) < 2) return
    switch (clsOf(w)) {
      case CLS.panel: return this.panelDraw(w, x, y, flags)
      case CLS.status: return this.statusDraw(w, x, y, flags)
      case CLS.list: return this.listDraw(w, x, y, flags)
      case CLS.slider: return this.sliderDraw(w, x, y, flags)
      case CLS.button: return this.buttonDraw(w, x, y, flags)
      case CLS.nav: return this.navDraw(w, x, y, flags)
      case CLS.icon: return this.iconDraw(w, x, y, flags)
      default: {
        if (!(flags & F.NOCAPTION)) this.jwcDraw(w, x, y, this.st(w, flags, flags & F.SELECTED), !!(flags & F.ALT))
      }
    }
  }

  // FUN_008bf2f4 (icon: +8 w, +0xa h, +0xd type, +0xe bitmap / string / draw style / state style, +0x10 style)
  iconDraw(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuiceIcons + idxOf(w) * 0x14
    const iw = m.s16(a + 8)
    const ih = m.s16(a + 0xa)
    const v = m.s16(a + 0xe)
    switch (m.u8(a + 0xd)) {
      case 1: return this.drawBitmap(v, x, y, iw || this.bmpW(v), ih || this.bmpH(v))
      case 2: return this.drawText(this.env.str(v), x, y, m.s16(a + 0x10), iw)
      case 3: return this.fill(v, x, y, iw, ih)
      case 4: return this.jss(v, x, y, iw, ih, stateStyle(true, flags & 1, !!(flags & 2)))
      case 5: return this.drawText(this.env.str(v), x, y, this.textStyle(m.s16(a + 0x10), stateStyle(true, flags & 1, !!(flags & 2))))
    }
  }

  // FUN_008e6910 (panel, static mode 0)
  panelDraw(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuicePanels + idxOf(w) * 0x48
    const v = this.T.JuicePanelViews + m.u16(a + 0x38) * 0x22
    const ctl = this.T.JuicePanelControls + m.u16(a + 0x36) * 0x10
    const st = this.st(w, flags & 0x2001)
    let px = x
    let py = y
    if (!(flags & F.NOOFFSET)) { px = x + m.u16(v + 4); py = y + m.u16(v + 6) }
    if (!(flags & F.NOBODY)) {
      const ds = flags === 0 ? m.s16(v + 0x1a) : m.s16(v + 0x1c)
      this.fill(ds, x + m.s16(v + 0x12), y + m.s16(v + 0x14), m.s16(v + 0xe), m.s16(v + 0x10))
      const bmp = m.s16(v + 0x16)
      this.drawBitmap(bmp, px, py, this.bmpW(bmp), this.bmpH(bmp))
      this.jss(m.s16(v + 0x18), px, py, m.s16(v), m.s16(v + 2), st)
      if (this.env.state(w) > 3) {
        // a panel whose control has +8 set draws one focused child (PanelVars+0xf, initially the
        // control's +9) last and with the focus; otherwise every child gets the panel's flags
        const fmode = m.u8(ctl + 8)
        const fi = fmode ? this.env.panelFocus?.(w) ?? m.u8(ctl + 9) : -1
        const kids = this.children(w)
        const ok = (c: number) => this.env.state(c) > 1 && this.env.avail(this.prop(c), c)
        kids.forEach(([c, cx, cy], k) => {
          if (k === fi || !ok(c)) return
          this.draw(c, px + cx, py + cy, fmode ? 0 : flags & ~0xc)
        })
        const f = kids[fi]
        if (f && ok(f[0])) this.draw(f[0], px + f[1], py + f[2], flags & ~0xc)
      }
    }
    const cst = this.st(w, flags & 0x2001, flags & 2)
    if (!(flags & F.NOCAPTION)) this.jwcDraw(w, x, y, cst, !!(flags & F.ALT))
    if (flags & F.HELP) this.helpDraw(w, x, y)
  }

  // FUN_008f3b70 + FUN_008f2ae4 (status: background, value text of its control, caption)
  statusDraw(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuiceStatuss + idxOf(w) * 0x3c
    const v = this.T.JuiceStatusViews + m.u16(a + 0x38) * 0x20
    const ctl = this.T.JuiceStatusControls + m.u16(a + 0x36) * 0x18
    if (!(flags & F.NOBODY)) {
      let px = x
      let py = y
      if (!(flags & F.NOOFFSET)) { px = x + m.u16(v + 0xc); py = y + m.u16(v + 0xe) }
      const st = this.st(w, flags & 0x2001, flags & 2)
      this.jss(m.s16(v + 0x14), px, py, m.s16(v), m.s16(v + 2), st)
      const val = this.env.statusValue?.(w)
      if (val !== undefined) {
        let bi: number
        let tx: number
        let ty: number
        let tss: number
        if (flags & F.ALT) { bi = m.s16(ctl + 0xc); tx = m.s16(v + 8); ty = m.s16(v + 0xa); tss = m.s16(v + 0x12) }
        else if (flags & F.ITEMS) { bi = m.s16(ctl + 0xe); tx = m.s16(v + 4); ty = m.s16(v + 6); tss = 0 }
        else { bi = m.s16(ctl + 0xa); tx = m.s16(v + 4); ty = m.s16(v + 6); tss = m.s16(v + 0x10) }
        const s = String(val)
        if (bi >= 0) {
          this.jss(tss, px, py, m.s16(this.b2(bi) + 10), m.s16(this.b2(bi) + 8), st)
          if (m.u8(v + 0x16)) this.wrapDraw(bi, s, px + tx, py + ty, st, m.s16(v + 0x18))
          else this.bel2Draw(bi, px + tx, py + ty, st & 0xf, s, m.s16(v + 0x18))
        }
      }
    }
    if (flags & F.HELP) this.helpDraw(w, x, y)
    if (!(flags & F.NOCAPTION)) this.jwcDraw(w, x, y, this.st(w, flags & 0x2001, flags & 2), !!(flags & F.ALT))
  }
  // juicejstr__js_JWrapString: word-wrap a caption into width px
  wrapDraw(bi: number, s: string, x: number, y: number, st: number, width: number) {
    const ds = this.b2Style(bi, st)
    const lines: string[] = []
    for (const para of s.split('\r')) {
      let cur = ''
      for (const word of para.split(' ')) {
        const t = cur ? `${cur} ${word}` : word
        if (width && this.textWidth(t, ds) > width && cur) { lines.push(cur); cur = word } else cur = t
      }
      lines.push(cur)
    }
    this.drawText(lines.join('\r'), x, y, ds)
  }

  // FUN_008ce774 + FUN_008cceb0 (list: background, items, current value)
  listDraw(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuiceLists + idxOf(w) * 0xe0
    const p = this.prop(w)
    const ctrl = this.env.ctrl(p, w)
    if (!(flags & F.NOBODY)) {
      this.fill(m.s16(a + 0xb6), x + m.s16(a + 0xbc), y + m.s16(a + 0xbe), m.s16(a + 0xb8), m.s16(a + 0xba))
      let x1 = x
      let y1 = y
      if (!(flags & 0x100)) x1 = x + m.u16(a + 0x88)
      if (!(flags & 0x200)) y1 = y + m.u16(a + 0x8a)
      this.jss(m.s16(a + 0xa4), x1, y1, m.s16(a + 0x1a), m.s16(a + 0x1c), stateStyle(ctrl, flags & 1, false))
      if (!(flags & 0x100)) x1 += m.u16(a + 0x80)
      if (!(flags & 0x200)) y1 += m.u16(a + 0x82)
      this.listItems(w, x1, y1, flags)
    }
    if (flags & F.HELP) this.helpDraw(w, x, y)
    if (!(flags & F.NOCAPTION)) this.jwcDraw(w, x, y, stateStyle(ctrl, flags & 0x2001, !!(flags & 2)), !!(flags & F.ALT))
    if (flags & F.ITEMS && m.u8(a + 0x5a)) {
      // the current value next to the caption (collapsed list)
      const idx = this.listValueIndex(w)
      const vb = m.s16(a + 0x54)
      if (m.u8(a + 0x5b) === 0) {
        this.user = this.env.str(m.s16(m.u32(a + 0x5c) + 2 * idx))
        this.bel2Draw(vb, x + m.s16(a + 0x56), y + m.s16(a + 0x58), stateStyle(ctrl, flags & 1, false), undefined, m.s16(a + 0xc0))
      }
    }
  }
  listCount(w: number) { return this.m.u16(this.T.JuiceLists + idxOf(w) * 0xe0 + 0x68) }
  listValueIds(w: number) {
    const a = this.T.JuiceLists + idxOf(w) * 0xe0
    const p = this.m.u32(a + 0x60)
    return Array.from({ length: this.listCount(w) }, (_, k) => this.m.u16(p + 2 * k))
  }
  listCaptions(w: number) {
    const a = this.T.JuiceLists + idxOf(w) * 0xe0
    const p = this.m.u32(a + 0x5c)
    return Array.from({ length: this.listCount(w) }, (_, k) => this.m.s16(p + 2 * k))
  }
  // FUN_008c8648: index of the property value in the list's value ids
  listValueIndex(w: number) {
    const v = this.env.get(this.prop(w), w)
    const i = this.listValueIds(w).indexOf(v)
    return i < 0 ? 0 : i
  }
  listItems(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuiceLists + idxOf(w) * 0xe0
    const n = this.listCount(w)
    if (!n || this.env.state(w) < 4) return
    const ls = this.env.list?.(w)
    if (!ls) return
    const alt = !!(flags & F.ALT)
    const ib = alt ? m.s16(a + 0x52) : m.s16(a + 0x50)
    const iss = alt ? m.u16(a + 0x7e) : m.u16(a + 0x7c)
    const pitch = m.s16(a + 0x66)
    const vertical = m.u8(a + 0x70) === 2
    const radio = m.u8(a + 0x72) === 1
    const caps = this.listCaptions(w)
    const ids = this.listValueIds(w)
    const cur = this.listValueIndex(w)
    const p = this.prop(w)
    const avail = ids.map(v => this.env.avail(p, w) && this.valueAllowed(w, v))
    const shown: number[] = []
    for (let k = 0; k < n; k++) if (avail[k]) shown.push(k)
    const rows = this.listRows(w)
    let first = Math.max(0, Math.min(ls.top, shown.length - rows))
    if (shown.length <= rows) first = 0
    let xx = x
    let yy = y
    const visible = shown.slice(first, first + rows)
    if (first > 0) {
      // more above: up arrow bitmap
      const up = m.s16(a + 0x6c)
      if (up > 0) this.drawBitmap(up, xx, vertical ? yy - pitch : yy)
    }
    for (const k of visible) {
      // FUN_008cceb0: a plain list's focus is its value (the value item is "selected": state 8, or 11
      // with the focus); a list with +0x72 = 1 keeps a separate focus and marks the value item
      const ctrl = this.env.ctrl(p, w)
      let focused: boolean
      let st: number
      if (radio) {
        focused = k === ls.focus
        st = focused ? stateStyle(ctrl, flags & 0x2001, k === cur) : stateStyle(ctrl, 0, k === cur)
      } else {
        focused = k === cur
        st = focused ? stateStyle(ctrl, flags & 0x2001, true) : stateStyle(ctrl, 0, false)
      }
      this.jss(iss, xx, yy, m.s16(this.b2(ib) + 10), m.s16(this.b2(ib) + 8), st)
      this.user = this.env.str(caps[k])
      const tx = alt ? m.s16(a + 0xc6) : m.s16(a + 0x84)
      const ty = alt ? m.s16(a + 0xc8) : m.s16(a + 0x86)
      this.bel2Draw(ib, xx + tx, yy + ty, st & 0xf, undefined, m.s16(a + 0xc4))
      if (radio) {
        const mark = k === cur ? m.u16(a + 0x8c) : m.u16(a + 0x8e)
        const mx = alt ? m.s16(a + 0x94) : m.s16(a + 0x90)
        const my = alt ? m.s16(a + 0x96) : m.s16(a + 0x92)
        this.jss(mark, xx + mx, yy + my, 0, 0, st)
      }
      const step = focused && m.s16(a + 0xd4) ? m.s16(a + 0xd4) : pitch
      if (vertical) yy += step
      else xx += step
    }
    if (first + rows < shown.length) {
      const dn = m.s16(a + 0x6e)
      if (dn > 0) this.drawBitmap(dn, xx, yy)
    }
    // scroll indicators (jss at +0xca / +0xcc)
    const sst = stateStyle(this.env.ctrl(p, w), flags & 1, false)
    this.jss(m.s16(a + 0xca), x + m.s16(a + 0xce), y + m.s16(a + 0xd0), 0, 0, sst)
    this.jss(m.s16(a + 0xcc), x + m.s16(a + 0xce), y + m.s16(a + 0xd2), 0, 0, sst)
  }
  listRows(w: number) {
    const a = this.T.JuiceLists + idxOf(w) * 0xe0
    const pitch = this.m.s16(a + 0x66) || 1
    const h = this.m.s16(a + 0x1c)
    const r = this.m.u8(a + 0x64) + 1
    return Math.max(r, h > 0 ? Math.floor(h / pitch) : r)
  }
  valueAllowed(w: number, v: number) {
    return this.env.allowed?.(w, v) ?? true
  }

  // FUN_008f0d1c + FUN_008f007c (slider)
  sliderDraw(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuiceSliders + idxOf(w) * 0xcc
    const p = this.prop(w)
    const ctrl = this.env.ctrl(p, w)
    if (flags & F.HELP) this.helpDraw(w, x, y)
    if (!(flags & F.NOCAPTION)) this.jwcDraw(w, x, y, stateStyle(ctrl, flags & 1, !!(flags & 2)), !!(flags & F.ALT))
    if (flags & F.NOBODY) return
    this.fill(m.s16(a + 0xc2), x + m.s16(a + 0xc8), y + m.s16(a + 0xca), m.s16(a + 0xc4), m.s16(a + 0xc6))
    if (!(flags & F.NOOFFSET)) { x += m.u16(a + 0xba); y += m.u16(a + 0xbc) }
    const st = stateStyle(ctrl, flags & 1, false)
    this.jss(m.s16(a + 0xac), x, y, m.s16(a + 0xc), m.s16(a + 0xe), st)
    this.sliderBody(w, x, y, flags & 1)
  }
  sliderRange(w: number): [number, number] {
    const m = this.m
    const a = this.T.JuiceSliders + idxOf(w) * 0xcc
    if (m.u8(a + 0x5f) === 1) return this.env.range(this.prop(w), w)
    return [m.s16(a + 0x4a), m.s16(a + 0x4c)]
  }
  sliderBody(w: number, x: number, y: number, focus: number) {
    const m = this.m
    const a = this.T.JuiceSliders + idxOf(w) * 0xcc
    const p = this.prop(w)
    const ctrl = this.env.ctrl(p, w)
    const [lo, hi] = this.sliderRange(w)
    const val = Math.max(lo, Math.min(hi, this.env.get(p, w)))
    const st = stateStyle(ctrl, focus, false)
    const bst = ctrl ? (focus ? 2 : 1) : 0
    const barStyle = this.b2Style(m.s16(a + 0x40), bst + 6)
    void barStyle
    if (m.u8(a + 0x58)) {
      // number
      this.jss(m.s16(a + 0xaa), x + m.s16(a + 0xae), y + m.s16(a + 0xb0), 0, 0, st)
      this.bel2Draw(m.s16(a + 0x40), x + m.s16(a + 0x50), y + m.s16(a + 0x52), st, String(val))
    }
    if (m.u8(a + 0x3e) !== 2) return
    for (const [so, xo, yo] of [[0x98, 0x9e, 0xa0], [0x9a, 0xa2, 0xa4], [0x9c, 0xa6, 0xa8], [0x66, 0x6a, 0x6c], [0x68, 0x6e, 0x70]]) {
      this.jss(m.s16(a + so), x + m.s16(a + xo), y + m.s16(a + yo), 0, 0, st)
    }
    // labels (DrawSliderLabels): max and min numbers and four fixed captions
    const lab = (bo: number, xo: number, yo: number, txt?: string) => this.bel2Draw(m.s16(a + bo), x + m.s16(a + xo), y + m.s16(a + yo), st, txt)
    lab(0x76, 0x86, 0x88, String(Math.min(hi, m.s16(a + 0x4c))))
    lab(0x78, 0x8a, 0x8c, String(Math.max(lo, m.s16(a + 0x4a))))
    lab(0x72, 0x7e, 0x80)
    lab(0x74, 0x82, 0x84)
    lab(0x7a, 0x8e, 0x90)
    lab(0x7c, 0x92, 0x94)
    const gFill = m.u16(a + 0x42)
    const gEmpty = m.u16(m.u32(a + 0x44))
    const gEnd = m.u16(a + 0x48)
    const len = m.u16(a + 0x4e)
    const bx = x + m.s16(a + 0x54)
    const by = y + m.s16(a + 0x56)
    if (m.u8(a + 0x96) === 1) {
      // vertical bar, filled from the bottom
      const left = this.bmpGroup(gFill, st)[0]
      const cE = this.bmpGroup(gEmpty, st)[1]
      const h0 = this.bmpH(left)
      const hc = this.bmpH(cE)
      const fillLen = hi !== lo ? Math.floor(((len - h0 - hc) * (val - lo)) / (hi - lo)) : 0
      let yy = by - h0
      this.drawBitmap(left, bx, yy, this.bmpW(left), h0)
      const cF = this.bmpGroup(gFill, st)[1]
      yy -= fillLen
      this.drawBitmap(cF, bx, yy, this.bmpW(cF), fillLen)
      yy -= hc
      this.drawBitmap(cE, bx, yy, this.bmpW(cE), hc)
    } else {
      // horizontal bar: left cap and filled middle of group +0x42, empty middle and right cap of +0x48
      const lF = this.bmpGroup(gFill, st)[0]
      const cStep = this.bmpGroup(gEmpty, st)[1]
      const inner = len - this.bmpW(lF) - this.bmpW(cStep)
      const seg = m.s16(a + 0xc0)
      if (seg > 0) {
        let k = hi !== lo ? Math.floor((val * seg) / (hi - lo)) : 0
        if (val !== hi && val !== lo && hi !== lo && (val * seg) % (hi - lo)) k++
        for (let i = 0; i < k; i++) this.drawBitmap(cStep, bx + i * this.bmpW(cStep), by)
        return
      }
      const filled = hi !== lo ? Math.floor((inner * (val - lo)) / (hi - lo)) : 0
      this.drawBitmap(lF, bx, by)
      let xx = bx + this.bmpW(lF)
      const cF = this.bmpGroup(gFill, st)[1]
      this.drawBitmap(cF, xx, by, filled, this.bmpH(cF))
      xx += filled
      const cE = this.bmpGroup(gEnd, st)[1]
      this.drawBitmap(cE, xx, by, inner - filled, this.bmpH(cE))
      xx += inner - filled
      this.drawBitmap(this.bmpGroup(gEnd, st)[2], xx, by)
    }
  }

  // FUN_008a69e0 + FUN_008a5f84 (button)
  buttonDraw(w: number, x: number, y: number, flags: number) {
    const m = this.m
    const a = this.T.JuiceButtons + idxOf(w) * 0x74
    const ctrl = this.env.ctrl(this.prop(w), w)
    if (flags & F.HELP) this.helpDraw(w, x, y)
    if (!(flags & F.NOCAPTION)) this.jwcDraw(w, x, y, stateStyle(ctrl, flags & 1, !!(flags & 2)), !!(flags & F.ALT))
    if (flags & F.NOBODY) return
    x += m.s16(a + 0x66)
    y += m.s16(a + 0x68)
    if (flags & 1) { x += m.s16(a + 0x50); y += m.s16(a + 0x52) }
    const st = stateStyle(ctrl, flags & 0x2001, false)
    this.jss(m.s16(a + 0x62), x, y, m.s16(a + 0xc), m.s16(a + 0xe), st)
    x += m.u16(a + 0x4c)
    y += m.u16(a + 0x4e)
    if (this.env.state(w) < 4) return
    const bi = m.s16(a + 0x42)
    this.jss(m.s16(a + 0x60), x, y, m.s16(this.b2(bi) + 10), m.s16(this.b2(bi) + 8), st)
    this.bel2Draw(bi, x + m.s16(a + 0x48), y + m.s16(a + 0x4a), st, undefined, m.s16(a + 0x72))
  }

  // ---------- navigator (juicenvc): FUN_008d82b4, nvctv_TreeViewDraw, nvcmv_MenuViewDraw ----------
  navDraw(w: number, x: number, y: number, flags: number) {
    const nv = this.navs.get(w)
    if (!nv) return
    nv.draw(this, x, y, flags)
  }
  navs = new Map<number, { draw(j: Juice, x: number, y: number, flags: number): void }>()
}
