// Registers the picture, sound, timer and accessibility engines (overlays), the menu's sound and
// picture pages (gadgets), the popup.reset rows, and what the TV shows after power on.
import { registerGadget, registerPopup } from '../allsettings/extensions'
import { patchRows, registerMenuPatch } from '../allsettings/menu'
import { getSetting } from '../../tv/store'
import { registerOverlay, registerPowerOnHook } from '../../tv/shell'
import { AvAccessibility, AvPicture } from './Engines'
import { AvTimers } from './Timers'
import { PanelToast } from './PanelPopup'
import { BalancePage, EqualizerPage } from './SoundPages'
import { ResetPopup, ZoomPositionPage } from './PicturePages'
import { SpinTimePopup } from './SpinTimePopup'

registerOverlay('av-picture', AvPicture, -10)
registerOverlay('av-accessibility', AvAccessibility, -10)
registerOverlay('av-toast', PanelToast, 5)
registerOverlay('av-timers', AvTimers, 20)

registerGadget('av-balance', { width: 520, component: BalancePage })
registerGadget('av-equalizer', { width: 744, component: EqualizerPage })
registerGadget('av-zoomposition', { width: 520, component: ZoomPositionPage })
registerPopup('av-reset', ResetPopup)
registerPopup('av-spintime', SpinTimePopup)

const SIZE_LABELS: Record<number, string> = { 0: '16:9 Standard', 1: 'Custom', 2: '4:3' }

registerMenuPatch(menu =>
  patchRows(menu, {
    balance: { gadget: 'av-balance' },
    equalizer: { gadget: 'av-equalizer' },
    resetpicture: { popup: 'av-reset' },
    resetsound: { popup: 'av-reset' },
    'whitebalance-reset': { popup: 'av-reset' },
    // Picture Size Settings shows the current size; Zoom and Position is for Custom only
    picturesize: { live: v => ({ valueText: SIZE_LABELS[Number(v['picturesize-mode'] ?? 0)] }) },
    '43-picturesize': { live: v => ({ disabled: Number(v['picturesize-autowide'] ?? 0) !== 1 }) },
    // Off Timer > Time: set with the time spinner once a schedule is chosen
    'offtimer1-timer': {
      popup: 'av-spintime',
      live: v => ({ valueText: String(v['offtimer1-timer'] ?? '00:00'), disabled: (v['offtimer1-setup'] ?? 'SID_OFF') === 'SID_OFF' }),
    },
    'picture-position': {
      gadget: 'av-zoomposition',
      live: v => ({ disabled: Number(v['picturesize-mode'] ?? 0) !== 1 }),
    },
  }),
)

// Start Screen Option > Start with Smart Hub Home (default Off): Off powers on to the picture.
registerPowerOnHook(() => (getSetting<number>('smarthub_autostart', 0) ? 'hub' : 'live'))
