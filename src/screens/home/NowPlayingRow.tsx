import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TV } from '../../assets'
import { programmeAt, type Channel } from '../../tv/channels'
import { currentChannel, currentSource, currentVideo, useTv } from '../../tv/store'
import { Marquee } from './Marquee'

// Row 3 with a live source and channels (spec2/device-sources-home.md C.2-C.5): group "Now Playing" (the
// picture behind Home, HomeVideoRecentPreview) and group "On Now" (channel tiles, HomeVideoPreview).

const COVER = `${TV}/newhome-app/home_i_icon_cover_recent_normal.webp`
const NO_SIGNAL_COVER = `${TV}/home-live/home_i_icon_cover_recent_nosignal.webp`
const THUMBS = [1, 2, 3, 4].map(n => `${TV}/home-live/home_i_icon_content_thumbnail_default_${n}.webp`)
const VIDEO = `${import.meta.env.BASE_URL}video/`

// List start x 184 (padding 14 u + 9 u); Now Playing 57 u, channel tiles 56 u (57 u while their preview
// plays), 5 u between items and between the groups.
const LIST_X = 184
const RECENT_W = 456
const CHANNEL_W = 448
const GAP = 40

// Auto-play timeline (C.4): PlayContent 1000 ms after focus, "signal ok" 200 ms later (mock); No Signal is
// declared after 2000 ms without a signal.
const AUTOPLAY_MS = 1000
const SIGNAL_MS = 200
const NO_SIGNAL_MS = 2000

// Programme info on the broadcast "On Now" tiles (mock): the firmware leaves programme name and times empty
// for broadcast channels (C.4, C.5); here the mock EPG (programmeAt) fills the description line and the
// playing tile's info layer like a TV Plus tile. false = firmware behaviour.
const PROGRAMME_INFO = true

type Media = { video: string; audioOnly: boolean }  // video '' = no picture

type Props = {
  onNow: Channel[]     // "On Now": the first channels of the service list
  item: number         // row focus: 0 = Now Playing, 1.. = channel tiles
  current: boolean     // the row has the page focus (kept while focus is in the sidebar)
  focused: boolean     // a tile of the row has the remote focus
  playItem: number     // the tile that auto-plays (-1: none)
  playKey: string      // changes with every focus change that (re)starts auto-play
  sound: boolean       // Media Options > Autoplay Sound
}

export function NowPlayingRow({ onNow, item, current, focused, playItem, playKey, sound }: Props) {
  // Now Playing shows the source name only (eden.pig_autoplay_support): "Live TV" or the device (C.3).
  const liveTitle = useTv(s => (s.source === 'TV' ? 'Live TV' : (currentSource(s).device ?? currentSource(s).title)))
  const liveVideo = useTv(currentVideo)
  const liveAudioOnly = useTv(s => s.source === 'TV' && currentChannel(s)?.kind === 'radio')

  const media = (i: number): Media => {
    if (i === 0) return { video: liveVideo, audioOnly: liveAudioOnly }
    const ch = onNow[i - 1]
    return { video: ch?.kind === 'tv' ? ch.video : '', audioOnly: ch?.kind === 'radio' }
  }

  // PrePlay at focus, then Play ("live"): restarts whenever the focus or the tile's content changes.
  const target = playItem >= 0 ? media(playItem) : null
  const key = `${playKey}|${target?.video}|${target?.audioOnly}`
  const [prevKey, setPrevKey] = useState(key)
  const [live, setLive] = useState(false)
  if (prevKey !== key) {
    setPrevKey(key)
    setLive(false)
  }
  const delay = AUTOPLAY_MS + (target && !target.video && !target.audioOnly ? NO_SIGNAL_MS : SIGNAL_MS)
  useEffect(() => {
    if (playItem < 0) return
    const t = setTimeout(() => setLive(true), delay)
    return () => clearTimeout(t)
  }, [key, delay, playItem])

  // A playing channel preview widens its slot to 57 u; the following tiles move right by 8 px (C.2).
  const morphItem = live && target?.video && playItem > 0 ? playItem : -1
  const widths = [RECENT_W, ...onNow.map((_, k) => (k + 1 === morphItem ? RECENT_W : CHANNEL_W))]
  const starts = [0]
  for (const w of widths) starts.push(starts[starts.length - 1] + w + GAP)
  // layer_focus_type fixed: the focused item is scrolled to the list start.
  const scroll = -(starts[item] ?? 0)

  const group = item === 0 ? 0 : 1
  const titleCls = (g: number) =>
    `group-title np-gtitle ${current && group === g ? 'is-current' : ''} ${focused && group === g ? 'is-focused' : ''}`
  const focusedChannel = item > 0 ? onNow[item - 1] : undefined
  const description = item === 0 ? liveTitle : PROGRAMME_INFO && focusedChannel ? programmeAt(focusedChannel).title : ''

  const tile = (i: number, width: number, cover: string, text: ReactNode, info?: ReactNode) => (
    <Tile
      key={i}
      kind={i === 0 ? 'recent' : 'channel'}
      x={starts[i]}
      width={width}
      cover={cover}
      current={current && item === i}
      focused={focused && item === i}
      active={playItem === i}
      live={playItem === i && live}
      media={media(i)}
      sound={sound}
      text={text}
      info={info}
    />
  )

  return (
    <>
      {/* Group titles are sticky at the list start; "Now Playing" fades out once its tile has scrolled away. */}
      <div className={`${titleCls(0)} ${item > 0 ? 'is-away' : ''}`}>Now Playing</div>
      {onNow.length > 0 && (
        <div className={titleCls(1)} style={{ left: LIST_X + Math.max(0, starts[1] + scroll) }}>On Now</div>
      )}

      {/* The list clips only at its own left edge (x 112): a sliver of the previous tile stays visible. */}
      <div className="np-clip">
        <div className={`np-track ${morphItem > 0 ? 'is-morphing' : ''}`} style={{ transform: `translateX(${scroll}px)` }}>
          {tile(0, RECENT_W, COVER, <div className="np-title">{liveTitle}</div>)}
          {onNow.map((ch, k) =>
            tile(
              k + 1,
              widths[k + 1],
              THUMBS[k % THUMBS.length],
              <div className="ch-text">
                <Marquee className="ch-name" text={ch.name} run={focused && item === k + 1} />
                <div className="ch-num">{ch.number}</div>
              </div>,
              PROGRAMME_INFO ? <ProgrammeInfo channel={ch} /> : <div className="pig__dim" />,
            ),
          )}
        </div>
      </div>

      <div className={`np-desc ${current ? 'is-shown' : ''}`}>{description}</div>
    </>
  )
}

