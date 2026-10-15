import type { MenuItem } from './menuData'

// Support category rows for the web rebuild (spec2/device-sources-home.md A.1, A.3.1, A.4): Device Care
// launches its app and closes Settings, Software Update holds Update Now (SWU app) and Auto Update,
// Tips and User Guides is unchanged, and the last row is "About TV" (the AboutTVGadget).

const OFF_ON = [{ value: 0, label: 'Off' }, { value: 1, label: 'On' }]

export function patchSupport(menu: MenuItem[]): MenuItem[] {
  return menu.map(cat => {
    if (cat.id !== 'support') return cat
    const tips = (cat.groups ?? []).flat().find(r => r.id === 'tips-and-guides')
    const groups: MenuItem[][] = [
      [
        {
          id: 'tdm', title: 'Device Care', style: 'title', action: 'app', ui: 'application',
          help: 'Optimize and diagnose the condition of your TV. You can check and clean your storage space, diagnose problems or request technical support.',
          launch: { app: 'devicecare', args: { launch_mech: 'menu' }, exitMenu: true },
        },
      ],
      [
        {
          id: 'softwareupdate', title: 'Software Update', style: 'title',
          pinPrompt: true, // pinprompt=true in the data; decided at runtime by libsettings-datafw (spec open question A-3)
          help: "View TV's software version and update if necessary.\nCurrent version: 1301.0",
          groups: [
            [
              {
                id: 'updatenow', title: 'Update Now', style: 'title', action: 'app', ui: 'application',
                help: 'Update software by downloading update files.',
                launch: { app: 'swu', args: { MainAppType: 'UpgradeSearch' } },
              },
              {
                id: 'autoupdate', title: 'Auto Update', style: 'title.switch',
                value: 0, // vconf db/menu/support/softwareupdate/autoupdate default 0
                options: OFF_ON,
                help: 'Automatically start software updates once TV is powered off.',
              },
            ],
          ],
        },
      ],
      ...(tips ? [[tips]] : []),
      [
        {
          id: 'contact-samsung', title: 'About TV', style: 'title', action: 'app', ui: 'ui-gadget',
          help: 'View contact information and TV specifications that you may need to receive service support from the Samsung Call Center or Samsung website.',
          gadget: 'abouttv',
        },
      ],
    ]
    return { ...cat, groups }
  })
}
