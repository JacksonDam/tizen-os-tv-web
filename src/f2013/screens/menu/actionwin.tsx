import { type ReactNode } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { AW, baseKeys, contactSamsungText, transparencyAlpha, usePages, type AWProps } from './kit'
import { IMG } from './parts'

// CMenuActionWindowBase on CDefaultWindow (AppMWOSDInfo / MenuOSDInfo, 1280x720 OSD space):
//  - background AppCM/act_window_bg 9-slice (DEFAULTWND_BG_POSITION 2/24/139: corners 24 wide, top
//    139, bottom 24), AppCM/act_popup_shadow 21 px larger, offset -10 (DEFAULTWND_SHADOW_BG_*),
//    black BG_ALPHA rectangle at the OSD transparency (CDefaultWindow::m_CreateBGAlphaIDrawing)
//  - title label (ACTION_WINDOW_TITLE 0,0, window width x 61, size 26, TITLE_TEXT_COLOR 0xff7ddcff,
//    centre/middle; CDefaultWindow::m_CreateTitle)
//  - inner box MENU_ACTION_WINDOW_INNER_BOX_COLOR 0x594a4a4a (t_SetInnerBoxBGImage)
//  - buttons MENU_ACTION_WINDOW_BUTTON_W 186 x 53, btn_normal / btn_focused / btn_dim, text size 24,
//    10 px above the bottom, side by side with no gap (t_SetButtonProperty, m_CreateButton);
//    one button = "Close", two = "Close" + "Cancel" (texts 0x1e3 / 0x1a5)

export type FrameProps = {
  x: number
  y: number
  w: number
  h: number
  title: string
  buttons?: string[]
  focus?: number            // focused button, -1 none
  dimButtons?: boolean[]
  children?: ReactNode
}

export function ActionFrame({ x, y, w, h, title, buttons = [], focus = 0, dimButtons, children }: FrameProps) {
  const total = buttons.length * AW.BUTTON_W
  return (
    <div className="m13-awin" style={{ left: x, top: y, width: w, height: h }}>
      <div className="m13-msg-shadow" style={{ left: -10, top: -10, width: w + 21, height: h + 21 }} />
      <div className="m13-msg-alpha" style={{ opacity: transparencyAlpha() }} />
      <div className="m13-awin-bg" />
      <div className="m13-awin-title" style={{ width: w, height: AW.TITLE_H }}>{title}</div>
      {children}
      {buttons.map((b, i) => (
        <div
          key={i}
          className={`m13-btn${dimButtons?.[i] ? ' m13-btn--dim' : i === focus ? ' m13-btn--focus' : ''}`}
          style={{ left: (w - total) / 2 + i * AW.BUTTON_W, top: h - AW.BUTTON_BOTTOM_GAP - AW.BUTTON_H, width: AW.BUTTON_W, height: AW.BUTTON_H }}
        >
          <span style={{ opacity: dimButtons?.[i] ? 0.4 : 1 }}>{b}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Support > Contact Samsung (CContactSamsungActionWindow): window 826x536 centred, title = the item
// name, inner box (13,71) 800x394, text page 757 wide at (47,87), 11 rows of 24 px text with an 8 px
// row gap per page, scroll cues centred on the inner box top (71) and bottom (465). Up/Down turn the
// page, OK on Close or RETURN closes, RED opens the open source licence window (left out, see spec).
//
// Text = t_GetContactInfo + "\n\n" + t_GetProductInfo + "\n\n" + t_GetSmartHubInfo + "\n\n" +
// t_GetOpenSourceInfo (t_MakeTextPages), for the UK (country 7: the "Web Site" branch).

export function ContactSamsung({ title, close, exitMenu }: AWProps & { title: string }) {
  const W = 826, H = 536
  const ROW = AW.FONT_18 + 8, ROWS = 11
  const text = contactSamsungText(title)
  const { ref, pages, page, setPage } = usePages(text, ROW, ROWS)
  useRemote((k: RemoteKey) => {
    if (k === 'Up' || k === 'Down') {
      const p = page + (k === 'Up' ? -1 : 1)
      if (p >= 0 && p < pages) setPage(p)
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      close()
      return true
    }
    if (baseKeys(k, { close, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })
  return (
    <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title={title} buttons={['Close']} focus={0}>
      <div className="m13-awin-inner" style={{ left: 13, top: 71, width: 800, height: 394 }} />
      <div className="m13-awin-page" style={{ left: 47, top: 87, width: 757, height: ROW * ROWS }}>
        <div ref={ref} className="m13-awin-text" style={{ width: 757, fontSize: AW.FONT_18, lineHeight: `${ROW}px`, transform: `translateY(${-page * ROW * ROWS}px)` }}>
          {text}
        </div>
      </div>
      {page > 0 && <img className="m13-awin-cue" src={`${IMG}/act_arrow_up_nor.png`} style={{ left: 13 + (800 - 42) / 2, top: 71 }} alt="" />}
      {page < pages - 1 && <img className="m13-awin-cue" src={`${IMG}/act_arrow_down_nor.png`} style={{ left: 13 + (800 - 42) / 2, top: 465 - 29 }} alt="" />}
    </ActionFrame>
  )
}

