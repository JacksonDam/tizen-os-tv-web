import type { RemoteSection } from '../remote/RemotePanel'

// The 2008 Philips European remote (silver "TELEVISION" remote of the PFL5603/7603 range): standby and
// source, the colour keys, INFO / OPTION / GUIDE, the cursor ring with OK, MENU and BACK, the volume and
// programme rockers with mute, the digits and P/P (previous programme). Keyboard shortcuts follow the
// other exhibits (P is Power on this page).
export const REMOTE_PHILIPS: RemoteSection[] = [
  { type: 'row', buttons: [
    { key: 'Power', label: 'Power', kbd: 'P', cls: 'rc-btn--power' },
    { key: 'Source', label: 'Source', kbd: 'S' },
  ] },
  { type: 'colours' },
  { type: 'row', buttons: [
    { key: 'Info', label: 'Info', kbd: 'I' },
    { key: 'Tools', label: 'Option', kbd: 'T' },
    { key: 'Guide', label: 'Guide', kbd: 'G' },
  ] },
  { type: 'dpad' },
  { type: 'row', buttons: [
    { key: 'Settings', label: 'Menu', kbd: 'Q' },
    { key: 'Back', label: 'Back', kbd: 'Esc' },
  ] },
  { type: 'rockers' },
  { type: 'row', buttons: [
    { key: 'Mute', label: 'Mute', kbd: 'M' },
  ] },
  { type: 'digits' },
  { type: 'row', buttons: [
    { key: 'PreCh', label: 'P/P', kbd: 'R' },
  ] },
]
