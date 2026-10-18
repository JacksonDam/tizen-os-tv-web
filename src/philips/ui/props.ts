// The TV application's settings as japiX properties: the ids are the property fields of the firmware's
// widget records (list +8, slider +8, ...; dump in philips-fw/eu/work/nav1_leaves.txt), the values
// are the list value ids of those records. Factory values are inferred where the firmware takes them
// from the NVM defaults (marked).

export const P = {
  menuLanguage: 0x35a, country: 0x329, installMode: 0x3a9, location: 0x6a2,
  contrast: 0x714, brightness: 0x712, colour: 0x713, sharpness: 0x715, hue: 0x719,
  tint: 0x71b, dynContrast: 0x717, noise: 0x716, mpeg: 0x70d, colourEnh: 0x729, pictureFormat: 0x71e,
  activeControl: 0x71f, pixelPlus: 0x73d, hdnm: 0x73b, lightSensor: 0x73c, clearLcd: 0x738,
  volume: 0x588, balance: 0x591, headphone: 0x58d, surround: 0x58a, dual: 0x585, monoStereo: 0x586,
  avl: 0x587, bbe: 0x5a3, autoSurround: 0x577,
  subtitle: 0x797, sleeptimer: 0x6f7, onTimer: 0x6de, onTimerDay: 0x6e5,
  teletext25: 0x67c, volumeBar: 0x681, programmeTitle: 0x676, easyLink: 0x665,
  hearingImpaired: 0x59f, audioFormat: 0x5ac, standbyUpdate: 0x667, childLock: 0x5d4,
  decoderStatus: 0x35f,
} as const

// Factory values (inferred: the NVM defaults are not in the update; "Standard" smart picture values
// from philips/data/rupg/cetv.d/usersettings0.pqu, user style 3: 255;128;128;128;140 on 0..255).
export const DEFAULTS: Record<number, number> = {
  [P.menuLanguage]: 14, // English
  [P.country]: 48, // Poland, the country of the installation footage
  [P.installMode]: 1, // Antenna
  [P.location]: 35, // Home
  [P.contrast]: 100, [P.brightness]: 50, [P.colour]: 50, [P.sharpness]: 5, [P.hue]: 0,
  [P.dynContrast]: 10, [P.noise]: 4, [P.mpeg]: 96, [P.colourEnh]: 93, [P.pictureFormat]: 44,
  [P.activeControl]: 20, [P.pixelPlus]: 91, [P.hdnm]: 85, [P.lightSensor]: 80, [P.clearLcd]: 83,
  [P.volume]: 20, [P.balance]: 0, [P.headphone]: 30, [P.surround]: 23, [P.dual]: 19, [P.monoStereo]: 16,
  [P.avl]: 83, [P.bbe]: 14, [P.autoSurround]: 57,
  [P.subtitle]: 34, [P.sleeptimer]: 0, [P.onTimer]: 36, [P.onTimerDay]: 7,
  [P.teletext25]: 43, [P.volumeBar]: 12, [P.programmeTitle]: 15, [P.easyLink]: 20,
  [P.hearingImpaired]: 141, [P.audioFormat]: 168, [P.standbyUpdate]: 1, [P.childLock]: 4,
  [P.decoderStatus]: 68,
}

// Properties of features the 42PFL5603D does not have. The TV application reports them unavailable
// (juiceappreg__japiX_IsAvailable == 0) from the model's option codes, which are not in the update;
// the set follows the model's features (no Ambilight, no 100 Hz Clear LCD, no LightGuide, no PIP,
// no network: inferred from the product range).
export const ABSENT_PROPS = new Set<number>([
  0x4f3, 0x4f4, 0x4f8, 0x4f5, 0x519, 0x4fa, 0x50f, 0x4f7, // Ambilight
  P.clearLcd, // 100 Hz Clear LCD
  0x518, // LightGuide brightness
  0x56a, // PIP format
  0x32, // Internet upgrade
  P.hue, // Hue: NTSC only (the stand-in channels are PAL / DVB)
])
