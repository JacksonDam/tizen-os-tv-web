import { openApp } from '../../shell'
import { MOVIES, MULTIMEDIA, ONTV } from './data'

// What Enter on a sub menu item runs for the panels this module draws (CHomeExecutor::ExecuteSubMenuItem
// @04677fec: the item maps to an application and an item enum, m_GetSubMenuAppId @046735e8 /
// m_GetSubMenuItemEnum @04673f5c with the tables at 0x0882a2cc):
//   On TV (app 0xba): Guide = 5 (m_ExecuteEPGItem: the Guide), Timeline View = 6, Recorded TV = 7
//   Films and TV Shows (app 0xbf): Favourites 1, Featured 5, Movies 4, TV Shows 3, Purchased 2
//   Photos, Videos & Music (app 0x2d): All Content 6, Photos 3, Videos 2, Music 4, Recorded TV 5
// Each runs after the minimize motion (`launch`). Returns false when nothing handles the item.
export function runOwnSubmenu(panel: number, index: number, launch: (run: () => void) => void): boolean {
  let run: (() => void) | null = null
  if (panel === ONTV) {
    if (index === 0) run = () => openApp('guide')
    else if (index === 1) run = () => openApp('ontv-timeline')
    else if (index === 2) run = () => openApp('mmbrowser', { category: 'recorded', from: ONTV })
  } else if (panel === MOVIES) {
    const tab = (['favourites', 'featured', 'movies', 'tvshows', 'purchased'] as const)[index]
    if (tab) run = () => openApp('movies2013', { tab })
  } else if (panel === MULTIMEDIA) {
    const category = (['all', 'photos', 'videos', 'music', 'recorded'] as const)[index]
    if (category) run = () => openApp('mmbrowser', { category, from: MULTIMEDIA })
  }
  if (!run) return false
  launch(run)
  return true
}
