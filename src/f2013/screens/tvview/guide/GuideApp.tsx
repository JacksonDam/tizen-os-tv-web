import { useRemote } from '../../../../input/remote'
import type { AppProps } from '../../../shell'

// Placeholder (WIP).
export function GuideApp({ close }: AppProps) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Guide') {
      close()
      return true
    }
    return false
  })
  return null
}
