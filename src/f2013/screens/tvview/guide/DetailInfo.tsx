import { useRemote } from '../../../../input/remote'
import type { Channel, GuideProgramme } from '../../../../tv/channels'

// Programme detail window (CDetailInformation). WIP.
export function DetailInfo({ onClose }: { ch: Channel; prog: GuideProgramme; onClose: () => void }) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Info' || key === 'Enter') onClose()
    return true
  })
  return null
}
