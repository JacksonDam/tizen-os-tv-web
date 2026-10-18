import type { ComponentType } from 'react'

// Online panel bodies. When the TV is online with the Smart Hub terms agreed (useSmartHubOnline in
// src/f2013/tv/online.ts) the carousel (Hub.tsx) draws each panel's frame and, inside it, the body a
// panel module registered here for that panel id (SOCIAL, ONTV, MOVIES, APPS, GAMES, MULTIMEDIA... from
// ./data). Without a registration the carousel falls back to the default "Set Up Smart Hub" page.
//
// Focus between the parts (firmware: the Apps/Games/Social tables send 0x119012 on Up past the top row
// and 0x119011 on Down past the last row): the body calls exitUp() to give focus to the top menu and
// exitDown() to give it to the bottom sub menu (CHomeSubMenuWindow). Enter on sub menu item i calls the
// panel's `submenu(i)` option, which returns true when it handled the item.
//
// An app a body launches replaces the Smart Hub (openApp(<its id>)), as the firmware closes the Smart
// Hub to run an app; returning from it reopens the Smart Hub on that panel with
// openApp('smarthub', { panel: <panel id> }), which plays the normalize motion.
//
// Table items: a body wraps each item in <FlipItem> (./flip.tsx) with its table's flip layout and cell
// rectangles, so the items fold away while the carousel hands over (launch) and unfold when the Smart
// Hub comes back.

export type OnlinePanelProps = {
  // The panel is the centred one and its body owns the keys (not the top menu, the sub menu or a move
  // animation).
  active: boolean
  // Size of the panel body in stage px (the carousel positions it).
  width: number
  height: number
  // Up on the body's top row: focus goes to the top menu.
  exitUp: () => void
  // Down on the body's last row: focus goes to the sub menu.
  exitDown?: () => void
  // Running an item: the body plays its select sound and calls launch(run); the carousel plays the
  // minimize motion (CHomePanelMainWindow::OnMinimizeWindow, events 0x11901d-0x11901f) and calls run()
  // when it completes (m_CompleteMinimizeMotion -> CHomeExecutor::ExecuteGridItem). Without launch the
  // body calls run() itself.
  launch?: (run: () => void) => void
}

export type OnlinePanelOptions = {
  // Enter on sub menu item i. `launch` is the same minimize-then-run hand-over as the prop above.
  submenu?: (index: number, launch: (run: () => void) => void) => boolean
}

export type SmartHubParams = { page?: 'welcome' | 'terms' | 'complete'; panel?: number }

const bodies = new Map<number, { body: ComponentType<OnlinePanelProps>; opts: OnlinePanelOptions }>()

export function registerOnlinePanel(panelId: number, body: ComponentType<OnlinePanelProps>, opts: OnlinePanelOptions = {}) {
  bodies.set(panelId, { body, opts })
}

export function getOnlinePanel(panelId: number) {
  return bodies.get(panelId)?.body
}

export function getOnlinePanelOptions(panelId: number): OnlinePanelOptions {
  return bodies.get(panelId)?.opts ?? {}
}
