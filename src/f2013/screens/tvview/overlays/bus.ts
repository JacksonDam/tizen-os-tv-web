// Requests between the TV viewer overlays and the applications (Channel List, Guide, Source...).
// The channel banner also shows by itself on every channel change (tuneSeq) made while no
// application is in the foreground, and the source banner on every source change (switchSeq).
//   'banner'      show the channel banner (CViewerChannelBoxSmart) for the current channel
//   'hideBanner'  hide it (e.g. the INFO banner replaces it)
//   'info'        show the INFO banner (CViewerInfoWndAce) for the current channel
//   'hideInfo'    hide it (e.g. a channel change replaces it with the channel banner)
export type TvEvent = 'banner' | 'hideBanner' | 'info' | 'hideInfo'
type Listener = () => void
const listeners = new Map<TvEvent, Set<Listener>>()

export function emit(ev: TvEvent) {
  listeners.get(ev)?.forEach(l => l())
}

export function on(ev: TvEvent, l: Listener) {
  let set = listeners.get(ev)
  if (!set) listeners.set(ev, (set = new Set()))
  set.add(l)
  return () => {
    set.delete(l)
  }
}

// Kept for the applications' convenience.
export function showBanner() {
  emit('banner')
}
