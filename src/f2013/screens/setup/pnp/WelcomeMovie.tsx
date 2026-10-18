import { useEffect, useRef } from 'react'
import { useRemote } from '../../../../input/remote'
import { F13 } from '../../../assets'
import { getTv } from '../../../tv/store'

// The welcome movie (/mtd_rocommon/WelcomePnP/Welcome_Movie_EU.mp4, 1920x1080, 25 fps, 17.56 s) played
// full screen before the first Plug & Play page. It ends on the wizard's blue, so the first page follows
// without a cut. No key skips it (no key handler is attached while it plays; keys are swallowed).
// Browsers refuse sound before a user gesture: the movie then plays muted.
export function WelcomeMovie({ onEnd }: { onEnd: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const done = useRef(onEnd)
  done.current = onEnd
  useRemote(() => true)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const s = getTv()
    v.volume = s.muted ? 0 : Math.min(1, s.volume / 100)
    v.play().catch(() => {
      v.muted = true
      v.play().catch(() => done.current())
    })
  }, [])

  return (
    <video
      ref={ref}
      className="pnp-movie"
      src={`${F13}/video/welcome_movie_eu.mp4`}
      playsInline
      onEnded={() => done.current()}
      onError={() => done.current()}
    />
  )
}
