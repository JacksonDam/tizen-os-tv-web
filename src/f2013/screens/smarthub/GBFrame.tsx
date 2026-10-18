import { useEffect, useState, type ReactNode } from 'react'
import { colorTagColors } from './ColorTag'
import { IMG } from './data'

// The "GoldenBridge" frame the Smart Hub's content applications share (Photos, Videos & Music:
// CMMContentViewBase / CMMSubCategory; Films and TV Shows: CNOABrowserViewBase / CNOASubCategory). They
// run on a 1280 x 720 OSD (CMMBOSDInfo / CNOAOSDInfo::t_Init1280x720), drawn here x 1.5.
//
// The bottom sub category bar continues the Smart Hub sub menu the item came from: MM_SUBCATEGORY_RECT /
// NOA_SUBCATEGORY_RECT (0, 624, 1280, 96), five tabs at *_GB_SUBCATEGORY_5EA_ITEM_FOCUS_X 6 + 256 k,
// 245 wide (the same places as the Smart Hub's five sub menu buttons), labels size 34
// (*_GB_SUBCATEGORY_BUTTON_FONTSIZE), boundary lines GoldenBridge/sub_boundary_line.png at 254 + 256 k,
// y 22, and the focus image "sub category/<set>_sub_*" (9 parts). The colour tag Smart Hub left in the
// top-left corner (400 x 375 = MM_GB_COLOR_TAG_BG 266 x 250 x 1.5) drops into the current category's tab
// (the *_GB_COLOR_TAG_SUBCATEGORY_5_SCALE_X 0.82 / _SCALE_Y 0.36 tables; 500 ms, inferred).

export const GB = 1.5
const BAR_Y = 624, BAR_H = 96
const TAB_X = (k: number, n: number) => (n === 5 ? 6 + 256 * k : n === 4 ? 30 + 328 * k : n === 3 ? 58 + 405 * k : 234 + 446 * k)
const TAB_W = (n: number) => (n === 5 ? 245 : n === 4 ? 234 : n === 3 ? 352 : 366)
const LINE_X = (k: number, n: number) => (n === 5 ? 254 + 256 * k : n === 4 ? 326 + 328 * k : n === 3 ? 434 + 405 * k : 638)

export function GBFrame({ panel, tabs, current, barFocus, focusSet, bg, children }: {
  panel: number
  tabs: string[]
  current: number
  barFocus: number | null       // focused tab while the bar has the focus
  focusSet: 'apps' | 'ma' | 'sm' | 'all'
  bg: ReactNode
  children?: ReactNode
}) {
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)))
    return () => cancelAnimationFrame(r)
  }, [])
  const n = tabs.length
  const [top, bottom] = colorTagColors(panel)
  return (
    <div className="gb">
      {bg}
      {children}
      <div className="gb__bar" style={{ top: BAR_Y * GB, height: BAR_H * GB }}>
        {/* the colour tag, landing on the current category */}
        <div
          className="gb__tag"
          style={{
            background: `linear-gradient(to bottom, ${top}, ${bottom})`,
            left: landed ? TAB_X(current, n) * GB : 0,
            top: landed ? 0 : -BAR_Y * GB,
            width: landed ? TAB_W(n) * GB : 400,
            height: landed ? BAR_H * GB : 375,
          }}
        />
        {barFocus !== null ? (
          <div
            className="gb__focus"
            style={{ left: TAB_X(barFocus, n) * GB, width: TAB_W(n) * GB, height: BAR_H * GB, borderImageSource: `url("${IMG}/gb/${focusSet}_sub_focus.png")` }}
          />
        ) : null}
        {tabs.map((t, k) => (
          <div key={t} className="gb__tab" style={{ left: TAB_X(k, n) * GB, width: TAB_W(n) * GB, height: BAR_H * GB }}>{t}</div>
        ))}
        {tabs.slice(0, -1).map((t, k) => (
          <img key={`l${t}`} className="gb__line" src={`${IMG}/gb/sub_boundary_line.png`} alt="" style={{ left: LINE_X(k, n) * GB, top: 22 * GB, width: 2 * GB, height: 43 * GB }} />
        ))}
      </div>
    </div>
  )
}
