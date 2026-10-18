import { useRemote } from '../../../input/remote'
import type { AppProps } from '../../shell'
import './smarthub.css'

export function SmartHub({ close }: AppProps) {
  useRemote(key => {
    if (key === 'Back' || key === 'Exit' || key === 'Home') {
      close()
      return true
    }
    return key === 'Up' || key === 'Down' || key === 'Left' || key === 'Right' || key === 'Enter'
  })
  return <div className="sh" />
}
