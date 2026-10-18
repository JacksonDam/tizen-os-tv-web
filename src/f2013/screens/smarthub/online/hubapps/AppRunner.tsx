import { useEffect, useState } from 'react'
import { markOpened } from './catalog'
import { stubArt } from '../../../../../shared/fictional'
import { useRemote } from '../../../../../input/remote'
import { openApp, type AppProps } from '../../../../shell'
import { fw } from './assets'

// A third-party app the museum cannot run. The firmware hands an app to the widget manager (app 0x4d,
// CNNaviAppBase) after the Smart Hub's minimize motion (CHomeExecutor::ExecuteGridItem(..., 1) ->
// RunWidget). What the TV shows next is the widget runtime's, which is not part of exeDSP; reference
// footage (EhQ9pDtWV4M 2:06-2:12, 8mzEVR_QsGs 5:46-5:52) shows the TV picture gone and a black screen,
// then "Loading <app>…" with a small spinner in the middle, then the app. After that the museum shows
// a plain placeholder: the app's stub artwork and name.
// Keys: RETURN leaves the app back to the Smart Hub panel it came from (the 2013 widgets return to the
// Smart Hub on RETURN at their top level), EXIT leaves it to the TV picture, SMART HUB opens the Smart
// Hub (falls through to its hotkey).

// `from`: the Smart Hub panel RETURN goes back to; `back`: an application to reopen instead (the Game
// Hub reopens on the game's page); neither: RETURN goes back to the TV picture (as EXIT).
export type RunParams = { id: string; name: string; from?: number; back?: { app: string; params?: unknown } }

const BLACK_MS = 1500   // (inferred from the footage)
const LOADING_MS = 2000 // (inferred from the footage)

// InfoLink3/loading_01..18.png (g_InfoLink3Image 0x35-0x46), the 18-frame spinner the widget manager
// plays over 2400 ms (CNNaviLoadingBase::Create: SetFrames(.., 0x12, 0x960)); 42 px images in the
// 1280x720 OSD, x1.5 on the stage.
const SPIN_FRAMES = Array.from({ length: 18 }, (_, i) => fw(`InfoLink3/loading_${String(i + 1).padStart(2, '0')}.png`))
export function Spinner({ x, y, size = 63 }: { x: number; y: number; size?: number }) {
  const [f, setF] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setF(v => (v + 1) % 18), 2400 / 18)
    return () => clearInterval(t)
  }, [])
  return <img src={SPIN_FRAMES[f]} alt="" style={{ position: 'absolute', left: x, top: y, width: size, height: size }} />
}

export function AppRunner({ params, close }: AppProps) {
  const p = params as RunParams
  const [phase, setPhase] = useState<'black' | 'loading' | 'running'>('black')
  useEffect(() => {
    markOpened(p.id)
    const a = setTimeout(() => setPhase('loading'), BLACK_MS)
    const b = setTimeout(() => setPhase('running'), BLACK_MS + LOADING_MS)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useRemote(key => {
    switch (key) {
      case 'Back':
        if (p.back) openApp(p.back.app, p.back.params)
        else if (p.from !== undefined) openApp('smarthub', { panel: p.from })
        else close()
        return true
      case 'Exit':
        close()
        return true
      case 'Home':
      case 'VolumeUp':
      case 'VolumeDown':
      case 'Mute':
      case 'Power':
        return false
      default:
        return true
    }
  })

  return (
    <div className="hub-runner">
      {phase === 'loading' && (
        <div style={{ position: 'absolute', left: 0, top: 510, width: 1920, height: 60 }}>
          <Spinner x={760} y={0} size={60} />
          <div style={{ position: 'absolute', left: 836, top: 0, height: 60, lineHeight: '60px', fontSize: 32, whiteSpace: 'nowrap' }}>
            Loading {p.name}…
          </div>
        </div>
      )}
      {phase === 'running' && (
        <img src={stubArt(p.id, 1920, 1080, { label: p.name, size: 120 })} alt="" style={{ position: 'absolute', inset: 0 }} />
      )}
    </div>
  )
}
