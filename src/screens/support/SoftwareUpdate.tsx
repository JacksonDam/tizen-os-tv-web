import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { MessageBox } from '../../components/MessageBox'
import { Lottie } from '../../components/Lottie'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { SOFTWARE_UPDATE as S } from './supportData'
import './software-update.css'

// Software Update > Update Now (org.tizen.tv.swu, spec2/device-sources-home.md A.3.3): the full-screen
// "SEARCHING WINDOW" (title, spinner, linear progress with percentage, Cancel), then the INFO WINDOW
// popup "There are no new updates for you at the moment." with OK. OK, Back or Cancel return to Settings.

export function SoftwareUpdate({ onExit }: AppProps) {
  const [percent, setPercent] = useState(0)
  const [done, setDone] = useState(false)

  // mock server check: 0 -> 100 % over checkMs, then the result popup
  useEffect(() => {
    const start = performance.now()
    const t = setInterval(() => {
      const p = Math.min(100, Math.floor(((performance.now() - start) / S.checkMs) * 100))
      setPercent(p)
      if (p >= 100) {
        clearInterval(t)
        setDone(true)
      }
    }, 50)
    return () => clearInterval(t)
  }, [])

  useRemote(key => {
    if (key === 'Home') return false
    if (key === 'Exit') onExit('live')
    // Cancel is the only (focused) button; updatenow has exitmenu=1, so Settings stays closed
    else if (key === 'Enter' || key === 'Back') onExit('live')
    return true
  }, !done)

  if (done) {
    // FluxInfoPopup on its own (the searching window is gone; inferred)
    return <MessageBox message={S.noUpdate} buttons={[S.ok]} onClose={() => onExit('live')} />
  }

  return (
    <div className="swu" style={{ backgroundImage: `url(${TV}/support/i_img_bg_tile.webp)` }}>
      <div className="swu__column">
        <div className="swu__title">{S.title}</div>
        <div className="swu__text">{S.checking}</div>
        <Lottie className="swu__spinner" src={`${TV}/support/i_img_progresscircle_01_s.json`} playing loop />
        <div className="swu__progress">
          <span className="swu__track">
            <span className="swu__fill" style={{ width: `${percent}%` }} />
          </span>
          <span className="swu__percent">{`${percent}%`}</span>
        </div>
        <div className="flux-btn swu__button is-focused">{S.cancel}</div>
      </div>
    </div>
  )
}
