import { registerApp } from '../../apps/registry'
import { registerPopup } from '../allsettings/extensions'
import { AutoTuningPopup } from './AutoTuningPopup'
import { ChannelSearch } from './ChannelSearch'
import { ChannelList } from './ChannelList'

// Registers the channel apps and popups (Auto Tuning, channel scan, channel list).
registerPopup('autotuning', AutoTuningPopup)     // Broadcasting > Auto Tuning (UgManualScan "auto-program")
registerApp('channel-search', ChannelSearch)     // org.tizen.channel-search
registerApp('channel-list', ChannelList)         // com.samsung.tv.channel-list (Channel List key)
