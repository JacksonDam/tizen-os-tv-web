import { useSyncExternalStore } from 'react'
import { TV } from '../../assets'
import { Lottie } from '../../components/Lottie'
import { shell } from '../../tv/shell'
import type { StubApp } from '../../shared/fictional'

// Launching an app from the home. The tile's OnSelected asks the app framework to launch it, and
// NListBaseLayerView.ItemClick sends ViewEvent.ShowLoading with the tile's select_loading_time
// (WebAppElement: 20 s), so csfs shows OnSelectLoadingView over everything: CC_Dim50 (eden.loading_bg_dim_
// support is true on this firmware) and the large FLUX Loading (C_Loading_01, i_img_loading.json, 13 u)
// in the centre, keys blocked but Home; it goes when the app's window comes up (opacity -> 0 in 100 ms).
// The third-party apps are not in the firmware, so after the launch time (mock) the app's placeholder
// opens (screens/home/StubAppScreen.tsx).

const LAUNCH_MS = 1500 // (inferred) time until the app's first frame

let launching: StubApp | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

export function launchApp(app: StubApp) {
  clearTimeout(timer)
  launching = app
  emit()
  timer = setTimeout(() => {
    launching = null
    emit()
    shell.launch('webapp', { app: app.id })
  }, LAUNCH_MS)
}

export function cancelLaunch() {
  clearTimeout(timer)
  launching = null
  emit()
}

export function useLaunching(): boolean {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => launching !== null,
  )
}

export function LaunchLoading() {
  return (
    <div className="launch-loading">
      <Lottie className="launch-loading__icon" src={`${TV}/flux/i_img_loading.json`} playing loop />
    </div>
  )
}
