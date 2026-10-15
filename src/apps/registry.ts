import type { ComponentType } from 'react'

// Full-screen apps the TV launches (Device Care, Software Update, channel scan, channel list...).
// Each app takes the keys while it is running and calls onExit when it closes.
export type AppProps = {
  args?: Record<string, string>
  onExit: (then?: 'live' | 'hub' | 'settings') => void   // what to show after the app closes (default live TV)
  launch: (app: string, args?: Record<string, string>) => void  // start another app instead
}

export const APPS: Record<string, ComponentType<AppProps>> = {}

export function registerApp(id: string, app: ComponentType<AppProps>) {
  APPS[id] = app
}
