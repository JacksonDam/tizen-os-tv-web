import { useRemote } from '../../../../input/remote'
import type { AppProps } from '../../../shell'

// Placeholder (WIP).
export function ToolsApp({ close }: AppProps) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Tools') {
      close()
      return true
    }
    return false
  })
  return null
}
