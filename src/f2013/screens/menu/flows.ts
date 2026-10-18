import type { MenuItem } from './types'
import type { Widget } from './widgets'

// Smart Features > Reset Smart Hub (HomePanel texts 0x7b / 0x7c / 0x7d): the PIN prompt carries the
// reset warning, then "Resetting all settings..." and "Reset completed." (inferred timing).
export function resetSmartHub(it: MenuItem): Widget {
  return {
    kind: 'pin',
    item: it,
    text: 'All Smart Hub settings, downloaded apps and accounts stored on your TV will be reset (taking about 1 min).\nEnter your PIN to reset now.',
    then: () => ({
      kind: 'msg',
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
export function updateNow(it: MenuItem): Widget {
  return { kind: 'msg', item: it, boxes: [{ text: 'Please check that your network has been configured.', buttons: ['OK'] }] }
}
