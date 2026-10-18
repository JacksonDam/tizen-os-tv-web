import type { CSSProperties, ReactNode } from 'react'
import { fw } from './assets'

// Pieces of the widget manager's own UI toolkit ("SH": SHUIEx, SHButton, SHMenuPopup, SHMessagePopup,
// SHProgressBar...) that the More Apps screen (DownloadedApp) is built from. The toolkit lays pages out in
// a 1280x720 space (SHColorTagPage2::Initialize sets the page to 0x500 x 0x2d0) with the InfoLink3
// images 1:1, so on the 1920x1080 stage everything is drawn x1.5 (SHPage wraps its content in a scaled
// 1280x720 box). Texts use the SVD Medium font (inferred: SHUtil::LoadFontPath was not traced).

export const SH_SCALE = 1.5

export function SHPage({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: `scale(${SH_SCALE})`,
        transformOrigin: '0 0', fontFamily: "'SamsungSVD', sans-serif", fontWeight: 500, color: '#fff', ...style,
      }}
    >
      {children}
    </div>
  )
}

// SHImageEx with SetDivideMatrix(l, t, r, b): a 9-slice image stretched to the box.
export function Nine({ src, slice, x, y, w, h, style }: {
  src: string; slice: [number, number, number, number]; x: number; y: number; w: number; h: number; style?: CSSProperties
}) {
  const [l, t, r, b] = slice
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box',
        borderStyle: 'solid', borderWidth: `${t}px ${r}px ${b}px ${l}px`, borderColor: 'transparent',
        borderImage: `url(${fw(src)}) ${t} ${r} ${b} ${l} fill`, ...style,
      }}
    />
  )
}

// SHMenuPopup (01c57478 CreateHighlight, 01c57c28 Reposition): width 320 (SetSize(0x140, 1)); items
// (W - 66) x 30 at x 33, y 27 + 48 i, text size 24, white, 0xfdd911 on the highlighted one; the popup is
// 48 n + 34 high; sub_popup_bg.png (g_InfoLink3Image 0x9c) 9-sliced 22 around it; the highlight is
// list_highlight.png (0x8a) 9-sliced (40, 42, 40, 42), W x 85, at the item's y - 27, moving in 90 ms.
// The panel behind the frame is dark (inferred from footage EhQ9pDtWV4M 5:27).
export type MenuEntry = { label: string; checked?: boolean; check?: boolean }
export function SHMenu({ x, y, items, sel, width = 320, anchorRight = false }: {
  x: number; y: number; items: MenuEntry[]; sel: number; width?: number; anchorRight?: boolean
}) {
  const h = items.length * 48 + 34
  const left = anchorRight ? 1280 - x - width : x
  return (
    <div style={{ position: 'absolute', left, top: y, width, height: h }}>
      <div style={{ position: 'absolute', inset: 2, background: 'rgba(0,0,0,0.85)' }} />
      <Nine src="InfoLink3/images/popup/sub_popup_bg.png" slice={[22, 22, 22, 22]} x={0} y={0} w={width} h={h} />
      <Nine
        src="InfoLink3/images/highlight/list_highlight.png" slice={[40, 42, 40, 42]} x={0} y={27 + sel * 48 - 27} w={width} h={85}
        style={{ transition: 'top 90ms linear' }}
      />
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: 33, top: 27 + i * 48, width: width - 66, height: 30, lineHeight: '30px',
            fontSize: 24, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            color: i === sel ? '#fdd911' : '#fff', paddingLeft: it.check ? 40 : 0,
          }}
        >
          {/* SHCheckMenuItem: list_check_icon.png (InfoLink3/images/popup) when checked */}
          {it.check && it.checked && <img src={fw('InfoLink3/images/popup/list_check_icon.png')} alt="" style={{ position: 'absolute', left: 0, top: -1 }} />}
          {it.label}
        </div>
      ))}
    </div>
  )
}

// SHMessagePopup: a message with buttons in the middle of the page. The geometry of
// SHMessagePopup::RefreshButtonPosition / SetSize was not traced: the box is centred, 600 wide, the
// text size 24 and the buttons btn_normal_32 / btn_select_32 (9-sliced) 140x42, 20 apart (inferred).
export function SHMessage({ text, buttons, sel }: { text: string; buttons: string[]; sel: number }) {
  const W = 600
  const lines = text.split('\n').length
  const textH = Math.max(1, lines) * 34 + 20
  const H = 40 + textH + (buttons.length ? 42 + 40 : 20)
  const x = (1280 - W) / 2
  const y = (720 - H) / 2
  const bw = 140
  const gap = 20
  const bx = (W - buttons.length * bw - (buttons.length - 1) * gap) / 2
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ position: 'absolute', left: x, top: y, width: W, height: H }}>
        <div style={{ position: 'absolute', inset: 2, background: 'rgba(12,16,20,0.92)' }} />
        <Nine src="InfoLink3/images/popup/message_popup_bg.png" slice={[20, 20, 20, 20]} x={0} y={0} w={W} h={H} />
        <div style={{ position: 'absolute', left: 30, top: 40, width: W - 60, height: textH, fontSize: 24, lineHeight: '34px', textAlign: 'center', whiteSpace: 'pre-line' }}>
          {text}
        </div>
        {buttons.map((b, i) => (
          <div key={b} style={{ position: 'absolute', left: bx + i * (bw + gap), top: 40 + textH, width: bw, height: 42 }}>
            <Nine src={`InfoLink3/images/button/${i === sel ? 'btn_select_32' : 'btn_normal_32'}.png`} slice={[12, 12, 12, 12]} x={0} y={0} w={bw} h={42} />
            <div style={{ position: 'absolute', inset: 0, lineHeight: '42px', textAlign: 'center', fontSize: 22, color: i === sel ? '#fff' : '#fff' }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// SHProgressBar type 1 (01c5ffb8): apps_progress_wh_bg.png (0x99) and apps_progress.png (0x97),
// 9-sliced (7, 6, 7, 6).
export function SHProgress({ x, y, w, h, value }: { x: number; y: number; w: number; h: number; value: number }) {
  return (
    <>
      <Nine src="InfoLink3/images/progressBar/apps_progress_wh_bg.png" slice={[7, 6, 7, 6]} x={x} y={y} w={w} h={h} />
      {value > 0 && <Nine src="InfoLink3/images/progressBar/apps_progress.png" slice={[7, 6, 7, 6]} x={x} y={y} w={Math.max(14, (w * value) / 100)} h={h} />}
    </>
  )
}
