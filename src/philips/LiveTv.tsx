import { VIDEO } from './assets'
import { currentVideo, useTv } from './store'

// The TV picture: the current channel's or input's stand-in video loop, black when there is none
// (radio, data services, unconnected inputs). Picture settings tint it, like the real set.
export function LiveTv() {
  const video = useTv(currentVideo)
  const power = useTv(s => s.power)
  const contrast = useTv(s => s.settings[25] ?? 90)
  const brightness = useTv(s => s.settings[26] ?? 48)
  const color = useTv(s => s.settings[27] ?? 52)

  if (power !== 'on') return <div className="ph-live ph-live--black" />
  if (!video) return <div className="ph-live ph-live--black" />

  // Map the menu sliders (0..100) to CSS filters, centred on the factory values.
  const filter = `contrast(${0.7 + contrast / 150}) brightness(${0.75 + brightness / 120}) saturate(${color / 52})`
  return (
    <video
      key={video}
      className="ph-live"
      style={{ filter }}
      src={`${VIDEO}${video}`}
      autoPlay
      muted
      loop
      playsInline
    />
  )
}
