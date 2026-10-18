import { useRemote } from '../../../../input/remote'

// Quick Nav (red key; CEpgQuickNaviWidget). WIP.
export function QuickNavi({ onClose }: { canGoBack: boolean; onClose: () => void; onMove: (d: 'Up' | 'Down' | 'Left' | 'Right') => void }) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Red') onClose()
    return true
  })
  return null
}
