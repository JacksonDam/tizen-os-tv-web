import { VIDEO } from './assets'
import { useTv } from './tv/store'
import { useDemo } from './ui/demo'
import { getProp } from './ui/env'
import { P } from './ui/props'
import { formatTransform } from './ui/options'
import { pictureVideo } from './ui/sources'

// The picture: the current channel's or input's stand-in loop. Radio services and inputs without a
// device have no picture; the shared lineup's HD services are taken as MPEG-4 AVC broadcasts, which
// this MPEG-2 set cannot decode (it shows "Unsupported video format", as in the Polish footage).
// Picture settings tint the loop like the menus' sliders would the panel.

export function useVideo(): string {
  return useTv(pictureVideo)
}

const demo0 = (d: ReturnType<typeof useDemo>) => d?.kind === 'pp' && !d.full

export function LiveTv() {
  const video = useVideo()
  const demoState = useDemo()
  const props = useTv(s => s.props)
  void props
  const contrast = getProp(P.contrast)
  const brightness = getProp(P.brightness)
  const colour = getProp(P.colour)
  if (!video) return <div className="ph-live" />
  // the sliders around the factory values (100 / 50 / 50) map to CSS filters (inferred)
  const filter = `contrast(${0.5 + contrast / 200}) brightness(${0.6 + brightness / 125}) saturate(${colour / 50})`
  const transform = formatTransform(getProp(P.pictureFormat))
  // Pixel Plus demo in split screen: the left half without Pixel Plus ("Off"), the right half with it
  // ("On") up to the line at x = 424 of 852; the processing difference is approximated by softening
  // and desaturating the left half (inferred: the stand-in loop carries no Pixel Plus processing)
  const demo = demo0(demoState)
  return (
    <>
      <video key={video} className="ph-live" style={{ filter, transform }} src={`${VIDEO}${video}`} autoPlay muted loop playsInline />
      {demo && <div className="ph-pp-off" />}
    </>
  )
}
