import { useRemote } from '../../input/remote'
import type { AppProps } from '../../apps/registry'
import { STUB_APPS, stubArt } from '../../shared/fictional'
import { squircleClip } from './agreed/squircle'
import './agreed/agreed.css'

// The placeholder for a third-party app the firmware cannot run (the museum's stub apps): the app's
// artwork and name. Keys behave as the TV treats a web app: RETURN at the app's first page closes it and
// the Smart Hub comes back with the focus where it was (csfs was relocated below the app); EXIT closes it
// for the TV picture; HOME opens the Smart Hub over it (the TV's Home key, handled by the shell).

const clip = squircleClip(224, 224, 64)

export function StubAppScreen({ args, onExit }: AppProps) {
  const app = STUB_APPS.find(a => a.id === args?.app) ?? STUB_APPS[0]
  useRemote(key => {
    if (key === 'Back') onExit('hub')
    else if (key === 'Exit') onExit('live')
    else if (key === 'Home') return false
    return true
  })
  return (
    <div className="stubapp">
      <img className="stubapp__bg" src={stubArt(`${app.id}-screen`, 1920, 1080, { label: false })} alt="" />
      <img className="stubapp__icon" style={{ clipPath: clip }} src={stubArt(app.id, 224, 224, { label: app.name, size: 30 })} alt="" />
      <div className="stubapp__name">{app.name}</div>
    </div>
  )
}
