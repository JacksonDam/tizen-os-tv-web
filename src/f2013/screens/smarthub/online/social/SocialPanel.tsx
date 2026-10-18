import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRemote } from '../../../../../input/remote'
import { openApp, useForeground } from '../../../../shell'
import { playUi, UI_SOUND } from '../../../../tv/sound'
import { SOCIAL } from '../../data'
import type { OnlinePanelProps } from '../../panels'
import { MessageBox } from '../../../menu/widgets'
import { fw, MEDIUM } from '../hubapps/assets'
import type { RunParams } from '../hubapps/AppRunner'
import { SAMSUNG_APPS } from '../hubapps/catalog'
import { SocialSettings } from './SocialSettings'

// The Social panel online (CHomeCommunicationPanel, panel id 0) on a TV without social accounts: the
// Facebook and Twitter apps are not installed and Skype is not installed, so CHomeSocialInfo reports
// content area state 4 and recent call area state 3, and the panel shows its two banners
// (CHomeHighlightAniWindow) instead of the tables. m_InitializePanel @02be1cb0, m_InitializeBanner
// @02be0a00, m_SetBannerContentArea @02be3860, m_SetBannerRecentCallArea @02be3558,
// CHomeCommunicationBannerInputListener::NotifyKeyPress @02be4534; values CHomeOSDInfo (Full HD).
// Spec: samsung-tv-qemu/extract/f13/spec/online-apps2013.md.
//   Titles (size 32, Medium, 0xff0c6634, left/middle, 380x44): "Friends' Picks" (0x20; state 4 uses it,
//   m_SetTableTitle(false)) at GBHOME_COMM_MAIN_GRID_TITLE_POS (184, 112), "Recent Calls" (0x25) at
//   (184, 668).
//   Content banner: the main grid area (184, 164) 1550x492, black at GBHOME_SOCIAL_BANNER_OPACITY 0.7
//   under social_cold_start_top.png (HomePanel 0xa2, 1034x329 at 1.5x); its text (0x2f for state 4) at
//   GBHOME_SOCIAL_BANNER_HIGHLIGHT_GAP (24, 24) in a 1550x492 box, size 34, 0xff84b290, centre/middle,
//   rows 4 px apart; 0xfffdd911 while focused, when the focus image (highlight_all.png) frames it 24 px
//   out.
//   Recent calls banner: (184, 722) 1550x185 (GBHOME_SOCIAL_SUB_BANNER_HEIGHT) under
//   social_cold_start_bottom.png (0xa3), text 0x2e for state 3.
// Enter on the content banner (states 4 / 5) runs the Social Settings popup (CHomeExecutor::
// RunSNSSettingPopup -> app 200, CSocialSettingApp); on the recent calls banner (state 3) Samsung Apps
// on the Skype page (GoToSkypeInstallPage), which the exhibit cannot run.

const MAIN = { x: 184, y: 164, w: 1550, h: 492 }
const SUB = { x: 184, y: 722, w: 1550, h: 185 }
const GAP = 24

const TEXT_CONTENT = 'Enjoy socialising over your TV by installing social network apps from Samsung Apps.\n\n*Supported apps: Facebook, Twitter' // 0x2f
const TEXT_CALLS = 'Install the Skype app from Samsung Apps to use Video Call. Select the Install button to install.' // 0x2e

// Requests from the panel and its sub menu (which has the keys while its item runs): the Social Settings
// window or the Video Call message. Both are separate windows over the whole Smart Hub (the settings are
// their own application, 200), so they are drawn by an overlay above it (SocialPopups), with the launch
// motion of whoever asked.
type Kind = 'settings' | 'videocall'
type Request = { kind: Kind; launch?: (run: () => void) => void } | null
let request: Request = null
const subs = new Set<() => void>()
export function requestSocial(kind: Kind | null, launch?: (run: () => void) => void) {
  request = kind ? { kind, launch } : null
  subs.forEach(f => f())
}
function useRequest() {
  return useSyncExternalStore(f => {
    subs.add(f)
    return () => subs.delete(f)
  }, () => request)
}

function runSamsungApps(launch?: (run: () => void) => void) {
  const go = () => openApp('hubapp', { id: SAMSUNG_APPS, name: 'Samsung Apps', from: SOCIAL } satisfies RunParams)
  if (launch) launch(go)
  else go()
}

