import { getSetting, setSetting } from '../../tv/store'
import type { MenuItem } from './types'

// Menu item values live in the TV store under `menu.<item id>` (the firmware keeps them in PMS / the
// TV middleware). Defaults: values visible on the UK set in EhQ9pDtWV4M 3:06 where shown, otherwise
// (inferred) the first sublist entry or the range middle; see spec/menu.md.
const DEFAULTS: Record<number, number> = {
  0x16: 1,      // Picture Mode: Standard (footage)
  0x24: 0,      // Samsung MagicAngle: Off (footage)
  0x28: 1,      // MagicAngle Mode
  0x2e: 12,     // Backlight 12 (footage)
  0x29: 100,    // Contrast 100 (footage)
  0x2a: 45,     // Brightness 45 (footage)
  0x2b: 50,     // Sharpness 50 (footage)
  0x2c: 50,     // Colour 50 (footage)
  0x2d: 50,     // Tint (G/R) G50/R50
  0xa4: 0,      // Picture Size 16:9 (inferred)
  0xed: 0,      // 4:3 Screen Size 16:9
  0x52: 2,      // Dynamic Contrast Medium (inferred)
  0x91: 0, 0x5a: 0,
  0x77: 25, 0x78: 25, 0x79: 25, 0x7a: 25, 0x7b: 25, 0x7c: 25,   // White Balance centre of 0..50
  0x70: 50, 0x71: 50, 0x72: 50,
  0x12e: 1,     // Motion Lighting On (inferred)
  0x2f: 2,      // Colour Tone Standard (inferred)
  0xb7: 4,      // Digital Clean View Auto (inferred)
  0xc2: 4,      // MPEG Noise Filter Auto (inferred)
  0xdc: 2,      // Motion Plus Standard (inferred)
  0xe3: 10, 0xe4: 10,
  0xd5: 1,      // Smart LED Standard (inferred)
  0x101: 5,     // 3D Depth
  0x17b: 0,     // Speaker Select: TV Speaker
  0x182: 0, 0x183: 0,
  0x19b: 50,
  0x3c2: 85,    // Sound Feedback Medium (inferred)
  0x3be: 1,     // Menu Transparency Medium (CAppUtil::GetOSDTransparency PMS fallback 1)
  0x47: 1,      // No Signal Power Off 15 min (inferred)
  0x7d7: 1,     // Auto Power Off On (inferred, EU)
  0x4a8: 1,     // Boot Logo On (inferred)
  0x328: 1,     // Clock Mode Auto
  0x4d4: 1,     // Digital Text Enable
  0x215: 1,     // Standby Auto Tuning Off
  0x23d: 1,     // Guide Type Samsung
  0x80: 1, 0x81: 1,   // Anynet+ On, Auto Turn Off Yes
  0xc1d: 1,     // Auto update On (inferred)
  [(0x7035 << 8) | 1]: 1, [(0x7035 << 8) | 2]: 1, 0x1770: 1, 0x1772: 1, 0x189c: 1,
  0x521: 0x656e67, // Primary Subtitle: English (inferred UK default; data = ISO 639-2 code)
  0x54a: 0x656e67, // Secondary Subtitle: English (inferred)
  0x57a: 0x656e67, // Primary Audio: English (inferred)
  0x5a8: 0x656e67, // Secondary Audio: English (inferred)
  0x51: 0,         // Device Name: [TV] Samsung (inferred: the first name of the list)
}

export function defaultValue(it: MenuItem): number {
  if (it.id in DEFAULTS) return DEFAULTS[it.id]
  if (it.v) return Math.round((it.v[0] + it.v[1]) / 2)
  if (it.o && it.o.length) return it.o[0][0]
  return 0
}

// Container items that show their sublist child's value
const ALIAS: Record<number, number> = { 0x23: 0x24, 0xdb: 0xdc, 0x519: 0x51a, 0x42: 0x43, 0x64: 0x65, 0x197: 0x198, 0x297: 0x298 }

// Items whose value is another module's text setting (Plug & Play keys): Country, Menu Language
export const TEXT_KEYS: Record<number, [string, string]> = { 0x1dd: ['country', 'United Kingdom'], 0x3b4: ['menuLanguage', 'English'] }

export function getValue(it: MenuItem): number {
  const tk = TEXT_KEYS[it.id]
  if (tk) {
    const v = getSetting<string>(tk[0], tk[1])
    return it.o?.find(o => o[1] === v)?.[0] ?? 0
  }
  if (ALIAS[it.id]) return getSetting<number>(`menu.${ALIAS[it.id]}`, DEFAULTS[ALIAS[it.id]] ?? defaultValue(it))
  return getSetting<number>(`menu.${it.id}`, defaultValue(it))
}

// Settings other modules read under their own keys (Tools, boot, setup)
const MIRROR: Record<number, (it: MenuItem, v: number) => [string, string | number]> = {
  0x16: (it, v) => ['picture.mode', optionText(it, v)],
  0xa4: (it, v) => ['picture.size', optionText(it, v)],
  0x363: (it, v) => ['system.sleepTimer', optionText(it, v)],
  0x4a8: (_it, v) => ['bootLogo', v ? 1 : 0],
}

export function setValue(it: MenuItem, v: number) {
  const tk = TEXT_KEYS[it.id]
  if (tk) {
    setSetting(tk[0], optionText(it, v))
    return
  }
  setSetting(`menu.${it.id}`, v)
  const m = MIRROR[it.id]
  if (m) {
    const [k, mv] = m(it, v)
    setSetting(k, mv)
  }
}

export function optionText(it: MenuItem, v = getValue(it)): string {
  return it.o?.find(o => o[0] === v)?.[1] ?? ''
}
