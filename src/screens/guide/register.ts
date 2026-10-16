// Registers the Guide (org.tizen.epg), its Guide-key entry point and the Schedule Viewing reminder.
import { registerApp } from '../../apps/registry'
import { registerOverlay, registerTvKeyHandler, shell } from '../../tv/shell'
import { Guide } from './Guide'
import { ReminderOverlay } from './Reminder'
import { ScheduleManager } from './ScheduleManager'

registerApp('guide', Guide)                       // org.tizen.epg
registerApp('schedule-manager', ScheduleManager)  // org.tizen.schedule-manager
registerOverlay('guide-reminder', ReminderOverlay, 10)

// XF86ChannelGuide: tv-viewer launches the Guide over any view (the Guide itself closes on it).
registerTvKeyHandler(key => {
  if (key !== 'Guide') return false
  shell.launch('guide')
  return true
})
