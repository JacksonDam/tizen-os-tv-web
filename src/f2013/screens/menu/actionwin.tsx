import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getSetting } from '../../tv/store'
import { TRANSPARENCY_ALPHA } from './osd'
import { IMG } from './parts'
import type { MenuItem } from './types'
import type { Widget } from './widgets'
import { NetworkSettings, NetworkStatus } from './network'
import { PictureTest, SoundTest } from './selftest'
import { Equaliser } from './equaliser'
import { SignalInformation } from './siginfo'
import { TimerWindow } from './timer'

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

export const AW = {
  TITLE_H: 61,
  TITLE_SIZE: 26,
  TITLE_COLOR: '#7ddcff',
  INNER_BOX: 'rgba(74, 74, 74, 0.349)',
  BUTTON_W: 186,
  BUTTON_H: 53,
  BUTTON_BOTTOM_GAP: 10,
  FONT_18: 24,
}

export function transparencyAlpha() {
  return TRANSPARENCY_ALPHA[Number(getSetting<number>('menu.958', 1))] ?? TRANSPARENCY_ALPHA[1]
}

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

export type AWProps = { close: () => void; exitMenu: () => void; change?: (w: Widget | null) => void }

// Common action window keys (CMenuActionWindowBase::t_OnInput): RETURN closes the window, EXIT and
// MENU close the Menu. Returns true when the key was handled.
export function baseKeys(k: RemoteKey, { close, exitMenu }: AWProps) {
  if (k === 'Back') {
    close()
    return true
  }
  if (k === 'Exit' || k === 'Settings') {
    exitMenu()
    return true
  }
  return false
}

// ---------------------------------------------------------------------------------------------
// Text pages (CCTextPageDrawing): multi-line word-wrapped text, `rows` rows per page, Up/Down page,
// act_arrow_up/down_nor cues while there is a previous / next page.

export function usePages(text: string, rowH: number, rows: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setPages(Math.max(1, Math.ceil(Math.round(el.scrollHeight / rowH) / rows)))
  }, [text, rowH, rows])
  return { ref, pages, page, setPage }
}

// ---------------------------------------------------------------------------------------------
// Support > Contact Samsung (CContactSamsungActionWindow): window 826x536 centred, title = the item
// name, inner box (13,71) 800x394, text page 757 wide at (47,87), 11 rows of 24 px text with an 8 px
// row gap per page, scroll cues centred on the inner box top (71) and bottom (465). Up/Down turn the
// page, OK on Close or RETURN closes, RED opens the open source licence window (left out, see spec).
//
// Text = t_GetContactInfo + "\n\n" + t_GetProductInfo + "\n\n" + t_GetSmartHubInfo + "\n\n" +
// t_GetOpenSourceInfo (t_MakeTextPages), for the UK (country 7: the "Web Site" branch).

export const MODEL_CODE = 'UE40F6400'          // (inferred) the exhibit's model; TCTv::GetModelName comes from the panel EEPROM
export const SW_VERSION = 'T-MST12DEUC-2130.0' // factory string 1 (the firmware's version)

export function contactSamsungText(title: string) {
  const contact =
    'Please contact Samsung if you are having problems operating this device.' + '\n\n' +
    title +
    '\n - ' + 'Web Site' + ' : ' + 'Visit www.samsung.com, then select your country.' +
    '\n - ' + 'You can find the latest phone number for our Call Centre on the website.'
  // Product information: model code, software version; no Bluetooth pairing, MAC addresses (the
  // mocked set has no network interface to report), camera, microphone or stored serial number,
  // so the sticker note follows (TCConfig::Default(0xb) = 1: "TV" wording).
  const product =
    'Product Information' + '\n' +
    ' - ' + 'Model Code' + ' : ' + MODEL_CODE + '\n' +
    ' - ' + 'Software Version' + ' : ' + SW_VERSION +
    '\n - ' + 'The serial and version numbers can be found on the sticker on the back or right side of your TV.'
  // Smart Hub information: the values come from the Smart Hub process (InfoLink wrapper) and are
  // left empty here (inferred: no Smart Hub data in an offline rebuild); no Netflix ESN (not installed).
  const smartHub =
    'Smart Hub Information' + '\n' +
    ' - ' + 'Apps Version' + ' : ' + '\n' +
    ' - ' + 'Unique ID' + ' : '
  const openSource = 'Press Red Key to see Open Source License.'
  return contact + '\n\n' + product + '\n\n' + smartHub + '\n\n' + openSource
}

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

// ---------------------------------------------------------------------------------------------
// Items whose OK opens one of these windows (t_MenuItemController "action:<id>").

export function actionWindow(it: MenuItem): Widget | null {
  switch (it.id) {
    case 0x6e5:
      return { kind: 'custom', item: it, render: p => <ContactSamsung title={it.t} {...p} /> }
    case 0x4e:   // Network Status (network app; the Menu is hidden while it runs, inferred)
      return { kind: 'custom', item: it, hideMenu: true, render: p => <NetworkStatus {...p} openSettings={() => p.change?.(networkSettingsWidget(it))} /> }
    case 0x4d:   // Network Settings
      return networkSettingsWidget(it)
    case 0x143:  // Sound Effect > Equaliser
      return { kind: 'custom', item: it, render: p => <Equaliser {...p} /> }
    case 0x6ea:  // Self Diagnosis > Picture Test
      return { kind: 'custom', item: it, hideMenu: true, render: p => <PictureTest item={it} {...p} /> }
    case 0x3a2: case 0x3a3: case 0x3a4: case 0x3aa: case 0x3ab: case 0x3ac:   // On / Off Timer 1-3
      return { kind: 'custom', item: it, render: p => <TimerWindow item={it} {...p} /> }
    case 0x6ed:  // Self Diagnosis > Signal Information
      return { kind: 'custom', item: it, render: p => <SignalInformation item={it} {...p} /> }
    case 0x6ec:  // Self Diagnosis > Sound Test
      return { kind: 'custom', item: it, hideMenu: true, render: p => <SoundTest item={it} {...p} /> }
  }
  return null
}

function networkSettingsWidget(it: MenuItem): Widget {
  return { kind: 'custom', item: it, hideMenu: true, render: p => <NetworkSettings {...p} /> }
}
