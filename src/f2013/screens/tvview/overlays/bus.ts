// Requests to the TV viewer overlays from the applications (Channel List, Guide, Source...).
// The banner overlay also shows by itself on every channel change (tuneSeq) and source change
// (switchSeq) made while no application is in the foreground.
type BannerMode = 'channel' | 'info'
type Listener = (mode: BannerMode) => void
const listeners = new Set<Listener>()

export function showBanner(mode: BannerMode = 'channel') {
  listeners.forEach(l => l(mode))
}

export function onShowBanner(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
