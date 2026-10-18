import { useRemote } from '../../../../input/remote'
import type { AppProps } from '../../../shell'

// Placeholder (WIP).
export function SourceApp({ close }: AppProps) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Source') {
      close()
      return true
    }
    return false
  })
  return null
}
