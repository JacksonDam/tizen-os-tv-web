// Accessibility themes for the whole TV UI, applied the way FLUX does it: every colour chip switches to
// its high-contrast column, and Enlarge scales text. The rebuild's stylesheets use the chips' literal
// colours, so the overrides are generated from the live stylesheets: each rule that sets a colour or a
// font size gets a twin scoped to `.stage.<class>`. Sources: spec/flux.md 2.2-2.3 (HC chip table),
// 1.2 and 5.12 (Enlarge factors); the colour classification below is (inferred).

type Mapper = (selector: string, prop: string, value: string, rule: CSSStyleDeclaration) => string | null

const SKIP_SEL = /^(html|body|#root|\.shell|\.stage-host|\.rc)\b/

function splitTop(s: string, sep = ',') {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === sep && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function scope(selector: string, cls: string) {
  const parts = splitTop(selector)
    .map(sel => {
      if (sel === ':root' || sel === '.stage') return `.stage.${cls}`
      if (SKIP_SEL.test(sel)) return null
      if (sel.startsWith('.stage')) return `.stage.${cls}${sel.slice(6)}`
      return `.stage.${cls} ${sel}`
    })
    .filter(Boolean)
  return parts.join(', ')
}

function collect(rules: CSSRuleList, cls: string, map: Mapper, out: string[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
      const inner: string[] = []
      collect(rule.cssRules, cls, map, inner)
      if (inner.length) out.push(`@media ${rule instanceof CSSMediaRule ? rule.conditionText : 'all'} {\n${inner.join('\n')}\n}`)
      continue
    }
    if (!(rule instanceof CSSStyleRule)) continue
    const sel = scope(rule.selectorText, cls)
    if (!sel) continue
    const decls: string[] = []
    for (let i = 0; i < rule.style.length; i++) {
      const prop = rule.style[i]
      const value = rule.style.getPropertyValue(prop)
      // unchanged values are re-emitted too, so the twins keep the original rules' cascade order
      const next = map(rule.selectorText, prop, value, rule.style)
      if (next !== null) decls.push(`${prop}: ${next}`)
    }
    if (decls.length) out.push(`${sel} { ${decls.join('; ')} }`)
  }
}

export function buildOverrides(cls: string, map: Mapper, extra = ''): string {
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode as HTMLElement | null
    if (owner?.dataset?.avTheme) continue
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin (fonts)
    }
    collect(rules, cls, map, out)
  }
  return out.join('\n') + '\n' + extra
}

// ---- colours ----

type RGBA = [number, number, number, number]

function parse(tok: string): RGBA | null {
  const m = tok.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/)
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return [+m[1], +m[2], +m[3], a]
  }
  const h = tok.match(/^#([0-9a-f]{3,8})$/i)
  if (h) {
    let x = h[1]
    if (x.length <= 4) x = [...x].map(c => c + c).join('')
    const n = (i: number) => parseInt(x.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), x.length === 8 ? n(6) / 255 : 1]
  }
  if (tok === 'white') return [255, 255, 255, 1]
  if (tok === 'black') return [0, 0, 0, 1]
  return null
}

