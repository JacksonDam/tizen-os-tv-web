import { VIDEO } from '../assets'
import { currentVideo, useTv } from '../tv/store'

// The TV picture: the current channel's or input's stand-in video loop, black when there is none
// (radio, data services, unconnected inputs). The no-signal and radio screens are drawn by the
// TV viewer module on top of this.
export function LiveTv() {
  const video = useTv(currentVideo)
  const power = useTv(s => s.power)
  if (power !== 'on' || !video) return <div className="f13-live f13-live--black" />
  return <video key={video} className="f13-live" src={`${VIDEO}${video}`} autoPlay muted loop playsInline />
}
