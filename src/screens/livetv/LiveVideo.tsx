import { currentVideo, useTv } from '../../tv/store'

// The picture behind the Smart Hub: the current input's stand-in loop (public/video). Muted so the
// browser lets it autoplay. Playback is positioned on wall-clock time, as the Now Playing previews
// are, so going from a preview to full screen continues the same frame. Radio channels and inputs
// without a device have no picture.
export function LiveVideo() {
  const src = useTv(currentVideo)
  const on = useTv(s => s.power === 'on')
  if (!on || !src) return null
  return (
    <video
      key={src}
      className="live-video"
      src={`${import.meta.env.BASE_URL}video/${src}`}
      autoPlay
      muted
      loop
      playsInline
      onLoadedMetadata={e => {
        const v = e.currentTarget
        if (v.duration > 0) v.currentTime = (Date.now() / 1000) % v.duration
      }}
    />
  )
}
