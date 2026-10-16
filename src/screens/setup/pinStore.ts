import { getSetting, setSetting } from '../../tv/store'

// The TV's system PIN (vconf db/menu/system/change_pin, ChangePinPopup.cs:345), stored as the All
// Settings value of the Change PIN row. 4 digits, factory default 0000.
//
// Wrong entries are counted per PIN type (PinDataManager): after MAX_INVALID_COUNT = 10 wrong PINs the
// PIN line locks for REMAINED_TIME_GAP x (count - 10) s, at most MAX_REMAINED_TIME = 3600 s
// (FLUX Constant.cs:317-321, PinDataManager.cs:207). Kept in memory, like the TV (inferred).

export const PIN_SETTING = 'change-pin'
export const DEFAULT_PIN = '0000'
const MAX_INVALID_COUNT = 10
const REMAINED_TIME_GAP = 30
const MAX_REMAINED_TIME = 3600

export function getPin(): string {
  return String(getSetting(PIN_SETTING, DEFAULT_PIN))
}
export function setPin(pin: string) {
  setSetting(PIN_SETTING, pin)
}

let invalidCount = 0
let lockStart = 0

// Records one check; returns the new state.
export function checkPin(pin: string): boolean {
  const ok = pin === getPin()
  if (ok) invalidCount = 0
  else {
    invalidCount++
    if (invalidCount > MAX_INVALID_COUNT) lockStart = Date.now()
  }
  return ok
}

export function pinInvalidCount() {
  return invalidCount
}

// Seconds left while locked, 0 when entry is allowed.
export function pinLockRemaining(): number {
  if (invalidCount <= MAX_INVALID_COUNT || !lockStart) return 0
  const total = Math.min(REMAINED_TIME_GAP * (invalidCount - MAX_INVALID_COUNT), MAX_REMAINED_TIME)
  return Math.max(0, Math.ceil(total - (Date.now() - lockStart) / 1000))
}

export function resetPinState() {
  invalidCount = 0
  lockStart = 0
}
