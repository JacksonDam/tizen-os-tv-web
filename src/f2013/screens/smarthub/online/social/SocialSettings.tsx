import { useRef, useState } from 'react'
import { useRemote } from '../../../../../input/remote'
import { getApp, openApp } from '../../../../shell'
import { playUi, UI_SOUND } from '../../../../tv/sound'
import { useSmartHub } from '../../../../tv/online'
import { SOCIAL } from '../../data'
import { fw } from '../hubapps/assets'
import type { RunParams } from '../hubapps/AppRunner'
import { SAMSUNG_APPS } from '../hubapps/catalog'
import { Nine } from '../hubapps/sh'

// Social Settings (CSocialSettingApp, application 200, run by CHomeExecutor::RunSNSSettingPopup over the
// Smart Hub): CSocialSettingWnd::Create @02eb9778 and its parts, in the 1280x720 OSD of
// CSocialSettingOSDInfo::t_InitSSTV1280x720 @02eb1e98 (drawn x1.5). Texts g_CTWStringEng.
//   Window CT_ACCOUNT_LINK_WND_RECT (338, 46) 602x626, act_window_bg.PNG / act_popup_shadow.PNG
//   (g_CTImage 0xb6 / 0xb7; the 9-slice sizes are inferred).
//   Title "Social Settings" (0x27) CT_LINK_WND_TITLE_RECT (13, 10) 576x53, size 26, 0xff7fd0ff,
//   centre/middle; a 1 px line at (10, 66) 581 wide, 0xb27f7f7f.
//   Description (0x2a) (40, 66) 522x104, size 24, white, left/middle.
//   Signed out: "Log in to link your social network accounts." (0x2b) in
//   CT_LINK_WND_LOGIN_STATUS_DESCRIPTION_RECT (40, 176) 346x34, size 24 (CT_LINK_WND_LOGIN_TEXT_FONT_SIZE),
//   cut with "…" (the signed-in status with the user icon uses the (45, 181) icon and (80, 178) text
//   rects); "Log in" (0x2c) button (394, 165) 200x53.
//   Two lists on 0x594a4a4a rectangles: the accounts to link (CT_LINK_WND_LIST_RECT (13, 226), bg (20,
//   233) 562x193) with "Link Service Accounts" (0x63) under them at (114, 370) 373x53, and the apps to
//   install (CT_LINK_WND_LIST_RECT_INSTALL (13, 426), bg (20, 433) 562x133); items 576x58 with 10 px
//   margins: service icon (13, 8) 56x48, name (93, 4) 237x48 size 24, status (400, 5) 136x48 size 21;
//   the focused item carries social_list_high.png (0x84) at (-8, -8) 592x101.
//   "Close" (0x5c) button (208, 565) 186x53; buttons are btn_social_nor / _high (0x98 / 0x97), text
//   size 24.
// Signed out, the link list and its button are dim and cannot take the focus (m_CheckLinkAble,
// m_LinkListFocusableCallback). Log in opens the Samsung account sign-in; Install opens Samsung Apps on
// the app's page, which the exhibit cannot run.

const WX = 338
const WY = 46
const W = 602
const H = 626

// The services the firmware lists (its own labels and icons: SOCIALPANEL/SettingApp/icon).
const SERVICES = [
  { id: 'facebook', name: 'Facebook', icon: 'icon_service_facebook' },
  { id: 'twitter', name: 'Twitter', icon: 'icon_service_twitter' },
]

type Focus = 'login' | 'install0' | 'install1' | 'close'
const ORDER: Focus[] = ['login', 'install0', 'install1', 'close']

