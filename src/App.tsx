import { useState } from 'react'
import { Stage } from './stage/Stage'
import { Home } from './screens/home/Home'
import { AllSettings } from './screens/allsettings/AllSettings'
import { useRemote } from './input/remote'

// What is on screen: the Smart Hub (csfs) or live TV. There is no video in this rebuild (or in QEMU),
// so live TV is black. The All Settings app (org.tizen.menu) is a card over live TV.
type Screen = { hub: boolean; settings: null | { target?: string } }

const TARGETS: Record<string, string | undefined> = { allsettings: undefined, support: 'support', network: 'connection' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ hub: true, settings: null })
  const [hubKey, setHubKey] = useState(0)

  // Lowest handler: the Home key raises the Smart Hub again (fresh, with its default focus).
  useRemote(key => {
    if (key === 'Home' && !screen.hub) {
      setHubKey(k => k + 1)
      setScreen({ hub: true, settings: null })
      return true
    }
    return false
  })

  return (
    <Stage>
      <div className="tv-video" />
      {screen.hub && (
        <Home
          key={hubKey}
          onHideHub={() => setScreen({ hub: false, settings: null })}
          onLaunch={target => setScreen({ hub: false, settings: { target: TARGETS[target] } })}
        />
      )}
      {screen.settings && (
        <AllSettings target={screen.settings.target} onClose={() => setScreen({ hub: false, settings: null })} />
      )}
    </Stage>
  )
}
