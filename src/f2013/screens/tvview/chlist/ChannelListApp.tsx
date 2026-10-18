import { useRemote } from '../../../../input/remote'
import type { AppProps } from '../../../shell'

// Placeholder (WIP).
export function ChannelListApp({ close }: AppProps) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'ChannelList') {
      close()
      return true
    }
    return false
  })
  return null
}
