import { stubArt } from '../../../../../shared/fictional'
import { SAMSUNG_APPS, type HubApp } from './catalog'

// App icons. The server sends each app's icon (106x87 on the Apps panel, GBHOME_APPS_ITEM_CONTENT_IMG;
// 85x70 in More Apps, the size of InfoLink3/images/etc/dummyWidgetIcon.png); here they are the stub
// artwork with the app's first word.
function word(app: { id: string; name: string }) {
  return app.id === SAMSUNG_APPS ? 'Samsung Apps' : app.name.split(' ')[0]
}

export function appIcon(app: { id: string; name: string }) {
  const w = word(app)
  return stubArt(app.id, 106, 87, { label: w, size: w.length > 9 ? 14 : 18 })
}

export function appIconSmall(app: HubApp) {
  const w = word(app)
  return stubArt(app.id, 85, 70, { label: w, size: w.length > 9 ? 11 : 14 })
}
