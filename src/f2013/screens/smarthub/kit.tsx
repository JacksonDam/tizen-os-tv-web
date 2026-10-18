import type { CSSProperties, ReactNode } from 'react'
import { GRID_MS, IMG } from './data'

// Pieces the panel bodies share (CHomeListItemRenderer and the table/grid list controls).
//
// Focus glow: HomePanel/icon/highlight_all.png (102 x 102, a glowing frame) as a 9-part composite with
// APPCMHOME_HIGHLIGHT_IMAGE_W1..H3 = 50 x 1.5 = 75 px corners (CAppCMHomeOSDInfo::t_InitResolution
// @046b7708, scale 1920/1280), placed GBHOME_*_GRID_FOCUS_IMAGE_X/Y_OFFSET outside the item on each side.
// It moves with the focus in GBHOME_COMMON_GRID_ANIMATION_DURATION (linear, inferred).
export function Glow({ x, y, w, h, dx, dy, show = true }: { x: number; y: number; w: number; h: number; dx: number; dy: number; show?: boolean }) {
  return (
    <div
      className="sh-glow"
      style={{
        left: x + dx, top: y + dy, width: w - dx * 2, height: h - dy * 2,
        borderImageSource: `url("${IMG}/icon/highlight_all.png")`,
        opacity: show ? 1 : 0,
        transition: `left ${GRID_MS}ms linear, top ${GRID_MS}ms linear, width ${GRID_MS}ms linear, height ${GRID_MS}ms linear, opacity ${GRID_MS}ms linear`,
      }}
    />
  )
}

// Focused text box: HomePanel/icon/high_text.png (20 x 34, white with rounded corners) as a composite
// (APPCMHOME_HIGHLIGHT_TEXT_BOX_W1 14, W2 4, W3 14, H1 22, H2 10, H3 16), black text inside
// (CHomeListItemRenderer::OnCreate: 0xff000000 in the box, 0xffffffff outside).
export function TextBox({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return (
    <div className="sh-tbox" style={{ borderImageSource: `url("${IMG}/icon/high_text.png")`, ...style }}>
      {children}
    </div>
  )
}
