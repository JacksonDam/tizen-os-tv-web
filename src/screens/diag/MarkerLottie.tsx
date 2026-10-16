import { useEffect, useRef } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'

// A Lottie driven by its named markers, as RemoteGuide's FrameImageBox.RangePlay(start, end, loopCount)
// does: plays from marker `range[0]` to marker `range[1]` (looping, or once then onDone), or holds
// `still` (a marker name or frame). Hidden while it has nothing to play (StopAndHide).

type Props = {
  src: string
  className?: string
  range?: [string, string] | null
  loop?: boolean
  still?: string | number
  onDone?: () => void
}

export function MarkerLottie({ src, className, range, loop = true, still, onDone }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const anim = useRef<AnimationItem | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const a = lottie.loadAnimation({ container: host.current!, renderer: 'svg', loop: false, autoplay: false, path: src })
    anim.current = a
    return () => {
      a.destroy()
      anim.current = null
    }
  }, [src])

  const key = range ? range.join('|') : `still:${still}`
  useEffect(() => {
    const a = anim.current
    if (!a) return
    // the raw markers: lottie-web parses "name:s" comments as key/value payloads, losing the name
    const markerFrame = (name: string) => {
      const raw = (a as unknown as { animationData?: { markers?: { cm: string; tm: number }[] } }).animationData?.markers
      return raw?.find(x => x.cm === name)?.tm
    }
    const onComplete = () => {
      if (!range) return
      if (loop) apply()
      else done.current?.()
    }
    const apply = () => {
      if (range) {
        const s = markerFrame(range[0])
        const e = markerFrame(range[1])
        if (s === undefined || e === undefined) return
        a.resetSegments(true)
        a.playSegments([s, e], true)
      } else {
        a.resetSegments(true)
        const f = typeof still === 'string' ? markerFrame(still) ?? 0 : still ?? 0
        a.goToAndStop(f, true)
      }
    }
    if (a.isLoaded) apply()
    else a.addEventListener('DOMLoaded', apply)
    a.addEventListener('complete', onComplete)
    return () => {
      if (anim.current !== a) return
      a.removeEventListener('DOMLoaded', apply)
      a.removeEventListener('complete', onComplete)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loop])

  return <div ref={host} className={className} style={range || still !== undefined ? undefined : { visibility: 'hidden' }} />
}
