// Launcher tiles are "squarcles": a 4 u (32 px) corner with DALi corner squareness
// (VPHomeImageView.isSquarcle -> ImageBox.CornerSquarenessEnabled, FLUX Constant.CORNER_SQUARENESS 0.7).
// Drawn here as a rectangle whose corners are superellipse arcs |x|^n + |y|^n = r^n; the exponent that
// matches DALi's squareness 0.7 is inferred (n = 4 looks alike).

const N = 4

export function squirclePath(w: number, h: number, r: number, inset = 0): string {
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset
  const rr = Math.max(0, r - inset)
  const pts: string[] = []
  // one corner from angle a0 to a1 around centre (cx, cy)
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) {
      const t = a0 + (i / 8) * (Math.PI / 2)
      const c = Math.cos(t), s = Math.sin(t)
      const x = cx + rr * Math.sign(c) * Math.abs(c) ** (2 / N)
      const y = cy + rr * Math.sign(s) * Math.abs(s) ** (2 / N)
      pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
    }
  }
  corner(x1 - rr, y0 + rr, -Math.PI / 2)  // top right
  corner(x1 - rr, y1 - rr, 0)             // bottom right
  corner(x0 + rr, y1 - rr, Math.PI / 2)   // bottom left
  corner(x0 + rr, y0 + rr, Math.PI)       // top left
  return `M ${pts.join(' L ')} Z`
}

// CSS clip-path for an element of that size.
export function squircleClip(w: number, h: number, r: number) {
  return `path('${squirclePath(w, h, r)}')`
}

// The focus ring (StrokeView, i_focus_stroke_tile: 4 px white inside the edge) following the shape.
export function squircleRing(w: number, h: number, r: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<path d="${squirclePath(w, h, r, 2)}" fill="none" stroke="#fff" stroke-width="4"/>`
    + `<path d="${squirclePath(w, h, r, 5)}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="2"/></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
