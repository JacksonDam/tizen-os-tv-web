import type { ComponentType } from 'react'

// Online panel bodies. When the TV is online with the Smart Hub terms agreed (useSmartHubOnline in
// src/f2013/tv/online.ts) the carousel (Hub.tsx) draws each panel's frame and, inside it, the body a
// panel module registered here for that panel id (SOCIAL, ONTV, MOVIES, APPS, GAMES, MULTIMEDIA... from
// ./data). Without a registration the carousel falls back to the default "Set Up Smart Hub" page.

export type OnlinePanelProps = {
  // The panel is the centred one and owns the keys (the top menu or a move animation does not).
  active: boolean
  // Size of the panel body in stage px (the carousel positions it).
  width: number
  height: number
  // Call when Up is pressed on the body's top row: focus goes to the top menu.
  exitUp: () => void
}

const bodies = new Map<number, ComponentType<OnlinePanelProps>>()

export function registerOnlinePanel(panelId: number, body: ComponentType<OnlinePanelProps>) {
  bodies.set(panelId, body)
}

export function getOnlinePanel(panelId: number) {
  return bodies.get(panelId)
}
