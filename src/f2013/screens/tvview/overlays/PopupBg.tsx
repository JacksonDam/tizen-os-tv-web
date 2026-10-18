import type { CSSProperties } from 'react'
import { img } from '../common'

// The TV viewer's message window background (Ace factory -> CViewerBackgroundDrawingHelperCubic:
// t_Create 0x024f8834, SetCompositeBgImage 0x024f8524, MoveResizeWindow 0x024f8288), used by the
// no-signal window and other viewer messages:
//   - a shadow, image 0xf2 Common/act_popup_shadow.bmp as a 9-slice (MSGBOX_SHADOW_COMPOSITE_ARRAY:
//     corners 35 stage px) on a rect VIEWER_BG_IMAGE_SHADOW_W/H (32) larger, offset by -16;
//   - a black rectangle (BUTTON_NORMAL_FONT_COLOR 0xff000000) with the OSD transparency alpha
//     (CAppUtil::GetOSDTransparency: menu transparency setting 1 (default) -> 0x99);
//   - the frame, image 0xf1 Common/message_common_popup_bg.bmp as a 9-slice (MSGBOX_COMPOSITE_ARRAY:
//     corners 41 stage px; 27.33 bitmap px).
const SHADOW = 32
const FILL_ALPHA = 0x99 / 255

export function PopupBg({ w, h, style }: { w: number; h: number; style?: CSSProperties }) {
  const slice = (file: string, cornerPx: number, cornerStage: number): CSSProperties => ({
    position: 'absolute',
    borderStyle: 'solid',
    borderWidth: cornerStage,
    borderImageSource: `url(${img(file)})`,
    borderImageSlice: `${cornerPx} fill`,
    borderImageWidth: `${cornerStage}px`,
    boxSizing: 'border-box',
  })
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, ...style }}>
      <div style={{ ...slice('Common/act_popup_shadow.bmp', 23.33, 35), left: -SHADOW / 2, top: -SHADOW / 2, width: w + SHADOW, height: h + SHADOW }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, background: `rgba(0,0,0,${FILL_ALPHA.toFixed(3)})` }} />
      <div style={{ ...slice('Common/message_common_popup_bg.bmp', 27.33, 41), left: 0, top: 0, width: w, height: h }} />
    </div>
  )
}