export function SocialSettings({ onClose, launch }: { onClose: () => void; launch?: (run: () => void) => void }) {
  const account = useSmartHub().account
  const [focus, setFocus] = useState<Focus>('login')
  const ref = useRef(focus)
  ref.current = focus

  function move(d: 1 | -1) {
    const i = ORDER.indexOf(ref.current) + d
    if (i < 0 || i >= ORDER.length) return
    playUi(UI_SOUND.MOVE)
    setFocus(ORDER[i])
  }

  useRemote(key => {
    switch (key) {
      case 'Up':
        move(-1)
        return true
      case 'Down':
        move(1)
        return true
      case 'Left':
      case 'Right':
        return true
      case 'Enter': {
        playUi(UI_SOUND.SELECT)
        const f = ref.current
        if (f === 'close') onClose()
        else if (f === 'login') {
          onClose()
          if (getApp('samsungaccount')) openApp('samsungaccount', { from: 'social' })
        } else {
          onClose()
          const go = () => openApp('hubapp', { id: SAMSUNG_APPS, name: 'Samsung Apps', from: SOCIAL } satisfies RunParams)
          if (launch) launch(go)
          else go()
        }
        return true
      }
      case 'Back':
        playUi(UI_SOUND.BACK)
        onClose()
        return true
      case 'Exit':
        onClose()
        return false // EXIT also leaves the Smart Hub
      default:
        return key !== 'Home' && key !== 'VolumeUp' && key !== 'VolumeDown' && key !== 'Mute' && key !== 'Power'
    }
  })

  const btn = (x: number, y: number, w: number, label: string, hi: boolean, dim = false) => (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: 53, opacity: dim ? 0.4 : 1 }}>
      <Nine src={`SOCIALPANEL/btn/btn_social_${hi ? 'high' : 'nor'}.png`} slice={[20, 20, 20, 20]} x={0} y={0} w={w} h={53} />
      <div style={{ position: 'absolute', inset: 0, lineHeight: '53px', textAlign: 'center', fontSize: 24, color: '#fff' }}>{label}</div>
    </div>
  )

  const item = (y: number, s: (typeof SERVICES)[number], status: string, focused: boolean, dim: boolean) => (
    <div key={`${s.id}${y}`} style={{ position: 'absolute', left: 13, top: y, width: 576, height: 58, opacity: dim ? 0.4 : 1 }}>
      {focused && <img src={fw('SOCIALPANEL/highlight/social_list_high.png')} alt="" style={{ position: 'absolute', left: -8, top: -8, width: 592, height: 101 - 27 }} />}
      <img src={fw(`SOCIALPANEL/SettingApp/icon/${s.icon}.png`)} alt="" style={{ position: 'absolute', left: 13, top: 5 }} />
      <div style={{ position: 'absolute', left: 93, top: 4, width: 237, height: 48, lineHeight: '48px', fontSize: 24, color: focused ? '#fdd911' : '#fff' }}>{s.name}</div>
      <div style={{ position: 'absolute', left: 400, top: 5, width: 136, height: 48, lineHeight: '48px', fontSize: 21, color: '#fff', textAlign: 'right' }}>{status}</div>
    </div>
  )

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: 'scale(1.5)', transformOrigin: '0 0', fontFamily: "'SamsungSVD', sans-serif", fontWeight: 500, color: '#fff' }}>
      <div style={{ position: 'absolute', left: WX, top: WY, width: W, height: H }}>
        <Nine src="SOCIALPANEL/popup/act_popup_shadow.PNG" slice={[20, 20, 20, 20]} x={-10} y={-10} w={W + 20} h={H + 20} />
        <div style={{ position: 'absolute', inset: 4, background: 'rgba(20,24,28,0.94)' }} />
        <Nine src="SOCIALPANEL/popup/act_window_bg.PNG" slice={[20, 60, 20, 60]} x={0} y={0} w={W} h={H} />
        <div style={{ position: 'absolute', left: 13, top: 10, width: 576, height: 53, lineHeight: '53px', textAlign: 'center', fontSize: 26, color: '#7fd0ff' }}>Social Settings</div>
        <div style={{ position: 'absolute', left: 10, top: 66, width: 581, height: 1, background: 'rgba(127,127,127,0.7)' }} />
        <div style={{ position: 'absolute', left: 40, top: 66, width: 522, height: 104, fontSize: 24, display: 'flex', alignItems: 'center' }}>
          Install the app below, then link the account with your Samsung account to use the service.
        </div>
        {!account && (
          <>
            <div style={{ position: 'absolute', left: 40, top: 176, width: 346, height: 34, lineHeight: '34px', fontSize: 24, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Log in to link your social network accounts.</div>
            {btn(394, 165, 200, 'Log in', focus === 'login')}
          </>
        )}
        <div style={{ position: 'absolute', left: 20, top: 233, width: 562, height: 193, background: 'rgba(74,74,74,0.35)' }} />
        {SERVICES.map((s, i) => item(236 + i * 58, s, 'Unlinked', false, !account))}
        {btn(114, 370, 373, 'Link Service Accounts', false, !account)}
        <div style={{ position: 'absolute', left: 20, top: 433, width: 562, height: 133, background: 'rgba(74,74,74,0.35)' }} />
        {SERVICES.map((s, i) => item(436 + i * 58, s, 'Install', focus === `install${i}`, false))}
        {btn(208, 565, 186, 'Close', focus === 'close')}
      </div>
    </div>
  )
}
