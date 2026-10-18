import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { argb } from '../common'
import { L } from './layout'
import { Nine, Text } from './parts'

export type PopupItem = { id: number; label: string }

// The Tools sub list of the Source app: a CPopUpWidget at SOURCE_TOOLS_SUBLIST_X/Y
// (CSourceWidgetAgency::t_ShowPopup 0x029a30bc, keys in t_OnPopupCallback 0x029a404c).
export function ToolsPopup({ items, onClose, onSelect, onKey }: {
  items: PopupItem[]
  onClose: (how: 'popup' | 'app') => void
  onSelect: (id: number) => void
  onKey: () => void
}) {
  const [focus, setFocus] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // CSourcePopUpWidget::StartTimeOutAlarm (duration inferred: the Source window's 5 s).
  const arm = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onClose('app'), L.TIMEOUT_MS)
  }
  useEffect(() => {
    arm()
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useRemote(key => {
    arm()
    onKey()
    switch (key) {
      case 'Up':
        if (focus > 0) {
          playUi(16)
          setFocus(focus - 1)
        }
        return true
      case 'Down':
        if (focus < items.length - 1) {
          playUi(16)
          setFocus(focus + 1)
        }
        return true
      case 'Enter':
        playUi(UI_SOUND.SELECT)
        onSelect(items[focus].id)
        return true
      case 'Back':
      case 'Tools':
        playUi(UI_SOUND.BACK)
        onClose('popup')
        return true
      case 'Exit':
      case 'Source':
        onClose('app')
        return true
      case 'Left':
      case 'Right':
        return true
      default:
        return false
    }
  })

  const h = L.POP_H[Math.min(items.length, 7)]
  const sh = L.POP_SHADOW / 2
  const listY = sh + L.POP_MARGIN
  return (
    <div style={{ position: 'absolute', left: L.POP_X, top: L.POP_Y, width: L.POP_W, height: h }}>
      {/* CPopUpWidget::m_CreateBackgroundImage: shadow, alpha rectangle, body frame */}
      <Nine src="AppCM/act_popup_shadow.bmp" x={0} y={0} w={L.POP_W} h={h} t={23} r={23} b={23} l={23} />
      <div style={{ position: 'absolute', left: sh, top: sh, width: L.POP_W - L.POP_SHADOW, height: h - L.POP_SHADOW, background: argb(L.POP_BG) }} />
      <Nine src="AppCM/sub_popup_bg.bmp" x={sh} y={sh} w={L.POP_W - L.POP_SHADOW} h={h - L.POP_SHADOW} t={48} r={48} b={48} l={48} />
      {/* focus (Common/list_highlight, POPUPWIDGET_FOCUS_W/H), centred on the item (inferred) */}
      <Nine src="Common/list_highlight.bmp"
        x={sh + (L.POP_W - L.POP_SHADOW - L.POP_FOCUS_W) / 2} y={listY + focus * L.POP_ITEM_H + (L.POP_ITEM_H - L.POP_FOCUS_H) / 2}
        w={L.POP_FOCUS_W} h={L.POP_FOCUS_H} t={40} r={40} b={41} l={40} />
      {items.map((it, i) => (
        <Text key={it.id} x={sh + L.POP_TEXT_X} y={listY + i * L.POP_ITEM_H + L.POP_TEXT_Y} w={L.POP_TEXT_W} h={L.POP_TEXT_H}
          size={L.POP_FONT} color={i === focus ? argb(L.POP_TEXT_FOCUS) : '#fff'}>
          {it.label}
        </Text>
      ))}
    </div>
  )
}

// CMessageBox without buttons at SOURCE_MSG_BOX_X/Y/W/H: shadow (act_popup_shadow), body
// (AppCM/message_popup_bg), centred text; hides after 5 s or on RETURN/EXIT/Enter.
export function MessageBox({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, L.MSG_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [onClose])
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Enter') {
      if (key === 'Back') playUi(UI_SOUND.BACK)
      onClose()
      return true
    }
    return key === 'Up' || key === 'Down' || key === 'Left' || key === 'Right' || key === 'Tools' || key === 'Source'
  })
  const sh = L.POP_SHADOW / 2
  return (
    <div style={{ position: 'absolute', left: L.MSG_X, top: L.MSG_Y, width: L.MSG_W, height: L.MSG_H }}>
      <Nine src="AppCM/act_popup_shadow.bmp" x={-sh} y={-sh} w={L.MSG_W + L.POP_SHADOW} h={L.MSG_H + L.POP_SHADOW} t={23} r={23} b={23} l={23} />
      <Nine src="AppCM/message_popup_bg.bmp" x={0} y={0} w={L.MSG_W} h={L.MSG_H} t={48} r={27} b={48} l={27} />
      <div style={{
        position: 'absolute', left: 40, top: 0, width: L.MSG_W - 80, height: L.MSG_H,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        fontSize: L.MSG_FONT, color: '#fff', lineHeight: `${L.MSG_FONT + L.MSG_ROW_GAP}px`,
      }}>
        {text}
      </div>
    </div>
  )
}
