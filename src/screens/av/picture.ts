import { getTv, setTv, type TvState } from '../../tv/store'

// The picture engine (avoc) for the stand-in video. The TV keeps the Expert Settings per picture mode;
// the values themselves live in the panel's picture tables, which are not in the firmware update, so the
// per-mode defaults below are Samsung's published defaults for 2024-25 sets (inferred). Setting ids are
// the All Settings item ids (spec/settings.md 2.5, menu-tv.json), shared with Quick Settings.

export const PICTURE_MODES = { dynamic: 65536, standard: 65537, movie: 65538, filmmaker: 655360 } as const

// Expert Settings rows stored per picture mode.
export const PER_MODE_KEYS = [
  'brightness', 'contrast', 'sharpness', 'color', 'tint', 'dynamic-contrast', 'shadow-detail1', 'gamma',
  'color-booster', 'color-tone', 'r-gain', 'g-gain', 'b-gain', 'r-offset', 'g-offset', 'b-offset',
] as const
type PerModeKey = (typeof PER_MODE_KEYS)[number]
type ModeValues = Record<PerModeKey, number>

const BASE: ModeValues = {
  brightness: 25, contrast: 45, sharpness: 10, color: 25, tint: 15, 'dynamic-contrast': 0, 'shadow-detail1': 0,
  gamma: 0, 'color-booster': 0, 'color-tone': 1, 'r-gain': 0, 'g-gain': 0, 'b-gain': 0, 'r-offset': 0,
  'g-offset': 0, 'b-offset': 0,
}

// (inferred) Dynamic: full backlight, cool tone, Contrast Enhancer High; Movie and FILMMAKER MODE: no
// sharpening, Warm2 (D65), enhancers off.
export const MODE_DEFAULTS: Record<number, ModeValues> = {
  [PICTURE_MODES.dynamic]: { ...BASE, brightness: 50, contrast: 50, color: 30, 'dynamic-contrast': 2, 'color-tone': 0, 'color-booster': 1 },
  [PICTURE_MODES.standard]: { ...BASE },
  [PICTURE_MODES.movie]: { ...BASE, brightness: 20, sharpness: 0, 'color-tone': 3 },
  [PICTURE_MODES.filmmaker]: { ...BASE, brightness: 20, sharpness: 0, 'color-tone': 3 },
}

// Picture Size Settings and Zoom and Position (not per mode).
export const SIZE_DEFAULTS = {
  'picturesize-mode': 0,       // 0 16:9 Standard, 1 Custom, 2 4:3
  'picturesize-screenfit': 0,  // Fit to Screen: 0 Off, 1 On, 2 Auto
  'av.zoom-h': 100, 'av.zoom-v': 100, 'av.pos-x': 0, 'av.pos-y': 0,
} as const

const num = (s: TvState, k: string, d: number) => {
  const v = s.settings[k]
  return v === undefined ? d : Number(v)
}

export function pictureMode(s: TvState = getTv()) {
  return num(s, 'picturemode', PICTURE_MODES.standard)
}

// Value of an Expert Settings row in the current mode (the store holds the current mode's values).
export function pictureValue(s: TvState, key: PerModeKey) {
  return num(s, key, MODE_DEFAULTS[pictureMode(s)]?.[key] ?? BASE[key])
}

// ---- picture mode switch: save the old mode's Expert Settings, load the new mode's ----

