import { useEffect } from 'react'
import { useRemote } from '../../../input/remote'
import { F13 } from '../../assets'
import { BOOT, bootOnLoad, useBootPhase } from './power'
import './setup.css'

// The boot loader's FastLogo on black, then black while exeDSP starts (power.ts).
//
// The images are drawn on the loader's 1280x720 frame buffer (file names *_1280x720), scaled x1.5 to
// the 1920x1080 stage. Both BMPs are stored top-down although their height is positive (converted
// flipped). Placement from the reference frames (sAmJMgr1va0 2.9 s and 4.5 s): logo A and the row of
// hexagons are both centred on the screen; the hexagons are the 66x76 cells 7, 3, 1, 2, 8 of
// FastLogoB (game pad, multi-screen, TV, play, photos: the same five on both TVs in the footage),
// 107 px apart (41 px gaps) at 1280 = 160.5 px on the stage.
const HEX_CELLS = [7, 3, 1, 2, 8]
const HEX_STEP = 107 * 1.5

let loaded = false

export function BootScreen() {
  const phase = useBootPhase()

  // the page load is a cold boot (once per page)
  useEffect(() => {
    if (loaded) return
    loaded = true
    bootOnLoad()
  }, [])

  // While the loader owns the screen and exeDSP is starting, the TV ignores keys (Power and the
  // system keys still reach power.ts / the volume handler first).
  const busy = phase === 'wait' || phase === 'logo' || phase === 'gap' || phase === 'hex' || phase === 'loading'
  useRemote(() => true, busy)

  if (phase === 'ready' || phase === 'off') return null
  // the loader's frames cover everything; the start-up black sits just above the TV picture so the
  // volume OSD can draw over it (HvCFIqTwsGQ t=13 s)
  const top = phase !== 'loading'
  return (
    <div className="boot" style={{ zIndex: top ? 10000 : 1 }}>
      {phase === 'logo' && (
        <img className="boot__logo" src={`${F13}/setup/boot/fastlogoa_1280x720.png`} alt="" />
      )}
      {phase === 'hex' && (
        <div className="boot__hexes" style={{ animationDuration: `${BOOT.hexMs}ms` }}>
          {HEX_CELLS.map((c, i) => (
            <div
              key={c}
              className="boot__hex"
              style={{
                left: (i - 2) * HEX_STEP - 49.5,
                backgroundPosition: `${-c * 99}px 0`,
                backgroundImage: `url(${F13}/setup/boot/fastlogob_1280x720.png)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
