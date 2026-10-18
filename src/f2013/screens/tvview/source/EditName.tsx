import { useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { setSetting } from '../../../tv/store'
import { argb } from '../common'
import { deviceName, EDIT_NAMES } from '../sources'
import { Nine, Pic, Text, rgb } from './parts'

// Source > Tools > Edit Name (CSourceEditNameActionWindow, 0x029a14d0..0x029a2a40): a CDefaultWindow
// at SOURCE_EDITNAME_WND_X/Y/W/H with the device-name list (t_SetActionWindowItem) on the left and
// OK / Cancel on the right. The chosen name is stored per input (setting 'source.name.<id>').
const E = {
  X: 380, Y: 132, W: 1160, H: 816,
  TITLE_H: 92, TITLE_FONT: 40, TITLE_COLOR: 0xff7ddcff,            // AppMWOSDInfo ACTION_WINDOW_TITLE_*, TITLE_TEXT_COLOR
  TYPE_X: 100, TYPE_Y: 100, TYPE_W: 796, TYPE_H: 60,               // SOURCE_EDITNAME_SOURCE_TYPE_NAME_*
  LIST_X: 8, LIST_Y: 174, LIST_W: 872, LIST_H: 638,                // SOURCE_EDITNAME_LIST_* / LIST_BG_*
  MARGIN: 60, ITEM_H: 74, HL_W: 872, HL_H: 128,                    // LIST_MARGIN_TOP/BOTTOM, WND_ITEM_H, LIST_HIGHLIGHT_W/H
  ITEM_X: 40, CHECK_X: 40, FONT: 36,                                // SOURCE_EDITNAME_ITEM_X, ITEM_CHECK_ICON_X, ITEM_FONT_SIZE
  BTN_W: 240, BTN_H: 80, BTN1_Y: 370, BTN2_Y: 470, BTN_FONT: 36,  // SOURCE_EDITNAME_WND_2/1_BUTTON_*, BUTTON_FONT_SIZE
  ARROW_X: 404, ARROW_UP_Y: 4, ARROW_DOWN_Y: 590,                  // SOURCE_EDITNAME_WND_PAGE_UP/DOWN_INDICATOR_*
  INNER: [44, 44, 44] as const, INNER_RECT: [102, 102, 102] as const, // SOURCE_EDITNAME_INNERBOX_(RECT_)COLOR
  FOCUS: [255, 186, 25] as const,                                   // SOURCE_EDITNAME_FOCUSED_TEXT_COLOR
}
const VISIBLE = Math.floor((E.LIST_H - 2 * E.MARGIN) / E.ITEM_H)    // 7
const BTN_X = E.LIST_X + E.LIST_W + ((E.W - (E.LIST_X + E.LIST_W)) - E.BTN_W) / 2

export function EditNameWindow({ inputId, title, onClose }: { inputId: string; title: string; onClose: () => void }) {
  const cur = Math.max(0, EDIT_NAMES.indexOf(deviceName(inputId) || '----'))
  const [checked, setChecked] = useState(cur)
  const [focus, setFocus] = useState(cur)
  const [area, setArea] = useState<'list' | 'ok' | 'cancel'>('list')
  const [top, setTop] = useState(() => Math.max(0, Math.min(cur - VISIBLE + 1, EDIT_NAMES.length - VISIBLE, cur)))

  const move = (to: number) => {
    setFocus(to)
    setTop(t => (to < t ? to : to >= t + VISIBLE ? to - VISIBLE + 1 : t))
  }
  const save = () => {
    setSetting(`source.name.${inputId}`, EDIT_NAMES[checked])
    onClose()
  }

  useRemote(key => {
    if (key === 'Back') {
      playUi(UI_SOUND.BACK)
      onClose()
      return true
    }
    if (key === 'Exit') {
      onClose()
      return true
    }
    if (area === 'list') {
      if (key === 'Up' && focus > 0) {
        playUi(16)
        move(focus - 1)
      } else if (key === 'Down' && focus < EDIT_NAMES.length - 1) {
        playUi(16)
        move(focus + 1)
      } else if (key === 'Right') {
        playUi(16)
        setArea('ok')
      } else if (key === 'Enter') {
        // t_OnItemPress checks the item; t_SetFocusToButton then focuses OK (inferred order)
        playUi(UI_SOUND.SELECT)
        setChecked(focus)
        setArea('ok')
      }
      return true
    }
    if (key === 'Left') {
      playUi(16)
      setArea('list')
    } else if (key === 'Up' && area === 'cancel') {
      playUi(16)
      setArea('ok')
    } else if (key === 'Down' && area === 'ok') {
      playUi(16)
      setArea('cancel')
    } else if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (area === 'ok') save()
      else onClose()
    }
    return true
  })

  return (
    <div style={{ position: 'absolute', left: E.X, top: E.Y, width: E.W, height: E.H }}>
      <Nine src="AppCM/act_popup_shadow.bmp" x={-16} y={-16} w={E.W + 32} h={E.H + 32} t={23} r={23} b={23} l={23} />
      {/* CDefaultWindow body: BG_ALPHA_COLOR black under the act_window_bg sheen (alpha inferred) */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)' }} />
      <Nine src="AppCM/act_window_bg.bmp" x={0} y={0} w={E.W} h={E.H} t={93} r={24} b={69} l={24} />
      <Text x={0} y={0} w={E.W} h={E.TITLE_H} size={E.TITLE_FONT} color={argb(E.TITLE_COLOR)} h_align={1}>Edit Name</Text>
      <Text x={E.TYPE_X} y={E.TYPE_Y} w={E.TYPE_W} h={E.TYPE_H} size={E.FONT} color="#fff">{title}</Text>
      <div style={{
        position: 'absolute', left: E.LIST_X, top: E.LIST_Y, width: E.LIST_W, height: E.LIST_H,
        background: rgb(...E.INNER), boxShadow: `inset 0 0 0 2px ${rgb(...E.INNER_RECT)}`, overflow: 'hidden',
      }}>
        {area === 'list' && (
          <Nine src="SourceBrowser/list_highlight.bmp" x={0} y={E.MARGIN + (focus - top) * E.ITEM_H + (E.ITEM_H - E.HL_H) / 2}
            w={E.HL_W} h={E.HL_H} t={30} r={30} b={30} l={30} />
        )}
        {EDIT_NAMES.slice(top, top + VISIBLE).map((n, k) => {
          const i = top + k
          const y = E.MARGIN + k * E.ITEM_H
          return (
            <div key={n}>
              {i === checked && <Pic src="SourceBrowser/list_check_icon.bmp" x={E.CHECK_X} y={y + (E.ITEM_H - 48) / 2} w={48} h={48} />}
              <Text x={E.ITEM_X + 60} y={y} w={E.LIST_W - E.ITEM_X - 100} h={E.ITEM_H} size={E.FONT}
                color={area === 'list' && i === focus ? rgb(...E.FOCUS) : '#fff'}>{n}</Text>
            </div>
          )
        })}
        {top > 0 && <Pic src="SourceBrowser/act_arrow_up_sel.bmp" x={E.ARROW_X} y={E.ARROW_UP_Y} w={63} h={43.5} />}
        {top + VISIBLE < EDIT_NAMES.length && <Pic src="SourceBrowser/act_arrow_down_sel.bmp" x={E.ARROW_X} y={E.ARROW_DOWN_Y} w={63} h={43.5} />}
      </div>
      <Button x={BTN_X} y={E.BTN1_Y} label="OK" focused={area === 'ok'} />
      <Button x={BTN_X} y={E.BTN2_Y} label="Cancel" focused={area === 'cancel'} />
    </div>
  )
}

// CCButtonControl with Common/btn_normal_40 / btn_select_40 composites, white text.
export function Button({ x, y, label, focused, w = E.BTN_W, h = E.BTN_H }: {
  x: number; y: number; label: string; focused: boolean; w?: number; h?: number
}) {
  return (
    <>
      <Nine src={focused ? 'Common/btn_select_40.bmp' : 'Common/btn_normal_40.bmp'} x={x} y={y} w={w} h={h} t={26} r={22} b={26} l={22} />
      <Text x={x} y={y} w={w} h={h} size={E.BTN_FONT} color="#fff" h_align={1}>{label}</Text>
    </>
  )
}
