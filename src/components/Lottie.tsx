import { useEffect, useRef } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'

// A Lottie icon as the TV's LottieView uses it: frame 0 is the idle (unfocused) look, and the
// focus animation plays a frame range once. `playing` switches between the two.
type Props = {
  src: string
  className?: string
  playing?: boolean
  range?: [number, number]
  loop?: boolean
}

export function Lottie({ src, className, playing = false, range, loop = false }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const anim = useRef<AnimationItem | null>(null)

  useEffect(() => {
    const a = lottie.loadAnimation({ container: host.current!, renderer: 'svg', loop, autoplay: false, path: src })
    anim.current = a
    return () => {
      a.destroy()
      anim.current = null
    }
  }, [src, loop])

  useEffect(() => {
    const a = anim.current
    if (!a) return
    const apply = () => {
      if (playing) a.playSegments(range ?? [0, a.totalFrames], true)
      else {
        a.resetSegments(true) // frame numbers are relative to the last played segment otherwise
        a.goToAndStop(0, true)
      }
    }
    if (a.isLoaded) apply()
    else a.addEventListener('DOMLoaded', apply)
    return () => {
      // the load effect's cleanup may already have destroyed this animation
      if (anim.current === a) a.removeEventListener('DOMLoaded', apply)
    }
  }, [playing, range, src])

  return <div ref={host} className={className} />
}
