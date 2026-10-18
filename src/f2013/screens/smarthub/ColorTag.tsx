import type { CSSProperties } from 'react'
import { colorTagColors } from './tagColors'

// The colour tag: the panel-coloured tile Smart Hub leaves in the top-left corner when it runs a sub
// menu item, and that the opened screen keeps (CHomeSubMenuWindow: a Mirage rectangle
// GBHOME_SUBMENU_COLOR_TAG_MIR_NORMAL_WIDTH x _HEIGHT = 400 x 375 with the panel's two
// HOMEPANEL_SUBMENU_MIRAGE_COLOR @0944777c points, and a text box at GBHOME_SUBMENU_COLOR_TAG_TEXT_BOX_POS
// (30, 30), 370 x 122, size GBHOME_SUBMENU_COLOR_TAG_FONT_SIZE_OTHERS 55, white, left/top, multi-line,
// CHomeWindowManager::GetFont = SVD Medium). The gradient runs top to bottom like the background mir
// (inferred).

export function ColorTag({ label, top, bottom, style, textStyle, panel }: {
  label: string
  panel?: number
  top?: string
  bottom?: string
  style?: CSSProperties
  textStyle?: CSSProperties
}) {
  const [t, b] = top && bottom ? [top, bottom] : colorTagColors(panel ?? 3)
  return (
    <div className="sh-ctag" style={{ background: `linear-gradient(to bottom, ${t}, ${b})`, ...style }}>
      <div className="sh-ctag__text" style={textStyle}>{label}</div>
    </div>
  )
}
