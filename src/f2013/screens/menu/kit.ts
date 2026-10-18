import { useLayoutEffect, useRef, useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { getSetting } from '../../tv/store'
import { TRANSPARENCY_ALPHA } from './osd'
import type { MenuItem } from './types'
import type { Widget } from './widgets'

// Shared non-component pieces of the Menu (kept out of the .tsx component modules).

// Category icon files (CMenuMainWindow::t_SetCategoryItem: selected, normal, dim, + _opaque variants)
export const CAT_ICON: Record<number, string> = {
  0x14: '01_picture', 0x134: '02_sound', 0x1b6: '03_channel', 3: '04_network', 1: '05_smart', 2: '05_smart',
  0x2cc: '06_system', 0x6e4: '07_support',
}

// Value shown by a container item that displays its child's value (sublist entry items)
export const VALUE_OF: Record<number, number> = { 0x23: 0x24, 0xdb: 0xdc, 0x519: 0x51a, 0x42: 0x43, 0x64: 0x65, 0x197: 0x198, 0x297: 0x298 }

export function findItem(root: MenuItem[], id: number): MenuItem | undefined {
  for (const it of root) {
    if (it.id === id) return it
    const k = it.k && findItem(it.k, id)
    if (k) return k
  }
  return undefined
}

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


// ---------------------------------------------------------------------------------------------
// PIN (CMenuWindowManager::t_ShowPinNumberWindow)

export function currentPin() {
  return String(getSetting<string>('menu.pin', '0000'))
}

export const PIN_TEXT = 'Enter your PIN by using the number buttons on the remote control.'
