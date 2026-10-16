import type { TvState } from '../../../tv/store'
import { getSetting, SOURCES } from '../../../tv/store'
import type { ShellView } from '../../../tv/shell'

// Virtual remote (org.tizen.VirtualRemoteControlNUIGadget, hosted by org.tizen.function-osd) in its Bar
// layout (AppStateManager.SetCurrentPadsKind(PadsKind.Bar)). Which buttons the number and option pads
// carry depends on what is on screen (spec3/extras.md 1.2): the gadget's ReceivedAppControlParser
// .ParseBySource -> LayoutManager / LayoutTVStatusManager -> NumericModelFactory.CreateBarNumModel and
// BarOptionLayoutInfo.CreateBarLayoutInfo. This TV: DVB (EU), teletext supported, no PVR, no secure input
// (featureconf product.ttx_support = true, pvr.pvr_support = false in the EU retail column).

export type NumItem =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'ttx' | 'dash' | 'delete' | 'left' | 'right'
export type OptItem = 'schedule' | 'info' | 'stop'

export type PadLayout = {
  source: 'rf' | 'cec' | 'etc'          // SourceKind the gadget resolved (RF = tuner, HDMI_CEC, ETC)
  numeric: NumItem[][]                   // groups
  option: OptItem[][]
  optionFocus: OptItem                   // OptionModel.DefaultFocusedItem
}

const DIGITS: NumItem[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

// NumericModelFactory.CreateBarNumModel
const NUMPAD_TTX_SUPPORT: NumItem[][] = [['ttx'], DIGITS, ['delete']]      // tv-viewer, teletext supported
const NUMPAD_LIVE: NumItem[][] = [[...DIGITS, 'dash'], ['delete']]          // channel list on screen
const NUMPAD_EXT: NumItem[][] = [[...DIGITS, 'dash'], ['delete', 'left', 'right']] // MBR / HDMI-CEC
const NUMPAD_DEFAULT_EU: NumItem[][] = [['ttx'], DIGITS]                     // other sources (DVB)

// BarOptionLayoutInfo.CreateBarLayoutInfo
const TV_NO_PVR_WATCHING_EU: OptItem[][] = [['schedule', 'info']]
const HDMI_CEC_EU: OptItem[][] = [['info', 'stop']]
const OPT_DEFAULT_EU: OptItem[][] = [['info']]

export function padLayout(view: ShellView, tv: TvState): PadLayout {
  if (tv.source === 'TV') {
    // SourceKind.RF: NumPad_LIVE while the channel list is the partial-screen app, else NumPad_TTXSupport
    return {
      source: 'rf',
      numeric: view.app === 'channel-list' ? NUMPAD_LIVE : NUMPAD_TTX_SUPPORT,
      option: TV_NO_PVR_WATCHING_EU,
      optionFocus: 'info',
    }
  }
  // HDMI that is not in PC mode: the CEC device is the active source when Anynet+ is on and the device
  // announced itself (the inputs' names come from CEC in this mock).
  const device = SOURCES.find(s => s.id === tv.source)?.device
  if (Number(getSetting('hdmicec', 1)) === 1 && device) {
    return { source: 'cec', numeric: NUMPAD_EXT, option: HDMI_CEC_EU, optionFocus: 'stop' }
  }
  return { source: 'etc', numeric: NUMPAD_DEFAULT_EU, option: OPT_DEFAULT_EU, optionFocus: 'info' }
}

// Item art (res/allowed/CONTROL_UI/images, copied to public/tv/virtual-remote).
export const NUM_ICON: Record<NumItem, string> = {
  '0': 'control_icon_0.svg', '1': 'control_icon_1.svg', '2': 'control_icon_2.svg', '3': 'control_icon_3.svg',
  '4': 'control_icon_4.svg', '5': 'control_icon_5.svg', '6': 'control_icon_6.svg', '7': 'control_icon_7.svg',
  '8': 'control_icon_8.svg', '9': 'control_icon_9.svg',
  ttx: 'control_icon_ttxmix.svg', dash: 'control_icon_dash.svg', delete: 'control_icon_delete.svg',
  left: 'control_icon_left.svg', right: 'control_icon_right.svg',
}
export const OPT_ICON: Record<OptItem, string> = {
  schedule: 'control_icon_schedulemanager.svg',
  info: 'control_icon_info.svg',
  stop: 'control_icon_stop.svg',
}
// Tooltip labels (TTsString.GetOptionButtonItemText; en-US VirtualRemoteControl.TextResources)
export const OPT_LABEL: Record<OptItem, string> = {
  schedule: 'Schedule Manager',
  info: 'Info',
  stop: 'Stop',
}

// Defined.cs (FLUX units, 1 u = 8 px)
export const U = 8
export const NUM_BUTTON = 6 * U        // NumButtonSize
export const OPT_BUTTON = 6 * U        // OptButtonSize
export const NUM_ITEM_GAP = 1 * U      // BarNumItemGap
export const NUM_GROUP_GAP = 3 * U     // BarNumGroupGap
export const OPT_ITEM_GAP = 2 * U      // BarOptItemGap
export const OPT_GROUP_GAP = 5 * U     // BarOptGroupGap
export const LIST_PADDING = 3 * U      // BarListPadding
export const QUE_SIZE = 7 * U          // BarQueSize

// BarNumericNListBridge / BarOptionNListBridge.UpdateNListSize
export function listWidth(groups: unknown[][], item: number, itemGap: number, groupGap: number) {
  const n = groups.reduce((a, g) => a + g.length, 0)
  return groupGap * (groups.length - 1) + itemGap * (n - 1) + item * n
}
