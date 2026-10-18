import { useSyncExternalStore } from 'react'
import { STUB_APPS, STUB_GAMES, type StubApp, type StubGame } from '../../../../../shared/fictional'
import { getSetting, setSetting, useSetting } from '../../../../tv/store'

// What the TV's servers would have sent for the Apps and Games panels, and what the user has
// installed. The apps and games are the museum's fictional catalogue (src/shared/fictional.ts);
// installed state lives in the TV store's settings (so factory reset and Reset Smart Hub clear it):
//   hubapps.installed  JSON array of app ids, in My Apps order (the order they were downloaded)
//   hubapps.locked     JSON array of locked app ids (More Apps > Options > Lock/Unlock)
//   hubapps.games      JSON array of installed game ids
// Downloads are simulated in memory (they are lost with a page reload, as an unfinished download is
// with a power cut).

// "Samsung Apps", the store: a downloaded widget, not part of the firmware, so the museum cannot run it
// (see AppRunner). Its name is the firmware's own (g_HomePanelWStringEng 27, g_NOAWStringEng 9).
export const SAMSUNG_APPS = 'samsung-apps'

export type HubApp = StubApp | {
  id: typeof SAMSUNG_APPS; name: string; category: 'Information'; publisher: string; description: string
  sizeMB: number; rating: number; preinstalled: true
}

const STORE: HubApp = {
  id: SAMSUNG_APPS, name: 'Samsung Apps', category: 'Information', publisher: 'Samsung',
  description: '', sizeMB: 0, rating: 0, preinstalled: true,
}

export const ALL_APPS: HubApp[] = [...STUB_APPS, STORE]

export function appById(id: string): HubApp | undefined {
  return ALL_APPS.find(a => a.id === id)
}
export function gameById(id: string): StubGame | undefined {
  return STUB_GAMES.find(g => g.id === id)
}

// The server's Recommended row for the Apps panel (8 single cells, GBHOME_APPS_MAIN_GRID_LAYOUT_DATA_NUM
// 9 minus the promotion) and the promotion (PIA) item in the merged right-hand cell. Fictional.
export const RECOMMENDED: string[] = [
  'vista-sport', 'northstar-on-demand', 'aurora-play', 'cinema-vault', 'retro-tunes', 'globe-explorer',
  'clip-share', SAMSUNG_APPS,
]
export const PROMOTED = 'story-hour'

const DEFAULT_INSTALLED = STUB_APPS.filter(a => a.preinstalled).map(a => a.id)

function parse(v: string | number, fallback: string[]): string[] {
  if (typeof v !== 'string' || !v) return fallback
  try {
    const a = JSON.parse(v)
    return Array.isArray(a) ? a.filter(x => typeof x === 'string') : fallback
  } catch {
    return fallback
  }
}

const KEY_INSTALLED = 'hubapps.installed'
const KEY_LOCKED = 'hubapps.locked'
const KEY_GAMES = 'hubapps.games'

export function getInstalled(): string[] {
  return parse(getSetting<string>(KEY_INSTALLED, ''), DEFAULT_INSTALLED)
}
export function useInstalled(): string[] {
  const raw = useSetting<string>(KEY_INSTALLED, '')
  return parse(raw, DEFAULT_INSTALLED)
}
export function setInstalled(ids: string[]) {
  setSetting(KEY_INSTALLED, JSON.stringify(ids))
}
export function isInstalled(id: string) {
  return id === SAMSUNG_APPS || getInstalled().includes(id)
}

export function useLocked(): string[] {
  return parse(useSetting<string>(KEY_LOCKED, ''), [])
}
export function getLocked(): string[] {
  return parse(getSetting<string>(KEY_LOCKED, ''), [])
}
export function setLocked(ids: string[]) {
  setSetting(KEY_LOCKED, JSON.stringify(ids))
}

export function useInstalledGames(): string[] {
  return parse(useSetting<string>(KEY_GAMES, ''), [])
}
export function getInstalledGames(): string[] {
  return parse(getSetting<string>(KEY_GAMES, ''), [])
}
export function setInstalledGames(ids: string[]) {
  setSetting(KEY_GAMES, JSON.stringify(ids))
}

// ---- simulated downloads ----
// One entry per item being downloaded: progress 0..100 while downloading, then 'installing' for a
// moment before it is added to the installed list. The durations are not the firmware's (they depend
// on the network): (inferred) 1 s plus 60 ms per MB, in 5 % steps.

export type Download = { kind: 'app' | 'game'; progress: number; phase: 'downloading' | 'installing' }
let downloads = new Map<string, Download>()
const subs = new Set<() => void>()
function emit() {
  downloads = new Map(downloads)
  subs.forEach(f => f())
}

export function useDownloads(): Map<string, Download> {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => downloads,
  )
}
export function getDownload(id: string) {
  return downloads.get(id)
}

export function startDownload(id: string, kind: 'app' | 'game') {
  if (downloads.has(id)) return
  const size = kind === 'app' ? appById(id)?.sizeMB ?? 10 : gameById(id)?.sizeMB ?? 10
  const total = 1000 + size * 60
  const step = total / 20
  downloads.set(id, { kind, progress: 0, phase: 'downloading' })
  emit()
  const tick = () => {
    const d = downloads.get(id)
    if (!d) return
    if (d.phase === 'downloading' && d.progress < 100) {
      downloads.set(id, { ...d, progress: Math.min(100, d.progress + 5) })
      emit()
      setTimeout(tick, step)
      return
    }
    if (d.phase === 'downloading') {
      downloads.set(id, { ...d, phase: 'installing' })
      emit()
      setTimeout(tick, 1200)
      return
    }
    downloads.delete(id)
    if (kind === 'app') {
      const list = getInstalled()
      if (!list.includes(id)) setInstalled([...list, id])
    } else {
      const list = getInstalledGames()
      if (!list.includes(id)) setInstalledGames([...list, id])
    }
    emit()
  }
  setTimeout(tick, step)
}
