import { VIDEO } from './assets'
import { currentChannel, useTv } from './tv/store'
import { getProp } from './ui/env'
import { P } from './ui/props'
import { INPUTS } from './ui/sources'

// The picture: the current channel's or input's stand-in loop. Radio services and inputs without a
// device have no picture; the shared lineup's HD services are taken as MPEG-4 AVC broadcasts, which
// this MPEG-2 set cannot decode (it shows "Unsupported video format", as in the Polish footage).
// Picture settings tint the loop like the menus' sliders would the panel.

export function useVideo(): string {
  return useTv(s => {
    if (s.source !== 'TV') return INPUTS.find(i => i.id === s.source)?.video ?? ''
    const ch = currentChannel(s)
    if (!ch || ch.kind !== 'tv' || (ch.hd && !ch.analogue)) return ''
    return ch.video
  })
}

export function LiveTv() {
  const video = useVideo()
  const props = useTv(s => s.props)
  void props
  const contrast = getProp(P.contrast)
  const brightness = getProp(P.brightness)
  const colour = getProp(P.colour)
  if (!video) return <div className="ph-live" />
  // the sliders around the factory values (100 / 50 / 50) map to CSS filters (inferred)
  const filter = `contrast(${0.5 + contrast / 200}) brightness(${0.6 + brightness / 125}) saturate(${colour / 50})`
  return <video key={video} className="ph-live" style={{ filter }} src={`${VIDEO}${video}`} autoPlay muted loop playsInline />
}
