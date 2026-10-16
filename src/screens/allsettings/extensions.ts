import type { ComponentType } from 'react'
import type { MenuItem } from './menuData'

// Extension points of the All Settings card for the parts of the TV that are separate programs on the
// real firmware: NUI gadgets drawn inside the panel (About TV), popups drawn over it (Auto Tuning's
// confirmation) and full-screen apps launched from a row (Device Care, Software Update, channel scan).

export type SettingsHost = {
  launchApp: (app: string, args?: Record<string, string>) => void  // closes All Settings, starts the app
  close: () => void                                                 // closes All Settings
  openPath?: (path: string[]) => void                               // closes the gadget, opens the pages down to a row by id
}

// In-panel page. `active` is false while a popup is over it; call onClose to return to the parent page.
export type GadgetProps = { host: SettingsHost; item: MenuItem; active: boolean; onClose: () => void }
export type Gadget = { width: 520 | 744 | 920; component: ComponentType<GadgetProps> }

// Popup over the panel (the panel dims to rgba(19,29,34,.4)). Call onClose to dismiss it.
export type PopupProps = { host: SettingsHost; item: MenuItem; onClose: () => void }

export const GADGETS: Record<string, Gadget> = {}
export const POPUPS: Record<string, ComponentType<PopupProps>> = {}

export function registerGadget(id: string, gadget: Gadget) {
  GADGETS[id] = gadget
}
export function registerPopup(id: string, popup: ComponentType<PopupProps>) {
  POPUPS[id] = popup
}
