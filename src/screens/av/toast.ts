// The settings toast (P_PopupToast_03) shown by PanelToast: text and the width of the panel it sits on.

let toast: { text: string; width: number; seq: number } | null = null
const subs = new Set<() => void>()

export function showPanelToast(text: string, panelWidth = 520) {
  toast = { text, width: panelWidth, seq: (toast?.seq ?? 0) + 1 }
  subs.forEach(f => f())
}
export function hideToast() {
  toast = null
  subs.forEach(f => f())
}
export const getToast = () => toast
export function subscribeToast(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
