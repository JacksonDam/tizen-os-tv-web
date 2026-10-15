// Registers the Support apps and gadgets (About TV, Software Update, Device Care).
import { registerGadget } from '../allsettings/extensions'
import { registerApp } from '../../apps/registry'
import { AboutTV } from './AboutTV'
import { SoftwareUpdate } from './SoftwareUpdate'
import { DeviceCare } from './DeviceCare'

registerGadget('abouttv', { width: 744, component: AboutTV })
registerApp('swu', SoftwareUpdate)
registerApp('devicecare', DeviceCare)