const MODES_KEY = 'tizen-os-tv-web.av.picture-modes'
type Saved = Record<string, Partial<ModeValues>>
function loadSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(MODES_KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}
function save(s: Saved) {
  try {
    localStorage.setItem(MODES_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

export function onPictureModeChanged(from: number, to: number) {
  const s = getTv()
  const saved = loadSaved()
  const old: Partial<ModeValues> = {}
  for (const k of PER_MODE_KEYS) if (s.settings[k] !== undefined) old[k] = Number(s.settings[k])
  saved[from] = old
  save(saved)
  const next = { ...(MODE_DEFAULTS[to] ?? BASE), ...(saved[to] ?? {}) }
  setTv(st => ({ settings: { ...st.settings, ...next } }))
}

// Reset Picture (picture-dataprovider menu/picture/reset): the current mode's Expert Settings and the
// picture size back to the defaults; the mode itself stays.
export function resetPicture() {
  const mode = pictureMode()
  const saved = loadSaved()
  delete saved[mode]
  save(saved)
  setTv(st => ({ settings: { ...st.settings, ...MODE_DEFAULTS[mode], ...SIZE_DEFAULTS } }))
}

// ---- what the picture engine applies to the video ----

export type PictureParams = {
  filter: string        // CSS filter for the video plane
  matrix: string | null // feColorMatrix values (Color Tone and White Balance), null = identity
  gamma: number         // feComponentTransfer exponent (Gamma), 1 = identity
  shadow: number        // Shadow Detail lift of the low end (-5..5)
  sharpen: number       // -1..1 (Sharpness around its neutral 10)
}

// Color Tone R/G/B gains (inferred): Cool 9300 K, Standard, Warm1 6500 K, Warm2 5500 K.
const TONE: Record<number, [number, number, number]> = {
  0: [0.94, 0.98, 1.06],
  1: [1, 1, 1],
  2: [1.03, 1, 0.93],
  3: [1.06, 1, 0.86],
}

export function pictureParams(s: TvState): PictureParams {
  const v = (k: PerModeKey) => pictureValue(s, k)
  const energy = num(s, 'energy-saving-solution', 0) ? 0.85 : 1 // dims the backlight (inferred)
  // Brightness (backlight 0..50): 0.4 at 0, 1 at the Standard 25, 1.3 at 50 (inferred)
  const b = v('brightness')
  const backlight = (b <= 25 ? 0.4 + (0.6 * b) / 25 : 1 + (0.3 * (b - 25)) / 25) * energy
  const enhancer = [1, 1.04, 1.08][v('dynamic-contrast')] ?? 1
  const contrast = (0.3 + (0.7 * v('contrast')) / 45) * enhancer
  const booster = [1, 1.08, 1.16][v('color-booster')] ?? 1
  const saturate = (v('color') / 25) * booster
  const hue = (15 - v('tint')) * 1.5 // G <-> R
  const filter = [
    `brightness(${backlight.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    hue ? `hue-rotate(${hue}deg)` : '',
  ].filter(Boolean).join(' ')

  const [tr, tg, tb] = TONE[v('color-tone')] ?? TONE[1]
  const gain = (k: PerModeKey) => 1 + v(k) / 200
  const off = (k: PerModeKey) => v(k) / 400
  const r = tr * gain('r-gain'), g = tg * gain('g-gain'), bl = tb * gain('b-gain')
  const or = off('r-offset'), og = off('g-offset'), ob = off('b-offset')
  const identity = r === 1 && g === 1 && bl === 1 && !or && !og && !ob
  const matrix = identity
    ? null
    : `${r.toFixed(4)} 0 0 0 ${or.toFixed(4)} 0 ${g.toFixed(4)} 0 0 ${og.toFixed(4)} 0 0 ${bl.toFixed(4)} 0 ${ob.toFixed(4)} 0 0 0 1 0`
  return {
    filter,
    matrix,
    gamma: 1 - v('gamma') * 0.07,
    shadow: v('shadow-detail1'),
    sharpen: (v('sharpness') - 10) / 10,
  }
}

// Picture Size: the video plane's transform (Fit to Screen Off overscans by 3 %, inferred).
export function pictureTransform(s: TvState): string {
  const mode = num(s, 'picturesize-mode', 0)
  const fit = num(s, 'picturesize-screenfit', 0)
  const over = fit === 0 ? 1.03 : 1
  if (mode === 2) return `scale(${(0.75 * over).toFixed(4)}, ${over})` // 4:3 window, pillarboxed
  if (mode === 1) {
    const zh = num(s, 'av.zoom-h', 100) / 100
    const zv = num(s, 'av.zoom-v', 100) / 100
    const x = num(s, 'av.pos-x', 0)
    const y = num(s, 'av.pos-y', 0)
    return `translate(${(x * 19.2).toFixed(1)}px, ${(y * 10.8).toFixed(1)}px) scale(${(zh * over).toFixed(4)}, ${(zv * over).toFixed(4)})`
  }
  return over === 1 ? 'none' : `scale(${over})`
}