type TileProps = {
  kind: 'recent' | 'channel'
  x: number
  width: number
  cover: string
  current: boolean     // 1.1x
  focused: boolean     // ring + shadow
  active: boolean      // auto-play target: PrePlay (video loading under the cover) and Play
  live: boolean        // playing, or the error state declared
  media: Media
  sound: boolean
  text: ReactNode      // shown while not playing
  info?: ReactNode     // channel tiles: info layer while playing
}

function Tile({ kind, x, width, cover, current, focused, active, live, media, sound, text, info }: TileProps) {
  const error = live && !media.video ? (media.audioOnly ? 'Audio Channel' : 'No Signal') : ''
  const playing = live && !!media.video
  return (
    <div
      className={`np-card ${kind === 'channel' ? 'ch-card' : ''} ${current ? 'is-current' : ''} ${focused ? 'is-focused' : ''}`}
      style={{ left: LIST_X + x, width }}
    >
      {active && media.video && <Preview key={media.video} src={VIDEO + media.video} play={playing} sound={sound} />}
      <img className={`pig__cover ${playing ? 'is-faded' : ''}`} src={error ? NO_SIGNAL_COVER : cover} alt="" />
      {!live && text}
      {error && <div className="pig__error">{error}</div>}
      {playing && info && <div className="pig__info">{info}</div>}
      <div className="flux-focus-ring" />
    </div>
  )
}

// The stand-in loop for the tile's source. Sound follows Autoplay Sound (and the TV's mute and volume);
// without a user gesture the browser only allows it muted.
function Preview({ src, play, sound }: { src: string; play: boolean; sound: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const tvMuted = useTv(s => s.muted)
  const volume = useTv(s => s.volume)
  const muted = !sound || tvMuted

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = muted
    v.volume = Math.min(1, volume / 100)
  }, [muted, volume])

  useEffect(() => {
    const v = ref.current
    if (!v || !play) return
    if (v.readyState >= 1) seekLive(v)
    v.play().catch(() => {
      v.muted = true
      v.play().catch(() => {})
    })
    return () => v.pause()
  }, [play])

  return (
    <video
      ref={ref}
      className="pig__video"
      src={src}
      loop
      muted
      playsInline
      preload="auto"
      onLoadedMetadata={e => seekLive(e.currentTarget)}
    />
  )
}

// Live sources do not restart: follow the full-screen picture when it is the same loop, else wall-clock time.
function seekLive(v: HTMLVideoElement) {
  const tv = document.querySelector<HTMLVideoElement>('video.live-video')
  if (tv && tv.currentSrc === v.currentSrc) v.currentTime = tv.currentTime
  else if (v.duration) v.currentTime = (Date.now() / 1000) % v.duration
}

// Info layer of a playing channel tile (C.4): dim band, remaining time and progress, refreshed every 10 s.
function ProgrammeInfo({ channel }: { channel: Channel }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])
  const p = programmeAt(channel, now)
  const span = p.end.getTime() - p.start.getTime()
  const left = Math.max(1, Math.ceil((p.end.getTime() - now.getTime()) / 60000))
  const text = left >= 60 ? `${Math.floor(left / 60)} hr ${left % 60} min left` : `${left} min left`
  return (
    <>
      <div className="pig__dim" />
      <div className="pig__left">{text}</div>
      <div className="pig__bar">
        <div style={{ width: `${(100 * (now.getTime() - p.start.getTime())) / span}%` }} />
      </div>
    </>
  )
}
