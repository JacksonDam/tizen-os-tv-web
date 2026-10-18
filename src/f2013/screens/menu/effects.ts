import { setUiSoundLevel } from '../../tv/sound'
import { getTv, useTv } from '../../tv/store'
import { useEffect } from 'react'
import { defaultValue } from './values'

// Menu settings that act outside the Menu.

function val(id: number) {
  const s = getTv().settings[`menu.${id}`]
  return typeof s === 'number' ? s : defaultValue({ id, t: '' })
}

// Sound Feedback (System > General): CMenuSoundFeedbackSublistDataItem::t_SetData ->
// CAudioUIUtil::SetAudioVolume(Off 0 / Low 70 / Medium 85 / High 100), the UI sound renderer volume
// (PMS item 0x45f, CAudioUIUtil::GetCurrentAudioVolume). Mapped linearly to the gain (inferred).
export function applySoundFeedback() {
  setUiSoundLevel(val(0x3c2) / 100)
}

// Picture settings on the live picture: a CSS filter on the TV picture element (.f13-live), from
// Backlight, Contrast, Brightness, Colour and Tint. The panel response is not in the firmware; the
// mapping keeps the defaults neutral (inferred).
let styleEl: HTMLStyleElement | null = null
export function pictureFilter() {
  const backlight = val(0x2e)   // 0..20, default 12
  const contrast = val(0x29)    // 0..100, default 100
  const brightness = val(0x2a)  // 0..100, default 45
  const colour = val(0x2c)      // 0..100, default 50
  const tint = val(0x2d)        // 0..100 (G100..R100), default 50
  const bl = (0.4 + 0.6 * backlight / 20) / (0.4 + 0.6 * 12 / 20)
  const br = 1 + (brightness - 45) / 110
  const ct = 0.4 + 0.6 * contrast / 100
  const sat = colour / 50
  const hue = (tint - 50) * 0.6
  return `brightness(${(bl * br).toFixed(3)}) contrast(${ct.toFixed(3)}) saturate(${sat.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)`
}

export function applyPicture() {
  if (typeof document === 'undefined') return
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.dataset.owner = 'f13-menu'
    document.head.appendChild(styleEl)
  }
  const pictureOff = getTv().settings['menu.picture-off'] === 1
  styleEl.textContent = `.f13-live { filter: ${pictureFilter()}; }${pictureOff ? ' .f13-live { visibility: hidden; }' : ''}`
}

// Always-mounted overlay that re-applies the effects whenever the settings change.
export function MenuEffects() {
  const s = useTv(t => t.settings)
  useEffect(() => {
    applyPicture()
    applySoundFeedback()
  }, [s])
  return null
}
