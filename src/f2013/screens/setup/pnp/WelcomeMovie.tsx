import { useEffect, useRef } from 'react'
import { useRemote } from '../../../../input/remote'
import { F13 } from '../../../assets'
import { tvGain } from '../../../tv/sound'
import { getTv, useTv } from '../../../tv/store'

// The welcome movie (CMMWelcomeApp, app 0xad: CMMWelcomePlayer::StartWelcomePlayer @03bd1d40 plays
// /mtd_rocommon/WelcomePnP/Welcome_Movie_EU.mp4 on an EU set, else Welcome_Movie.mp4; 1920x1080,
// 25 fps, 17.56 s) full screen before the first Plug & Play page. m_ProcessKeyEvent @03bd18d4 eats
// every key (volume stays with the system), so it cannot be skipped. At its end the player stops
// (Welcome_Movie2.mp4 is not in rocommon) and the Menu app starts PnP; the movie's last 2.5 s are the
// wizard's blue background, so the first page follows without a cut.
// Browsers refuse sound before a user gesture: the movie then starts muted and gets its sound on the
// first key press or click.
const MOVIE_MS = 17560


export function WelcomeMovie({ onEnd }: { onEnd: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const done = useRef(onEnd)
  done.current = onEnd
  useRemote(() => true)
  const volume = useTv(s => s.volume)
  const muted = useTv(s => s.muted)

  useEffect(() => {
    const v = ref.current
    if (v) v.volume = tvGain(volume, muted)
  }, [volume, muted])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const s = getTv()
    v.volume = tvGain(s.volume, s.muted)
    // the first gesture after a muted start turns the sound on
    const unmute = () => {
      if (!v.muted) return
      v.muted = false
      v.play().catch(() => {})
    }
    window.addEventListener('keydown', unmute)
    window.addEventListener('pointerdown', unmute)
    v.play().catch((e: DOMException) => {
      // no sound before a user gesture: play muted (AbortError = a second play() replaced this one)
      if (e.name !== 'NotAllowedError') return
      v.muted = true
      v.play().catch(() => {})
    })
    // if the browser cannot play it, the run still goes on after the movie's length
    const t = setTimeout(() => {
      if (v.paused && v.currentTime === 0) done.current()
    }, MOVIE_MS)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', unmute)
      window.removeEventListener('pointerdown', unmute)
    }
  }, [])

  return (
    <video
      ref={ref}
      className="pnp-movie"
      src={`${F13}/video/welcome_movie_eu.mp4`}
      playsInline
      onEnded={() => done.current()}
    />
  )
}
