// Registers this feature's overlays and TV-key handlers: the 123 key's number pad (virtual remote),
// the notification center and its banner, and the Game Bar.
import { registerOverlay, registerTvKeyHandler } from '../../tv/shell'
import { NumPad, toggleNumPad } from './numpad/NumPad'
import { NotificationCenter } from './notifications/NotificationCenter'
import { NotificationToast, NotificationTriggers } from './notifications/NotificationToast'
import { GameBar, GameBarTriggers, launchGameBar } from './gamebar/GameBar'

// XF86More (the 123 button): org.tizen.function-osd shows the VirtualRemoteControl gadget.
registerTvKeyHandler(key => {
  if (key !== 'More') return false
  toggleNumPad()
  return true
})
registerOverlay('virtual-remote', NumPad, 20)

// Notifications: the center (opened from Quick Settings' Notification button), the arrival banner and
// the mock's device-arrival trigger.
registerOverlay('notification-center', NotificationCenter, 60)
registerOverlay('notification-banner', NotificationToast, 61)
registerOverlay('notification-triggers', NotificationTriggers, 0)

// Game Bar: XF86PlayBackGame (long press of Play/Pause) in Game Mode on an HDMI input; Autorun.
registerTvKeyHandler(key => {
  if (key !== 'PlayBackGame') return false
  launchGameBar()
  return true
})
registerOverlay('gamebar', GameBar, 50)
registerOverlay('gamebar-triggers', GameBarTriggers, 0)
