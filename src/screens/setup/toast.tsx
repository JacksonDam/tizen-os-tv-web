import { useEffect, useSyncExternalStore } from 'react'
import { currentToast, hideToast, subscribeToast } from './toastStore'
import './pin.css'

// Draws the settings toast (toastStore.showToast) centred on the screen.
export function ToastOverlay() {
  const t = useSyncExternalStore(subscribeToast, currentToast)
  useEffect(() => {
    if (!t) return
    const h = setTimeout(() => hideToast(t.seq), t.ms)
    return () => clearTimeout(h)
  }, [t])
  return t ? <div key={t.seq} className="pin-toast">{t.text}</div> : null
}
