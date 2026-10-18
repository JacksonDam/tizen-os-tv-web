import { createElement as h } from 'react'
import { openApp } from '../../shell'
import { setSmartHub } from '../../tv/online'
import { online } from '../net/data'
import { TermsPage } from '../net/Terms'
import type { MenuItem } from './types'
import type { Widget } from './widgets'

// Smart Features > Reset Smart Hub (HomePanel texts 0x7b / 0x7c / 0x7d): the PIN prompt carries the
// reset warning, then "Resetting all settings..." and "Reset completed." (inferred timing).
export function resetSmartHub(it: MenuItem): Widget {
  return {
    kind: 'pin',
    item: it,
    text: 'All Smart Hub settings, downloaded apps and accounts stored on your TV will be reset (taking about 1 min).\nEnter your PIN to reset now.',
    // the reset clears the Smart Hub's terms agreement and accounts (the PIN text above; inferred: the
    // stored state changes as the reset starts)
    then: () => ({
      kind: 'msg',
      ...(setSmartHub({ agreed: false, account: null }), {}),
      item: it,
      boxes: [
        { text: 'Resetting all settings...', timeout: 3000 },
        { text: 'Reset completed.', buttons: ['OK'] },
      ],
    }),
  }
}

// Smart Features items that need the Smart Hub servers (sign in, account, terms, social, properties):
// the offline TV answers with the Smart Hub's network message (HomePanel 0x14; inferred).
// Online (spec/online-net2013.md):
//  - Terms & Policy (0x704c, the Smart Hub's own disclaimer menu, CHomeDisclaimerMenu*): the terms
//    page in the wizard frame without steps, the boxes as stored; Next stores the agreement
//  - Samsung Account > Sign In / Create Account / Terms & Conditions, Privacy Policy: the Menu closes
//    (event 0x1b40) and the Settings app runs the "_ACCOUNT_" widget ("SignIn", "TermsConditions" ...,
//    CSettingAppBase::t_OnEvent @01c7b968 -> CInfoLink2Wrapper::RunWidget @0195fdf4 -> app 0x4d). That
//    widget and the widget engine are not part of this firmware update: the 'samsungaccount' app
//    (net/Account.tsx) stands for it as the plain screen the exhibit shows for apps it cannot run.
export function smartHubOnline(it: MenuItem, close: () => void): Widget | null {
  if (!online()) return smartHubOffline(it)
  if (it.id === 0x704c) {
    return {
      kind: 'custom',
      item: it,
      hideMenu: true,
      render: p => h('div', { className: 'm13-net-stage' },
        h(TermsPage, { step: 0, total: 0, smartHubStep: 0, fromMenu: true, onPrev: p.close, onNext: p.close, onExit: p.close })),
    }
  }
  close()
  openApp('samsungaccount', { from: 'menu', page: it.id === 0x1b5e ? 'TermsConditions' : it.id === 0x1b58 ? 'SignIn' : 'CreateAccount' })
  return null
}

export function smartHubOffline(it: MenuItem): Widget {
  return {
    kind: 'msg',
    item: it,
    boxes: [{ text: "You're not connected to the network.\nGo to Network Settings and connect to the internet to enjoy Smart Hub.", buttons: ['OK'] }],
  }
}

// Support > Software Update > Update now (CSWUCommonMenu_GB::MenuRun_UpdateNow -> SWU app event 0x515):
// without a network the SWU state machine stops at CSWUMainGBUI_CheckNetwork, message type 4
// (g_SWUUIAppWStringEng 2, one button, 10 s; CSWUMainMsg_GB::ConfigMsgBox). The SWU main window
// behind it is not built.
// Online (spec/online-net2013.md): the search runs (SWU 0x32 "Checking for updates…", the SWU main window
// is not built: shown as a message box, inferred 2.5 s) and the mocked server has nothing newer than
// T-MST12DEUC 2130.0: CSWUMainGBUI_NoNewUpdate::OnEntry @03c1aee4, message type 6 = SWU 0x31 (OK, 10 s).
export function updateNow(it: MenuItem): Widget {
  if (online()) {
    return {
      kind: 'msg',
      item: it,
      boxes: [
        { text: 'Checking for updates…', timeout: 2500 },
        { text: 'There are no new updates for you at the moment.', buttons: ['OK'], timeout: 10000 },
      ],
    }
  }
  return { kind: 'msg', item: it, boxes: [{ text: 'Please check that your network has been configured.', buttons: ['OK'] }] }
}
