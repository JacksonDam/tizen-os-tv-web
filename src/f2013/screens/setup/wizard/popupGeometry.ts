// CPopUpWidget geometry (AppMWOSDInfo POPUPWIDGET_*, x1.5), shared by the popup and its owners.
const POPUP_H = [128, 162, 210, 258, 306, 354, 402]
export const POPUP_W = 325 * 1.5
export const POPUP_ITEM_H = 48 * 1.5
export const POPUP_MARGIN = 22 * 1.5
export const POPUP_INSET = 21 * 0.75 // half the 21 px shadow, x1.5
export const VISIBLE = 7

export function popupHeight(n: number) {
  return POPUP_H[Math.min(n, VISIBLE) - 1] * 1.5
}

