// Settings toasts that outlive the popup that raised them (PopupGUIUtil.GetMenuCommonToastPopupAttributes:
// P_PopupToast_03, auto-hide). The change-PIN and reset-complete toasts; ToastOverlay draws them.

export type Toast = { text: string; seq: number; ms: number }
let toast: Toast | null = null
let seq = 0
const subs = new Set<() => void>()

export function showToast(text: string, ms = 3000) {
  toast = { text, seq: ++seq, ms }
  subs.forEach(f => f())
}

export function hideToast(s: number) {
  if (toast?.seq !== s) return
  toast = null
  subs.forEach(f => f())
}

export function subscribeToast(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

export function currentToast() {
  return toast
}
