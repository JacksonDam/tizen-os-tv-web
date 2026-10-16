// Registers first-time setup, the PIN pad, Change PIN and Factory data reset (spec3/setup.md).
import { useEffect } from 'react'
import { registerApp } from '../../apps/registry'
import { registerPopup } from '../allsettings/extensions'
import { patchRows, registerMenuPatch } from '../allsettings/menu'
import { registerOverlay, registerPinPrompt, registerPowerOnHook, shell } from '../../tv/shell'
import { PinPromptOverlay } from './PinPrompt'
import { requestPinImpl } from './pinPromptStore'
import { ChangePinPopup } from './ChangePinPopup'
import { FactoryResetPopup } from './FactoryResetPopup'
import { ToastOverlay } from './toast'
import { setSetupPending, setupPending } from './setupState'
import { SetupWizard } from './wizard/SetupWizard'

registerApp('setup', SetupWizard)                     // com.samsung.tv.wizard ("setup" wizard)
registerPopup('changepin', ChangePinPopup)            // setting-ui popup.changepin
registerPopup('factoryreset', FactoryResetPopup)      // setting-ui popup.reset (self-diagnosis-reset)
registerPinPrompt(requestPinImpl)                     // EnterPinPopup for pinprompt rows and apps
registerOverlay('pin-prompt', PinPromptOverlay, 50)
registerOverlay('settings-toast', ToastOverlay, 51)

registerMenuPatch(menu =>
  patchRows(menu, {
    'change-pin': { popup: 'changepin' },
    'self-diagnosis-reset': { popup: 'factoryreset' },
    // Software Update's pinprompt is decided at runtime by libsettings-datafw (spec open question A-3);
    // a home TV opens it without the PIN (inferred).
    softwareupdate: { pinPrompt: false },
  }),
)

// While setup is pending (after a factory data reset, or ?setup=1), the TV powers on into setup.
registerPowerOnHook(() => (setupPending() ? { app: 'setup' } : null), 100)

// ?setup=1 starts setup on load; ?setup=0 cancels a pending setup. A normal first visit opens on the
// Smart Hub as before.
if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search).get('setup')
  if (q === '1') setSetupPending(true)
  else if (q === '0') setSetupPending(false)
}

// Page load counts as a power-on for a pending setup: start the wizard once the shell is up.
let booted = false
function SetupBoot() {
  useEffect(() => {
    if (booted) return
    booted = true
    if (setupPending()) shell.launch('setup')
  }, [])
  return null
}
registerOverlay('setup-boot', SetupBoot, -1)
