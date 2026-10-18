import { useRemote } from '../../../../input/remote'
import type { Channel } from '../../../../tv/channels'
import type { ChMode } from '../navmode'

// Channel Category popup (green key; IEpgPopUpSubList 0x14 in a CPopUpWidget over the help marker). WIP.
export type CategoryItem = { mode: ChMode; label: string }

export function categoryItems(channels: Channel[]): CategoryItem[] {
  const items: CategoryItem[] = [{ mode: 'all', label: 'All' }]
  if (channels.some(c => c.kind === 'tv')) items.push({ mode: 'tv', label: 'TV' })
  if (channels.some(c => c.kind === 'radio')) items.push({ mode: 'radio', label: 'Radio' })
  if (channels.some(c => c.kind === 'data')) items.push({ mode: 'data', label: 'Data/Other' })
  return items
}

export function CategoryPopup({ onClose }: { items: CategoryItem[]; current: ChMode; anchorX: number; onClose: () => void; onSelect: (m: ChMode) => void }) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Green') onClose()
    return true
  })
  return null
}
