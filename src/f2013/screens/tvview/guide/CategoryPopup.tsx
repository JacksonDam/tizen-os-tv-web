import { useState } from 'react'
import { useRemote } from '../../../../input/remote'
import type { Channel } from '../../../../tv/channels'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { getSetting } from '../../../tv/store'
import { argb, img } from '../common'
import type { ChMode } from '../navmode'
import { L } from './layout'

// Channel Category popup (green key): CEpgFullMain::t_PopupWindowCreate(0x14) @ 0279e160 builds
// EpgGreenPopUpSubList and shows it in a CPopUpWidget whose left edge is the B help marker's x
// (m_GetPopUpWindowPosition, clamped to FULL_WIN_LIST_W - EPG_POPUPWIDGET_WIDTH), bottom on the help
// bar (FULL_HELP_Y - height), at most 4 rows (m_CreatePopUpWindow @ 0279a0bc).
//
// CPopUpWidget (common widget, AppMWOSDInfo values): POPUPWIDGET_WIDTH 488 x POPUPWIDGET_<n>ITEM_HEIGHT;
// AppCM act_popup_shadow 9-slice over the whole window, AppCM sub_popup_bg 9-slice and a
// SUB_POPUP_BG_ALPHA_COLOR rectangle inset by DEFAULTWND_SHADOW_BG_WIDTH / 2 (m_CreateBackgroundImage
// @ 01927db8); a list of POPUPWIDGET_ITEM_H rows with POPUPWIDGET_LIST_MARGIN_TOP, the focus drawn with
// Common list_highlight (POPUPWIDGET_FOCUS_WIDTH x _HEIGHT) (m_CreateList @ 01927ac4); item text at
// POPUPWIDGET_TEXT_X/_Y, COMMON_FONT_SIZE_18, TEXT_NORMAL_COLOR / TEXT_FOCUS_COLOR
// (CPopUpWidgetTitleRenderer::m_DrawTitle @ 018f6c5c).

export type CategoryItem = { mode: ChMode; label: string }

// EpgGreenPopUpSubList::m_SetCategory @ 027d1340: favourites lists that hold channels, then
// 130 'Show All' (DVB), 72 'TV', 50 'Radio', 12 'Data/Other' for the service types present.
export function categoryItems(channels: Channel[]): CategoryItem[] {
  const items: CategoryItem[] = []
  for (let n = 1; n <= 5; n++) {
    const raw = getSetting<string>(`tv.fav${n}`, '')
    if (raw.split(',').filter(Boolean).length) items.push({ mode: `fav${n}` as ChMode, label: `Favourites ${n}` })
  }
  items.push({ mode: 'all', label: 'Show All' })
  if (channels.some(c => c.kind === 'tv')) items.push({ mode: 'tv', label: 'TV' })
  if (channels.some(c => c.kind === 'radio')) items.push({ mode: 'radio', label: 'Radio' })
  if (channels.some(c => c.kind === 'data')) items.push({ mode: 'data', label: 'Data/Other' })
  return items
}

const P = {
  W: 488, HEIGHTS: [0, 192, 244, 316, 388], SHADOW: 32, ITEM_H: 72, MARGIN_TOP: 34,
  FOCUS_W: 480, FOCUS_H: 128, TEXT_X: 96, TEXT_Y: 12, TEXT_W: 330, TEXT_H: 60, TEXT_SIZE: 36,
  POPUP_W: 480, // EPG_POPUPWIDGET_WIDTH
}
const BG = 0xff222d3b // SUB_POPUP_BG_ALPHA_COLOR
const TEXT = 0xffffffff // TEXT_NORMAL_COLOR
const TEXT_FOCUS = 0xfffdd911 // TEXT_FOCUS_COLOR

export function CategoryPopup({ items, current, anchorX, onClose, onSelect }: {
  items: CategoryItem[]; current: ChMode; anchorX: number; onClose: () => void; onSelect: (m: ChMode) => void
}) {
  const rows = Math.min(4, items.length)
  const [focus, setFocus] = useState(() => Math.max(0, items.findIndex(i => i.mode === current)))
  const [top, setTop] = useState(() => Math.max(0, Math.min(focus - rows + 1, items.length - rows)))

  useRemote(key => {
    switch (key) {
      case 'Up':
      case 'Down': {
        const f = (focus + (key === 'Up' ? -1 : 1) + items.length) % items.length
        playUi(UI_SOUND.MOVE)
        setFocus(f)
        if (f < top) setTop(f)
        else if (f >= top + rows) setTop(f - rows + 1)
        return true
      }
      case 'Enter':
        playUi(UI_SOUND.SELECT)
        onSelect(items[focus].mode)
        return true
      case 'Back':
      case 'Exit':
      case 'Green':
        onClose()
        return true
      default:
        return true
    }
  })

  const h = P.HEIGHTS[rows]
  const x = anchorX + P.POPUP_W > L.WIN_W ? L.WIN_W - P.POPUP_W : anchorX
  const y = L.HELP_Y - h
  const inner = { left: P.SHADOW / 2, top: P.SHADOW / 2, width: P.W - P.SHADOW, height: h - P.SHADOW }
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: P.W, height: h }}>
      <div style={{ position: 'absolute', ...inner, background: argb(BG) }} />
      <div className="g13-nine" style={{ position: 'absolute', left: 0, top: 0, width: P.W, height: h, borderWidth: 34.5, borderImageSlice: '23 fill', borderImageSource: `url(${img('AppCM/act_popup_shadow.bmp')})` }} />
      <div className="g13-nine" style={{ position: 'absolute', ...inner, borderWidth: 72, borderImageSlice: '48 fill', borderImageSource: `url(${img('AppCM/sub_popup_bg.bmp')})` }} />
      <div style={{ position: 'absolute', ...inner, overflow: 'hidden' }}>
        {items.slice(top, top + rows).map((it, i) => {
          const idx = top + i
          const iy = P.MARGIN_TOP + i * P.ITEM_H
          const focused = idx === focus
          return (
            <div key={it.mode} style={{ position: 'absolute', left: 0, top: iy, width: inner.width, height: P.ITEM_H }}>
              {focused && (
                <div className="g13-nine" style={{ position: 'absolute', left: (inner.width - P.FOCUS_W) / 2, top: (P.ITEM_H - P.FOCUS_H) / 2, width: P.FOCUS_W, height: P.FOCUS_H, borderWidth: 60, borderImageSlice: '40 fill', borderImageSource: `url(${img('Common/list_highlight.bmp')})` }} />
              )}
              <div style={{ position: 'absolute', left: P.TEXT_X, top: P.TEXT_Y, width: P.TEXT_W, height: P.TEXT_H, lineHeight: `${P.TEXT_H}px`, whiteSpace: 'pre', overflow: 'hidden', fontSize: P.TEXT_SIZE, color: argb(focused ? TEXT_FOCUS : TEXT) }}>
                {it.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
