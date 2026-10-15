// Quick Settings tiles on this TV (QLPanel level 1). Order, titles, values and icons:
// extract/ui/spec/settings.md 2.1-2.4 (Emerging list, eden_quick_setting = 3, no tuner, nothing paired).

import { TV } from '../../assets'

const QS = `${TV}/com.samsung.tv.coba.setting/Eden%20QuickSetting`
const NET = `${TV}/qlpanel/assets/networksettings`
const VD = `${TV}/VD_ICONS`

export type TileValue = { label: string; icon: string }

export type SecondDepthRow =
  | { kind: 'option'; label: string; selected?: boolean }
  | { kind: 'switch'; label: string; on: boolean }
  | { kind: 'menu'; label: string }

export type Tile = {
  id: string
  title?: string               // title-less tiles show their subtitle as the title, with no second line
  values?: TileValue[]         // toggle tiles: Enter steps to the next value and wraps
  value?: number               // default index into values
  subtitle?: string            // fixed value line for non-toggle tiles
  icon?: string                // fixed icon for non-toggle tiles
  iconFocused?: string         // static focused icon (Sound Output)
  colouredIcon?: boolean       // not overlaid black when focused
  action: 'toggle' | 'second' | 'gadget' | 'launch' | 'edit'
  second?: { title: string; groups: SecondDepthRow[][] }
}

export const TILES: Tile[] = [
  { id: 'more', subtitle: 'All Settings', icon: `${QS}/144_all_settings.json`, action: 'launch' },
  { id: 'picture_setup', title: 'Brightness', subtitle: '25/50', icon: `${QS}/202_picturemode_Brightness.json`, action: 'gadget' },
  {
    id: 'picturemode',
    title: 'Picture Mode',
    action: 'toggle',
    value: 1,
    values: [
      { label: 'Dynamic', icon: `${QS}/13_picturemode_Dynamic.json` },
      { label: 'Standard', icon: `${QS}/09_picturemode_Standard.json` },
      { label: 'Movie', icon: `${QS}/12_picturemode_Movie.json` },
      { label: 'FILMMAKER MODE', icon: `${QS}/16_picturemode_filmmaker.json` },
    ],
  },
  {
    id: 'soundmode',
    title: 'Sound Mode',
    action: 'toggle',
    value: 0,
    values: [
      { label: 'Standard', icon: `${QS}/21_soundmode_Standard.json` },
      { label: 'Amplify', icon: `${QS}/27_soundmode_Amplify.json` },
    ],
  },
  {
    id: 'soundoutput',
    title: 'Sound Output',
    subtitle: 'TV Speaker',
    icon: `${VD}/i_icon_convergence_l_tv.svg`,
    iconFocused: `${VD}/i_icon_device_m_tv.svg`,
    colouredIcon: true,
    action: 'second',
    second: { title: 'Sound Output', groups: [[{ kind: 'option', label: 'TV Speaker', selected: true }]] },
  },
  {
    id: 'bt_devices',
    title: 'Bluetooth',
    subtitle: '',
    icon: `${QS}/160_bt_connection.json`,
    action: 'second',
    second: { title: 'Bluetooth devices', groups: [[{ kind: 'menu', label: 'All Bluetooth Devices' }]] },
  },
  {
    id: 'network',
    title: 'LAN',
    subtitle: 'Connected',
    icon: `${NET}/43_lan_Connected.json`,
    action: 'second',
    second: {
      title: 'Network',
      groups: [[{ kind: 'menu', label: 'Network Settings' }, { kind: 'menu', label: 'Network Status' }]],
    },
  },
  {
    id: 'soccermode',
    title: 'AI Soccer Mode',
    action: 'toggle',
    value: 0,
    values: [
      { label: 'Off', icon: `${QS}/225_soccermode.json` },
      { label: 'Auto', icon: `${QS}/225_soccermode.json` },
    ],
  },
  {
    id: 'gamemode',
    title: 'Game Mode',
    action: 'toggle',
    value: 0,
    values: [
      { label: 'Off', icon: `${QS}/57_gamemode_Off.json` },
      { label: 'On', icon: `${QS}/56_gamemode_On.json` },
    ],
  },
  {
    id: 'energysavingsolution',
    title: 'Energy Saving Solution',
    action: 'toggle',
    value: 0,
    values: [
      { label: 'Off', icon: `${QS}/177_energy_saving_solution_off.json` },
      { label: 'On', icon: `${QS}/176_energy_saving_solution_on.json` },
    ],
  },
  { id: 'support', subtitle: 'Support', icon: `${QS}/149_support.json`, action: 'launch' },
  {
    id: 'sleeptimer',
    title: 'Sleep Timer',
    action: 'toggle',
    value: 0,
    values: [
      { label: 'Off', icon: `${QS}/55_sleeptimer_Off.json` },
      { label: '30 min', icon: `${QS}/54_sleeptimer_On.json` },
      { label: '60 min', icon: `${QS}/54_sleeptimer_On.json` },
      { label: '120 min', icon: `${QS}/54_sleeptimer_On.json` },
      { label: '180 min', icon: `${QS}/54_sleeptimer_On.json` },
    ],
  },
  { id: 'edit', title: 'Edit', icon: `${TV}/com.samsung.tv.coba.newhome/home_i_icon_app_edit.svg`, action: 'edit' },
]

// Brightness gadget rows (BrightnessGadget, spec 2.4 / 3.7).
export type GadgetRow = { id: string; label: string; min: number; max: number; value: number; format?: (v: number) => string }
export const BRIGHTNESS_ROWS: GadgetRow[] = [
  { id: 'brightness', label: 'Brightness', min: 0, max: 50, value: 25 },
  { id: 'contrast', label: 'Contrast', min: 0, max: 50, value: 45 },
  { id: 'sharpness', label: 'Sharpness', min: 0, max: 20, value: 0 },
  { id: 'color', label: 'Color', min: 0, max: 50, value: 25 },
  {
    id: 'tint',
    label: 'Tint (G/R)',
    min: 0,
    max: 30,
    value: 15,
    format: v => (v === 15 ? '0/0' : v < 15 ? `G${15 - v}` : `R${v - 15}`),
  },
]
