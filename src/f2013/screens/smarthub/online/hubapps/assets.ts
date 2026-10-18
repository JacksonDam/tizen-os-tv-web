import { F13 } from '../../../../assets'

// Firmware images used by the online Apps, Games and Social panels, copied unchanged from
// /mtd_rocommon/Images into public/f13/hubapps/<firmware path> (they are PNGs with alpha already).
export const HUB = `${F13}/hubapps`

export function fw(path: string) {
  return `${HUB}/${path}`
}

// Fonts (CHomeWindowManager::GetFont = font 0 = shadow_eu.ttf, Samsung SVD Medium; GetLightFont =
// SVD Light).
export const MEDIUM = 500
export const LIGHT = 300
