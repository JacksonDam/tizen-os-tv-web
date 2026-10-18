import { createElement as h } from 'react'
import { ContactSamsung } from './actionwin'
import { Equaliser } from './equaliser'
import { NetworkSettings, NetworkStatus, ScreenMirroring, WifiDirect } from './network'
import { PictureTest, SoundTest } from './selftest'
import { SignalInformation } from './siginfo'
import { TimerWindow } from './timer'
import type { MenuItem } from './types'
import { getValue, optionText } from './values'
import type { Widget } from './widgets'

// ---------------------------------------------------------------------------------------------
// Items whose OK opens one of these windows (t_MenuItemController "action:<id>").

export function actionWindow(it: MenuItem): Widget | null {
  switch (it.id) {
    case 0x6e5:
      return { kind: 'custom', item: it, render: p => h(ContactSamsung, { title: it.t, ...p }) }
    case 0x4e:   // Network Status (network app; the Menu is hidden while it runs, inferred)
      return { kind: 'custom', item: it, hideMenu: true, render: p => h(NetworkStatus, { ...p, openSettings: () => p.change?.(networkSettingsWidget(it)) }) }
    case 0x4d:   // Network Settings
      return networkSettingsWidget(it)
    case 0x4f:   // Wi-Fi Direct (network app)
      return { kind: 'custom', item: it, hideMenu: true, render: p => h(WifiDirect, { tvName: tvName(), ...p }) }
    case 0x5b:   // AllShare Settings > Screen Mirroring (WFD app, full screen)
      return { kind: 'custom', item: it, hideMenu: true, render: p => h(ScreenMirroring, { tvName: tvName(), ...p }) }
    case 0x143:  // Sound Effect > Equaliser
      return { kind: 'custom', item: it, render: p => h(Equaliser, p) }
    case 0x6ea:  // Self Diagnosis > Picture Test
      return { kind: 'custom', item: it, hideMenu: true, render: p => h(PictureTest, { item: it, ...p }) }
    case 0x3a2: case 0x3a3: case 0x3a4: case 0x3aa: case 0x3ab: case 0x3ac:   // On / Off Timer 1-3
      return { kind: 'custom', item: it, render: p => h(TimerWindow, { item: it, ...p }) }
    case 0x6ed:  // Self Diagnosis > Signal Information
      return { kind: 'custom', item: it, render: p => h(SignalInformation, { item: it, ...p }) }
    case 0x6ec:  // Self Diagnosis > Sound Test
      return { kind: 'custom', item: it, hideMenu: true, render: p => h(SoundTest, { item: it, ...p }) }
  }
  return null
}

// the TV name (CWLANWrapper::GetTVName): System > Device Name's current entry
function tvName() {
  const it = { id: 0x51, t: '', o: DEVICE_NAMES.map((n, i) => [i, n] as [number, string]) }
  return optionText(it, getValue(it))
}
const DEVICE_NAMES = ['[TV] Samsung', '[TV] Living room', '[TV] Bed room', '[TV] Small room', '[TV] Kitchen', '[TV] Home', 'User Input']

function networkSettingsWidget(it: MenuItem): Widget {
  return { kind: 'custom', item: it, hideMenu: true, render: p => h(NetworkSettings, p) }
}
