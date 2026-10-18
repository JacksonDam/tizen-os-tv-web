import { getSetting, registerSources, type Source } from '../../tv/store'

// The inputs of the mocked UE40F6400 (EU), as the Source list builds them.
//
// Order: CSourceManagerUtil::t_SetSourceTvItemList (0x0465529c) appends TV, (ISP app), HDMI 1..n,
// SCART, AV, S-Video, Component, DisplayPort, RVU, RUI, PC, DVI, MagicInfo, OSD module, WiDi
// (Screen Mirroring), USB devices, DiiVA, DLNA devices. Port counts come from TCConfig::Default(type)
// (the model config service, not in exeDSP): for the F6400 they are taken from the set's connector
// panel (inferred: 4 HDMI, 1 SCART, 1 AV and 1 Component sharing the Y jack, no PC/DVI/S-Video/
// DisplayPort). Screen Mirroring is added when the Screen Mirroring app exists and Wi-Fi is valid
// (m_AddWIDISource 0x04654d5c; the F6400 has built-in Wi-Fi). USB and DLNA entries appear only while
// such devices are connected (m_AddUSBDevice 0x04654c20, m_AddDLNADevice 0x04654bd8): none here.
//
// Names (CSourceMainWndBase::m_GetSourceItem 0x0299869c, g_SourceListWStringEng): one SCART/AV/
// Component port is called "Ext." / "AV" / "Component" (numbered only when there are several); with
// several HDMI ports they are "HDMI1".."HDMI4", and the DVI-capable one is "HDMIn/DVI" where
// n = AppConfig::D_HDMI_DVI_POSITION, whose data default is 2 (0x092cd670; the factory option 0x32
// can override it, CTaskManager::t_InitTargetDefine) -> "HDMI2/DVI".
//
// Mocked hardware: HDMI1 has a games console (stand-in loop-life.mp4) and HDMI2 a set-top box
// (loop-bars.mp4); every other external input has nothing connected (no picture). The device names
// are presets from the firmware's Edit Name list (Source > Tools > Edit Name), so visitors can see
// what is plugged in where (inferred: a fresh set has no edit names).

export type SourceType = 'tv' | 'hdmi' | 'ext' | 'av' | 'component' | 'mirroring'

type Input = Source & {
  type: SourceType
  sourceType: number      // CSourceManagerUtil::SOURCE_TYPE
  connected: boolean      // jack detected (t_FlagLegacyDeviceConnection)
}

const INPUTS: Input[] = [
  { id: 'TV', title: 'TV', video: '', type: 'tv', sourceType: 0x00, connected: true },
  { id: 'HDMI1', title: 'HDMI1', device: 'Game', video: 'loop-life.mp4', type: 'hdmi', sourceType: 0x39, connected: true },
  { id: 'HDMI2', title: 'HDMI2/DVI', device: 'Cable STB', video: 'loop-bars.mp4', type: 'hdmi', sourceType: 0x3a, connected: true },
  { id: 'HDMI3', title: 'HDMI3', video: '', type: 'hdmi', sourceType: 0x3b, connected: false },
  { id: 'HDMI4', title: 'HDMI4', video: '', type: 'hdmi', sourceType: 0x3c, connected: false },
  { id: 'EXT', title: 'Ext.', video: '', type: 'ext', sourceType: 0x41, connected: false },
  { id: 'AV', title: 'AV', video: '', type: 'av', sourceType: 0x1c, connected: false },
  { id: 'COMPONENT', title: 'Component', video: '', type: 'component', sourceType: 0x29, connected: false },
  { id: 'MIRRORING', title: 'Screen Mirroring', video: '', type: 'mirroring', sourceType: 0xe4, connected: true },
]

registerSources(INPUTS.map(({ id, title, device, video }) => ({ id, title, device, video })))

export function inputInfo(id: string): Input | undefined {
  return INPUTS.find(i => i.id === id)
}

// A cable/device is plugged into the input (TV and Screen Mirroring always count as connected).
export function connected(id: string): boolean {
  return inputInfo(id)?.connected ?? false
}

// The Edit Name list of the Source app's Tools (CSourceEditNameActionWindow), string ids in
// g_SourceListWStringEng. 46 is '----' (no name).
export const EDIT_NAMES: string[] = [
  '----', 'VCR', 'DVD', 'Cable STB', 'Satellite STB', 'PVR STB', 'AV Receiver', 'Game', 'Camcorder',
  'PC', 'DVI PC', 'DVI Devices', 'TV', 'IPTV', 'Blu-ray', 'HD DVD', 'DMA',
]

// The device name shown under the input: the user's Edit Name (setting 'source.name.<id>'), else
// the preset of the mocked device.
export function deviceName(id: string): string {
  const set = getSetting<string>(`source.name.${id}`, '')
  if (set) return set === '----' ? '' : set
  return inputInfo(id)?.device ?? ''
}