export function SocialPanel({ active, exitUp, exitDown, launch }: OnlinePanelProps) {
  const [focus, setFocus] = useState<'main' | 'sub'>('main')
  const req = useRequest()
  const ref = useRef(focus)
  ref.current = focus

  useRemote(key => {
    switch (key) {
      case 'Up':
        if (ref.current === 'sub') {
          playUi(UI_SOUND.MOVE)
          setFocus('main')
        } else exitUp()
        return true
      case 'Down':
        if (ref.current === 'main') {
          playUi(UI_SOUND.MOVE)
          setFocus('sub')
        } else exitDown?.()
        return true
      case 'Enter':
        // NotifyKeyPress: PlayAudio, then the banner's action
        playUi(UI_SOUND.SELECT)
        if (ref.current === 'main') requestSocial('settings', launch)
        else runSamsungApps(launch)
        return true
      default:
        return false // Left/Right turn the carousel, RETURN/EXIT/SMART HUB go to it
    }
  }, active && !req)

  const mainF = active && focus === 'main' && !req
  const subF = active && focus === 'sub' && !req
  return (
    <div className="hub">
      <Title x={184} y={112} text="Friends' Picks" />
      <Title x={184} y={668} text="Recent Calls" />
      <Banner r={MAIN} img="HomePanel/social_cold_start_top.png" text={TEXT_CONTENT} focused={mainF} />
      <Banner r={SUB} img="HomePanel/social_cold_start_bottom.png" text={TEXT_CALLS} focused={subF} />
    </div>
  )
}

// The overlay drawing the requested window above the Smart Hub (registered in hubapps/index.ts).
export function SocialPopups() {
  const req = useRequest()
  const fg = useForeground()
  const onHub = fg?.id === 'smarthub'
  useEffect(() => {
    if (!onHub && request) requestSocial(null)
  }, [onHub])
  if (!req || !onHub) return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 250 }}>
      {req.kind === 'settings' ? <SocialSettings onClose={() => requestSocial(null)} launch={req.launch} /> : <VideoCallMessage launch={req.launch} />}
    </div>
  )
}

// The Video Call message (event 0x11903b: CHomeWindowManager::m_ShowPopupMessage(0x2e, 0x33 Install,
// 0x16 Cancel)); drawn as the common message box (inferred: CHomePopupMessageBox's geometry was not
// traced).
function VideoCallMessage({ launch }: { launch?: (run: () => void) => void }) {
  const [sel, setSel] = useState(0)
  const ref = useRef(sel)
  ref.current = sel
  useRemote(key => {
    if (key === 'Left' || key === 'Right') {
      const n = key === 'Right' ? 1 : 0
      if (n !== ref.current) {
        playUi(UI_SOUND.MOVE)
        setSel(n)
      }
      return true
    }
    if (key === 'Enter') {
      playUi(UI_SOUND.SELECT)
      requestSocial(null)
      if (ref.current === 0) runSamsungApps(launch)
      return true
    }
    if (key === 'Back' || key === 'Exit') {
      playUi(UI_SOUND.BACK)
      requestSocial(null)
      return true
    }
    return key !== 'Home' && key !== 'VolumeUp' && key !== 'VolumeDown' && key !== 'Mute' && key !== 'Power'
  })
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: 'scale(1.5)', transformOrigin: '0 0' }}>
      <MessageBox box={{ text: TEXT_CALLS, buttons: ['Install', 'Cancel'] }} focus={sel} />
    </div>
  )
}

function Title({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div className="hub-abs" style={{ left: x, top: y, width: 380, height: 44, lineHeight: '44px', fontSize: 32, fontWeight: MEDIUM, color: '#0c6634', whiteSpace: 'nowrap' }}>
      {text}
    </div>
  )
}

function Banner({ r, img, text, focused }: { r: { x: number; y: number; w: number; h: number }; img: string; text: string; focused: boolean }) {
  return (
    <>
      <div className="hub-abs" style={{ left: r.x, top: r.y, width: r.w, height: r.h, background: 'rgba(0,0,0,0.7)' }}>
        <img src={fw(img)} alt="" style={{ position: 'absolute', left: 0, top: 0, width: r.w, height: r.h, imageRendering: 'auto' }} />
        <div
          style={{
            // the text drawing sits at (24, 24) in the highlight window, which is the banner grown by the
            // 24 px focus gap on every side: the banner area itself
            position: 'absolute', left: 0, top: 0, width: r.w, height: r.h, display: 'flex', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center', whiteSpace: 'pre-line', fontSize: 34, lineHeight: '38px', fontWeight: MEDIUM,
            color: focused ? '#fdd911' : '#84b290',
          }}
        >
          {text}
        </div>
      </div>
      {focused && (
        <div
          className="hub-focus"
          style={{
            left: r.x - GAP, top: r.y - GAP, width: r.w + 2 * GAP, height: r.h + 2 * GAP,
            borderImageSource: `url(${fw('HomePanel/icon/highlight_all.png')})`,
          }}
        />
      )}
    </>
  )
}

