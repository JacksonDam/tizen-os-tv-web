import { useEffect, useState, type CSSProperties } from 'react'
import { useRemote } from '../../../../input/remote'
import { openApp, type AppProps } from '../../../shell'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { currentChannel, getSetting, useTv } from '../../../tv/store'
import { argb, img } from '../common'

// TOOLS while watching (CToolActionWindow, a CMenuListActionWindowBase of the Menu engine; items from
// CMenuTreeManager::t_SetToolsItem 0x025519a8, texts via CMenuTextIdFinder::CreateTextId 0x02531d70).
// Layout from MenuOSDInfo::t_InitResolution 0x02580e7c evaluated at 1920 (TOOLS_WINDOW_*): a full-
// height panel 736 px wide at the right edge of the screen (inferred side: its shadow strip
// TOOLS_WINDOW_SHADOW_X = -10 is on the panel's left), the title "Tools" (g_MenuWStringEng 0x68d),
// then one 84 px row per item with the current value on the right.
//
// The items the firmware adds for this set while watching (each class's AddMenuItemFlag):
//   Picture Mode (CPictureModeToolsItem, menu id 0x7f7), Picture Size (CPictureSizeToolsItem,
//   0x7f6), Sleep Timer (CSleepTimerToolsItem, 0x7f9, always), Edit Favourites (CEditMyChannelItem,
//   0x84b, a stored digital channel is being watched).
// Left out: Anynet+ (HDMI-CEC) (0x7011, needs the CEC device menu), and Sports Mode / PIP / Picture
// Off, which depend on the factory option OPTION_TOOLS_SUPPORT (CMenuUtil::FlagToolSupport: option
// 0x35 & 0x100 / 0x400 / 0x200), whose value is not in exeDSP. Subtitle and Audio Language only
// appear for streams with subtitles / several audio tracks; the mocked streams have neither.
//
// Selecting an item opens the Menu at that setting (the firmware opens the item's option list next
// to the panel, TOOLS_WINDOW_POPUP_X; the option lists belong to the Menu).

const PANEL = { w: 736, h: 1080 }                 // TOOLS_WINDOW_W/H
const SHADOW = { x: -10, w: 10 }                  // TOOLS_WINDOW_SHADOW_X/W (tools_bg_shadow.bmp)
const TITLE = { x: 44, y: 48, w: 648, h: 80 }     // TOOLS_WINDOW_TITLE_*
const LIST = { y: 92, marginTop: 44, itemH: 84, maxVisible: 10 } // TOOLS_WINDOW_LIST_Y, _MARGIN_TOP, _ITEM_H, _MAX_VISIBLE_ITEM
const ITEM_TITLE = { x: 56, w: 392, maxW: 624 }   // TOOLS_WINDOW_LIST_TITLE_X/W/MAX_W
const ITEM_VALUE = { x: 472, w: 208 }             // TOOLS_WINDOW_LIST_SUB_DATA_X/W
const FOCUS = { w: 752, h: 140 }                  // TOOLS_WINDOW_LIST_FOCUS_W/H (Common/list_highlight.bmp, HIGHLIGHT_COMPOSITE_ARRAY)
const FONT_30 = 60                                // MenuOSDInfo::FONT_SIZE_30 (title)
const FONT_18 = 36                                // FONT_SIZE_18 (items, CMenuActionWindowTitleRenderer)
const COLOR = {
  white: argb(0xffffffff),       // TEXT_COLOR_WHITE
  focus: argb(0xfffdd910),       // TEXT_COLOR_YELLOW
}
const SLIDE_MS = 300             // (inferred) panel slide

type Item = { id: number; title: string; value?: string; menuItem: string }

// Current values: the Menu's settings, with the firmware's factory defaults (inferred keys).
function items(isTv: boolean, digital: boolean): Item[] {
  const list: Item[] = [
    { id: 0x7f7, title: 'Picture Mode', value: getSetting<string>('picture.mode', 'Standard'), menuItem: 'Picture Mode' },
    { id: 0x7f6, title: 'Picture Size', value: getSetting<string>('picture.size', '16:9'), menuItem: 'Picture Size' },
    { id: 0x7f9, title: 'Sleep Timer', value: getSetting<string>('system.sleepTimer', 'Off'), menuItem: 'Sleep Timer' },
  ]
  if (isTv && digital) list.push({ id: 0x84b, title: 'Edit Favourites', menuItem: 'Edit Favourites' })
  return list
}

