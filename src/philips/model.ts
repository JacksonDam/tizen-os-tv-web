import type { MenuNode } from './menuData'

// The set this exhibit shows: the user's firmware is the 2008 North American LC08 package
// (pqda build dates 2008/01; ATSC/NTSC/QAM, English/French/Spanish), which Philips USA offers for
// the 42PFL5603D/27 (its support page shares the 42PFL3403D/27 firmware readme of 9 October 2008).
// One package serves several sets and reads the model name from the TV's EEPROM
// (a_cfg_eep_raw_read(EEP_OFFSET_MODEL_NAME)), so the menu tree carries every model's features.
export const MODEL = { name: '42PFL5603D/27', year: 2008 }

// Menu items for features the 42PFL5603D/27 does not have (a 5000-series set: no Ambilight, a 60 Hz
// panel; its leaflets list Pixel Plus 3 HD and HD Natural Motion, which stay). The firmware hides
// them through its model options (inferred: the option bits were not traced).
const ABSENT = new Set([
  10, // TV settings > Ambilight
  68, // Features > Demo > Ambilight demo
  69, // Features > Demo > 120Hz demo
])

export function forModel(node: MenuNode): MenuNode {
  if (!node.children) return node
  return { ...node, children: node.children.filter(c => !ABSENT.has(c.id)).map(forModel) }
}
