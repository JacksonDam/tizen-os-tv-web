// The online Apps, Games and Social panels of the 2013 Smart Hub and the full-screen applications they
// open (area apps2013; spec samsung-tv-qemu/extract/f13/spec/online-apps2013.md).
import { openApp, registerApp, registerOverlay } from '../../../../shell'
import { setSetting } from '../../../../tv/store'
import { APPS, GAMES, SOCIAL } from '../../data'
import { registerOnlinePanel } from '../../panels'
import { AppsPanel, AppsPin } from '../apps/AppsPanel'
import { MoreApps } from '../apps/MoreApps'
import { GameHub, type HubParams } from '../games/GameHub'
import { GamesPanel } from '../games/GamesPanel'
import { requestSocial, SocialPanel, SocialPopups } from '../social/SocialPanel'
import { AppRunner } from './AppRunner'
import { HubTest } from './HubTest'
import './hubapps.css'

registerApp({ id: 'hubapp', component: AppRunner, z: 210 })
registerApp({ id: 'moreapps', component: MoreApps, z: 210 })
registerApp({ id: 'gamehub', component: GameHub, z: 210 })
// the Social Settings window and the Video Call message, above the whole Smart Hub
registerOverlay({ id: 'hub-social', z: 250, component: SocialPopups })
// the PIN entry for a locked app in the Apps panel
registerOverlay({ id: 'hub-pin', z: 250, component: AppsPin })

registerOnlinePanel(APPS, AppsPanel, {
  // the Apps sub menu: item 0 "More Apps" (CHomeExecutor::m_GetSubMenuItemEnum(6, 0) = 2 -> app 0x4d)
  submenu: (index, launch) => {
    if (index !== 0) return false
    launch(() => openApp('moreapps', { from: APPS }))
    return true
  },
})

registerOnlinePanel(GAMES, GamesPanel, {
  // the Games sub menu: My Page and All Games (m_GetSubMenuItemEnum(9, i) = 1, 2 -> Game Hub content types
  // 0x20130832 / 0x20130833)
  submenu: (index, launch) => {
    if (index !== 0 && index !== 1) return false
    launch(() => openApp('gamehub', { view: index === 0 ? 'mine' : 'all', from: 'hub' } satisfies HubParams))
    return true
  },
})

registerOnlinePanel(SOCIAL, SocialPanel, {
  // the Social sub menu: Friends' Picks, What's Hot, Friends, Video Call (m_GetSubMenuItemEnum(0xd, i) =
  // 6-9, CHomeExecutor::m_ExecuteSocialSubMenuItem @04677c90). Video Call without Skype returns 9 ->
  // event 0x11903b -> the "Install the Skype app" message. The other three run the Social application
  // (CCT*, app 0xbe), which has nothing to show without linked accounts and is not built here: they open
  // the Social Settings popup where the accounts are linked (inferred).
  // Install from these windows opens Samsung Apps straight away: the sub menu's minimize motion would
  // grow this item's colour tag, which belongs to the Social application.
  submenu: index => {
    if (index === 3) requestSocial('videocall')
    else if (index >= 0 && index <= 2) requestSocial('settings')
    else return false
    return true
  },
})

// Development harness: one panel body full screen over its panel background, without the carousel
// (window.__setup.open('hubtest', { panel: 3 })).
if (import.meta.env.DEV) {
  registerApp({ id: 'hubtest', component: HubTest, z: 205 })
  ;(window as unknown as { __hub: (panel: number) => void }).__hub = panel => openApp('hubtest', { panel })
  // window.__hubset('hubapps.locked=["aurora-play"]') for captures (one argument: shot.mjs splits keys
  // at commas)
  ;(window as unknown as { __hubset: (kv: string) => void }).__hubset = kv => {
    const i = kv.indexOf('=')
    setSetting(kv.slice(0, i), kv.slice(i + 1))
  }
}
