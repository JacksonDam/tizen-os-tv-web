import { useEffect } from 'react'
import { useRemote } from '../../input/remote'
import { Lottie } from '../../components/Lottie'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { FluxScreen } from './ui'

// Open User Guide (org.tizen.emanual-app, "eManual Native App launch 11.0.0", spec3/diag.md 7): shows
// its loading screen (featureconf emanual.loading_screen) and launches the e-Manual web app with
// &emanualurl=...; that web app is not part of this firmware (it is installed from the server), so the
// native app gives up and closes ("Failed to launch Emanual app after 20 retry, exiting the app").
// The loading art (emanual.edj, 33 MB) is not included: a FLUX spinner stands in for it (inferred).

const LOADING_MS = 4000 // mock: the retries

export function EManual({ onExit }: AppProps) {
  useEffect(() => {
    const t = setTimeout(() => onExit('settings'), LOADING_MS)
    return () => clearTimeout(t)
  }, [onExit])

  useRemote(key => {
    if (key === 'Home') return false
    if (key === 'Back') onExit('settings')
    else if (key === 'Exit') onExit('live')
    return true
  })

  return (
    <FluxScreen className="em">
      <Lottie className="em__spinner" src={`${TV}/support/i_img_progresscircle_01_s.json`} playing loop />
      <div className="em__title">e-Manual</div>
    </FluxScreen>
  )
}
