import { MAIN_MENU, type MenuItem } from './menuData'
import { patchSupport } from './menuSupport'
import { patchBroadcasting } from './menuBroadcasting'

// The All Settings tree for this mocked TV: the generated data plus the rows that depend on the
// mocked hardware (tuner, inputs) and the web rebuild hooks.
export const MENU: MenuItem[] = patchBroadcasting(patchSupport(MAIN_MENU))