const css = ([r, g, b, a]: RGBA) => (a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`)
const grey = (v: number, a = 1): RGBA => [v, v, v, a]
const near = (c: RGBA, r: number, g: number, b: number) => Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) < 24

// Text, icons, lines and strokes (CC_Basic*, CC_Point*).
function hcInk(c: RGBA): RGBA {
  const [r, g, b, a] = c
  if (a === 0) return c
  if (near(c, 255, 255, 255)) return a >= 0.5 ? grey(255) : a >= 0.1 ? grey(128) : grey(64)   // Basic1xx
  if (near(c, 0, 0, 0)) return a >= 0.5 ? grey(0) : grey(128)                                   // Basic2xx
  if (near(c, 51, 173, 255) || near(c, 2, 113, 255) || near(c, 40, 187, 242)) return [255, 240, 0, a >= 0.5 ? a : 0.5] // Point3100/8100
  if (near(c, 0, 153, 255)) return [0, 0, 0, a]                                                 // Point4100
  if (near(c, 48, 70, 82)) return grey(128)                                                     // Point11100
  if (accent(c)) return [255, 240, 0, a]                                                        // other blue accents
  return [r, g, b, a]
}

// saturated blues (the Point and focus accents) turn yellow in high contrast
const accent = ([r, g, b]: RGBA) => b > 180 && b - r > 100 && g < 200

// Planes (CC_BG*): opaque greys; dark tinted planes go black; dims stay translucent black.
const BG_WHITE: [number, number][] = [[1, 255], [0.9, 230], [0.8, 204], [0.7, 179], [0.6, 153], [0.5, 128], [0.4, 92], [0.3, 77], [0.2, 60], [0.1, 44], [0.05, 26], [0, 0]]
function hcPlane(c: RGBA, dim: boolean): RGBA {
  const [r, g, b, a] = c
  if (a === 0) return c
  if (dim) return [0, 0, 0, Math.max(a, 0.7)]                                         // CC_Dim50 -> 70 %
  if (near(c, 255, 255, 255) || near(c, 232, 232, 232)) {
    const v = BG_WHITE.find(([al]) => a >= al - 0.001)![1]
    return grey(a >= 1 ? (near(c, 232, 232, 232) ? 232 : 255) : v)
  }
  if (accent(c)) return [255, 240, 0, a]
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  if (lum < 0.3) return a >= 0.3 ? grey(0) : [0, 0, 0, a]                             // BG2xx, BG5100.. -> #000
  return [r, g, b, a]
}

const TOKEN = /rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|\bwhite\b|\bblack\b/g
const swap = (value: string, f: (c: RGBA) => RGBA) =>
  value.replace(TOKEN, t => {
    const c = parse(t)
    return c ? css(f(c)) : t
  })

const INK = /^(color|fill|stroke|caret-color|outline-color|text-decoration-color|-webkit-text-stroke-color|border(-(top|right|bottom|left))?-color|--text\b|--text-|--focus-ring-color|--accent)/
const PLANE = /^(background|background-color|background-image|--plate|--tv-bg|--home-)/

export const highContrast: Mapper = (selector, prop, value) => {
  const dim = /dim|standby|overlay/i.test(selector)
  if (prop === 'backdrop-filter' || prop === '-webkit-backdrop-filter') return 'none'
  if (prop === 'box-shadow') {
    // drop shadows are off in high contrast; spread rings (strokes) become 4 px ink strokes
    const kept = splitTop(value)
      .map(sh => {
        const lens = sh.match(/-?[\d.]+px/g) ?? []
        const blur = lens.length > 2 ? parseFloat(lens[2]) : 0
        const spread = lens.length > 3 ? parseFloat(lens[3]) : 0
        if (blur > 0 && spread <= 0) return null
        const thick = spread > 0 && spread < 4 ? sh.replace(/(-?[\d.]+px\s+-?[\d.]+px\s+-?[\d.]+px\s+)([\d.]+px)/, '$14px') : sh
        return swap(thick, hcInk)
      })
      .filter(Boolean)
    return kept.length ? kept.join(', ') : 'none'
  }
  if (/^border(-(top|right|bottom|left))?-width$/.test(prop)) {
    const px = parseFloat(value)
    return px > 0 && px < 4 ? '4px' : value // UIPlate stroke 4 px in high contrast
  }
  if (INK.test(prop)) return swap(value, hcInk)
  if (PLANE.test(prop)) return swap(value, c => hcPlane(c, dim))
  return null
}

// ---- Enlarge (Zoom Menu and Text): T20 x1.18, T36 x1.16, other sizes up to T36 x1.2 (FC/TextBox.cs:4138);
// popup titles and bodies keep their size, and popups scale x1.2 instead (FC/PopupUtility.cs:44-56).

const POPUP_TEXT = /msgbox|atp__|avp|as__toast/
export const POPUPS = ['.msgbox__area', '.atp__plate', '.avp__area']

export const enlarge: Mapper = (selector, prop, value, rule) => {
  if (prop !== 'font-size' && prop !== 'line-height') return null
  if (POPUP_TEXT.test(selector)) return value
  const m = value.match(/^([\d.]+)px$/)
  const size = parseFloat(rule.getPropertyValue('font-size'))
  if (!m || !(size <= 36)) return value // line heights follow their rule's font size
  const f = size === 20 ? 1.18 : size === 36 ? 1.16 : 1.2
  return `${+(parseFloat(m[1]) * f).toFixed(2)}px`
}

export const enlargeExtra = (cls: string) =>
  POPUPS.map(p => `.stage.${cls} ${p} { scale: 1.2; }`).join('\n')
