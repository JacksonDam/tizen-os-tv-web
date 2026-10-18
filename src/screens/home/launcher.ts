import { useSyncExternalStore } from 'react'
import { STUB_APPS, type StubApp } from '../../shared/fictional'
import { useTv, type SourceId } from '../../tv/store'

// The home's app launcher row (d/launcher.layer) once the Smart Hub terms are agreed.
//
// Where the firmware gets the list (CompHome MediaLauncherManager.LoadSmartHub, run when the terms are
// agreed): the "Make Your Smart Hub" result the server leaves in firstscreen_data/FromSmarthubToFS.txt
// (each entry an appId with its focused/normal icons; SAMSUNG_SERVICE1 apps first), with the TV's own
// sources put in front by LauncherAddToHomeHandler.MakeAddToHomeList: Samsung TV Plus when it has
// virtual channels, then Live TV (s/livetv@RF) when the tuner has channels, then live-TV cable boxes on
// HDMI (s/livetv@<source>).
//
// Nothing else is preinstalled in this firmware: /usr/apps/.preload-* and /opt/share/webappservice/
// preinstall are empty, and the only web app packages (WykOS4t4F0 cmsWebApp, ZODRT12q2l
// WebAccountExtension) are hidden system apps. So the firmware's own items are Live TV (IconTitleLauncher,
// i_icon_device_m_tv on CC_Home_Device, ResourceLiveTV.SetLauncherIconNormal) and the set-top box on
// HDMI 2 (i_icon_device_m_cablebox); the server's list is stubbed with the catalogue's preinstalled apps.
// Samsung TV Plus is left out: its channels and player come from the server (tvs-tvplus), so the mocked
// TV reports no virtual services and the firmware adds no TV Plus tile.

export type LauncherItem =
  | { id: string; kind: 'livetv'; title: string }
  | { id: string; kind: 'source'; title: string; source: SourceId }
  | { id: string; kind: 'webapp'; title: string; app: StubApp }

const LIVE_TV: LauncherItem = { id: 's/livetv@RF', kind: 'livetv', title: 'Live TV' }   // TV_SID_EDEN_LIVE_TV
const STB: LauncherItem = { id: 's/livetv@HDMI2', kind: 'source', title: 'Set-top Box', source: 'HDMI2' }
const APPS: LauncherItem[] = STUB_APPS.filter(a => a.preinstalled).map(app => ({
  id: `d/webapp@${app.id}`, kind: 'webapp' as const, title: app.name, app,
}))

export function launcherItem(id: string): LauncherItem | undefined {
  if (id === LIVE_TV.id) return LIVE_TV
  if (id === STB.id) return STB
  const app = STUB_APPS.find(a => `d/webapp@${a.id}` === id)
  return app ? { id, kind: 'webapp', title: app.name, app } : undefined
}

// The order the TV builds after the terms are agreed (front sources, then the server's apps).
function defaultOrder(): string[] {
  return [LIVE_TV.id, STB.id, ...APPS.map(a => a.id)]
}

// The user's changes (Edit: move and remove) are kept; Reset Smart Hub and withdrawing the terms reset
// the list (AppListManagerST.OnDisclaimerChanged -> LauncherReset).
const KEY = 'tizen-os-tv-web.launcher'

function load(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch {
    /* default */
  }
  return null
}

let order: string[] | null = load()
let snapshot = order ?? defaultOrder()
const subs = new Set<() => void>()

function save(next: string[] | null) {
  order = next
  snapshot = order ?? defaultOrder()
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  subs.forEach(f => f())
}

export function resetLauncher() {
  save(null)
}

export function removeLauncherItem(id: string) {
  save(snapshot.filter(x => x !== id))
}

// Move mode's result: the visible tiles in their new order (hidden ones, e.g. Live TV without channels,
// keep their place at the end).
export function setLauncherOrder(visible: string[]) {
  save([...visible, ...snapshot.filter(x => !visible.includes(x))])
}

function useOrder() {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => snapshot,
  )
}

// The visible launcher: Live TV only while the tuner has channels (LauncherAddToHomeHandler
// .OnServiceListChanged adds and removes s/livetv@RF with the channel count).
export function useLauncher(): LauncherItem[] {
  const ids = useOrder()
  const channels = useTv(s => s.channels.length)
  return ids
    .map(launcherItem)
    .filter((x): x is LauncherItem => !!x && (x.kind !== 'livetv' || channels > 0))
}
