import { useSyncExternalStore } from 'react'

// Requests from the panel and its sub menu (which has the keys while its item runs): the Social Settings
// window or the Video Call message. Both are separate windows over the whole Smart Hub (the settings are
// their own application, 200), so they are drawn by an overlay above it (SocialPopups), with the launch
// motion of whoever asked.
type Kind = 'settings' | 'videocall'
type Request = { kind: Kind; launch?: (run: () => void) => void } | null
let request: Request = null
const subs = new Set<() => void>()
export function requestSocial(kind: Kind | null, launch?: (run: () => void) => void) {
  request = kind ? { kind, launch } : null
  subs.forEach(f => f())
}
export function useSocialRequest() {
  return useSyncExternalStore(f => {
    subs.add(f)
    return () => subs.delete(f)
  }, () => request)
}
export function getSocialRequest() {
  return request
}