export function ToolsApp({ close }: AppProps) {
  const isTv = useTv(s => s.source === 'TV')
  const ch = useTv(currentChannel)
  const list = items(isTv, !!ch && ch.delivery !== 'ATV')
  const [focus, setFocus] = useState(0)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    return () => cancelAnimationFrame(r)
  }, [])

  const leave = () => {
    setShown(false)
    setTimeout(close, SLIDE_MS)
  }

  useRemote(key => {
    switch (key) {
      case 'Up':
      case 'Down': {
        const n = list.length
        const next = (focus + (key === 'Up' ? n - 1 : 1)) % n
        if (next !== focus) {
          setFocus(next)
          playUi(16) // CToolActionWindow::t_ProcessKey: PlayAudio(0x10) (move)
        }
        return true
      }
      case 'Enter': {
        playUi(UI_SOUND.SELECT)
        const it = list[focus]
        if (!openApp('menu', { from: 'tools', item: it.menuItem, firmwareItem: it.id })) leave()
        return true
      }
      case 'Back':
      case 'Exit':
      case 'Tools':
        if (key === 'Back') playUi(UI_SOUND.BACK)
        leave()
        return true
      case 'Left':
      case 'Right':
        return true
      default:
        return false
    }
  })

  const panel: CSSProperties = {
    position: 'absolute',
    left: 1920 - PANEL.w + (shown ? 0 : PANEL.w + SHADOW.w),
    top: 0,
    width: PANEL.w,
    height: PANEL.h,
    transition: `left ${SLIDE_MS}ms cubic-bezier(0.25, 0.6, 0.35, 1)`,
    fontFamily: "'SamsungSVD', sans-serif",
    fontWeight: 500,
    color: COLOR.white,
  }
  const text: CSSProperties = { position: 'absolute', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  return (
    <div style={panel}>
      <img src={img('Menu/tools_bg_shadow.bmp')} alt="" style={{ position: 'absolute', left: SHADOW.x, top: 0, width: SHADOW.w, height: PANEL.h }} />
      <img src={img('Menu/tools_bg.bmp')} alt="" style={{ position: 'absolute', left: 0, top: 0, width: PANEL.w, height: PANEL.h }} />
      <div style={{ ...text, left: TITLE.x, top: TITLE.y, width: TITLE.w, height: TITLE.h, lineHeight: `${TITLE.h}px`, fontSize: FONT_30 }}>Tools</div>
      {list.slice(0, LIST.maxVisible).map((it, i) => {
        const y = LIST.y + LIST.marginTop + i * LIST.itemH
        const f = i === focus
        return (
          <div key={it.id}>
            {f && (
              <div
                style={{
                  position: 'absolute',
                  left: (PANEL.w - FOCUS.w) / 2,
                  top: y + (LIST.itemH - FOCUS.h) / 2,
                  width: FOCUS.w,
                  height: FOCUS.h,
                  borderStyle: 'solid',
                  borderWidth: '63px 61px 65px',
                  borderImageSource: `url(${img('Common/list_highlight.bmp')})`,
                  borderImageSlice: '42 40.67 43.33 fill',
                  borderImageWidth: '63px 61px 65px',
                  boxSizing: 'border-box',
                }}
              />
            )}
            <div style={{ ...text, left: ITEM_TITLE.x, top: y, width: it.value ? ITEM_TITLE.w : ITEM_TITLE.maxW, height: LIST.itemH, lineHeight: `${LIST.itemH}px`, fontSize: FONT_18, color: f ? COLOR.focus : COLOR.white }}>
              {it.title}
            </div>
            {it.value && (
              <div style={{ ...text, left: ITEM_VALUE.x, top: y, width: ITEM_VALUE.w, height: LIST.itemH, lineHeight: `${LIST.itemH}px`, fontSize: FONT_18, color: f ? COLOR.focus : COLOR.white }}>
                {it.value}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
