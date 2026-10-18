import { useEffect, useRef, useState } from 'react'
import { useRemote } from '../../../input/remote'
import { stubArt, STUB_USB, type StubClip } from '../../../shared/fictional'
import { VIDEO } from '../../assets'
import { openApp, registerApp, type AppProps } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { ColorTag } from './ColorTag'
import { IMG, MULTIMEDIA, ONTV } from './data'

// Photos, Videos & Music (exeDSP application 0x2d, CMMBrowserApp / CMMPlayApp), opened from the Smart
// Hub sub menu (All Content 6, Photos 3, Videos 2, Music 4, Recorded TV 5: CHomeExecutor
// m_GetSubMenuItemEnum) or straight into the player from a Most Popular item. The browser is the
// "GoldenBridge" content view (CMMContentViewBase): it runs on a 1280 x 720 OSD
// (CMMBOSDInfo::t_Init1280x720 @03888f78 is its only layout), so every value below is that OSD's x 1.5.
// The player has its own 1920 x 1080 layout (CAceMPOSDInfo::t_InitWProPlayerTV1920x1080 @03adb164).
//
// Content: the stub USB stick (STUB_USB): photos as generated artwork, videos as the stand-in loops, no
// music and no recordings (each view then shows the firmware's empty-device text).

export type MMCategory = 'all' | 'photos' | 'videos' | 'music' | 'recorded'
export type MMParams = { category?: MMCategory; from?: number; play?: StubClip; list?: StubClip[] }

const S = 1.5 // CMMBOSDInfo 1280 x 720 -> stage
const MM = `${IMG}/mm`

type Item = { id: string; title: string; kind: 'photo' | 'video'; video?: string; seconds?: number; date?: string }

const USB_PHOTOS: Item[] = STUB_USB.photos.map(p => ({ id: p.id, title: p.title, kind: 'photo', date: p.date }))
const USB_VIDEOS: Item[] = STUB_USB.videos.map(v => ({ id: v.id, title: v.title, kind: 'video', video: v.file, seconds: v.seconds }))

// Category titles: g_HomePanelWStringEng (the colour tag carries the sub menu item's text) and the
// empty-device texts from g_MMWStringEng 791, 800, 891 (CMMContentViewBase::t_CreateNoFileText @0397ff0c).
const CATEGORY: Record<MMCategory, { label: string; empty: string; items: Item[] }> = {
  all: { label: 'All Content', empty: 'There is no device connected.', items: [...USB_PHOTOS, ...USB_VIDEOS] },
  photos: { label: 'Photos', empty: 'No photos found on the connected device.', items: USB_PHOTOS },
  videos: { label: 'Videos', empty: 'No videos.', items: USB_VIDEOS },
  music: { label: 'Music', empty: 'No music files found on the connected device.', items: [] },
  recorded: { label: 'Recorded TV', empty: 'No Recorded files found on the connected device.', items: [] },
}

// Grid geometry per view (CMMBOSDInfo): photos MM_GB_CONTENT_PHOTO_LIST_* 147 x 147 items, 3 rows, the
// list centred at y 394, 554 high (CMMPhotoBrowserView::t_CreateList @038a3624: CMMGridLayoutList 3 x 10,
// SetFocusableLayoutRange(1, 8), focused item +28); videos MM_GB_CONTENT_VIDEO_LIST_* 220 x 196, 2 rows,
// centred at y 360, 410 high, columns 1-5. Where the columns sit was not traced: here they fill the width
// right of the colour tag (MM_GB_COLOR_TAG_BG_W 266) so the level-2 tag stays clear (inferred), rows
// packed around the list centre with GAP_Y between them (inferred).
type Grid = { w: number; h: number; rows: number; cols: number; cy: number; enlarge: number; gapY: number }
const TAG_W = 266
const PHOTO_GRID: Grid = { w: 147, h: 147, rows: 3, cols: 6, cy: 394, enlarge: 28, gapY: 6 }
const VIDEO_GRID: Grid = { w: 220, h: 196, rows: 2, cols: 4, cy: 360, enlarge: 28, gapY: 12 }

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
}

function toItem(c: StubClip): Item {
  return { id: c.id, title: c.title, kind: c.kind, video: c.video, seconds: c.kind === 'video' ? 30 : undefined }
}

export function MMBrowser({ params, close }: AppProps) {
  const p = (params ?? {}) as MMParams
  const from = p.from ?? MULTIMEDIA
  const direct = !!p.play
  const category: MMCategory = p.category ?? 'all'
  const [device, setDevice] = useState(category !== 'all') // All Content starts at the device list
  const [focus, setFocus] = useState(0)
  const [player, setPlayer] = useState<{ list: Item[]; index: number } | null>(() => {
    if (!p.play) return null
    const list = (p.list ?? [p.play]).map(toItem)
    return { list, index: Math.max(0, list.findIndex(i => i.id === p.play!.id)) }
  })

  const cat = CATEGORY[category]
  const items = cat.items
  const grid = category === 'videos' || category === 'recorded' ? VIDEO_GRID : PHOTO_GRID
  const perPage = grid.rows * grid.cols
  const page = Math.floor(focus / perPage)
  const pages = Math.max(1, Math.ceil(items.length / perPage))

  // back to Smart Hub on the panel the item came from (the hub reopens there, ./panels.ts contract)
  const toHub = () => openApp('smarthub', { panel: from })

  useRemote(key => {
    if (player) return false
    switch (key) {
      case 'Back':
        playUi(UI_SOUND.BACK)
        if (category === 'all' && device) setDevice(false)
        else toHub()
        return true
      case 'Exit':
        close()
        return true
      case 'Left':
      case 'Right':
      case 'Up':
      case 'Down': {
        if (!device || !items.length) {
          if (!device && key !== 'Up' && key !== 'Down') playUi(UI_SOUND.NOKEY)
          return true
        }
        const c = focus % grid.cols, r = Math.floor((focus % perPage) / grid.cols)
        let j = focus
        if (key === 'Left') j = c > 0 ? focus - 1 : page > 0 ? focus - perPage + grid.cols - 1 : focus
        if (key === 'Right') j = c < grid.cols - 1 ? focus + 1 : focus + perPage - grid.cols + 1
        if (key === 'Up') j = r > 0 ? focus - grid.cols : focus
        if (key === 'Down') j = r < grid.rows - 1 ? focus + grid.cols : focus
        if (j === focus || j < 0 || j >= items.length) {
          playUi(UI_SOUND.NOKEY)
          return true
        }
        playUi(UI_SOUND.MOVE)
        setFocus(j)
        return true
      }
      case 'Enter':
        playUi(UI_SOUND.SELECT)
        if (!device) {
          setDevice(true)
          setFocus(0)
        } else if (items[focus]) setPlayer({ list: items, index: focus })
        return true
      default:
        return false
    }
  })

  if (player) {
    const it = player.list[player.index]
    const leave = () => {
      if (direct) toHub()
      else setPlayer(null)
    }
    return it.kind === 'video'
      ? <VideoPlayer key={it.id} list={player.list} index={player.index} onIndex={i => setPlayer({ ...player, index: i })} onReturn={leave} onExit={close} />
      : <PhotoPlayer key="photo" list={player.list} index={player.index} onIndex={i => setPlayer({ ...player, index: i })} onReturn={leave} onExit={close} />
  }

  const shown = items.slice(page * perPage, page * perPage + perPage)
  const pitchX = (1280 - TAG_W) / grid.cols
  const pitchY = grid.h + grid.gapY
  const top = grid.cy - (grid.rows * pitchY - grid.gapY) / 2
  const cellX = (c: number) => (TAG_W + c * pitchX + (pitchX - grid.w) / 2) * S
  const cellY = (r: number) => (top + r * pitchY) * S
  const fi = focus - page * perPage
  const fit = items[focus]
  return (
    <div className="mmb">
      {/* GoldenBridge/bg/allshare_bg.png, 1280 x 720 */}
      <img className="mmb__bg" src={`${MM}/allshare_bg.png`} alt="" />
      <ColorTag label={cat.label} panel={from === ONTV ? ONTV : MULTIMEDIA} />
      {/* top bar (MM_TOP_BAR_Y 9, H 60): the device, the page at MM_TOP_BAR_PAGE_RIGHT_X 1253 (right) */}
      {device && items.length ? (
        <>
          <div className="mmb__top" style={{ left: 420, top: 9 * S, height: 60 * S }}>{STUB_USB.name}</div>
          <div className="mmb__page" style={{ right: (1280 - 1253) * S, top: 9 * S, height: 60 * S }}>{page + 1}/{pages}</div>
        </>
      ) : null}

      {!device ? (
        // All Content: the device list (CMMAllDeviceView); the USB stick is the one device
        <div className="mmb__device" style={{ left: 960 - 145 * S / 1.5, top: 300 }}>
          <img src={`${MM}/thumb_usb_hdd.png`} alt="" style={{ width: 290, height: 290 }} />
          <div>{STUB_USB.name}</div>
          <i className="mmb__dev-focus" style={{ borderImageSource: `url("${MM}/thumb_high_focus.png")` }} />
        </div>
      ) : !items.length ? (
        // the empty-device text: MMB_MUSIC_VIEW_NO_FILE_TEXT_FONTSIZE 26, white, centred (inferred box)
        <div className="mmb__empty" style={{ top: 330 * S, fontSize: 26 * S }}>{cat.empty}</div>
      ) : (
        <>
          {shown.map((it, k) => {
            const c = k % grid.cols, r = Math.floor(k / grid.cols)
            const f = k === fi
            const e = f ? (grid.enlarge * S) / 2 : 0
            return (
              <div key={it.id} className="mmb__cell" style={{ left: cellX(c) - e, top: cellY(r) - e, width: grid.w * S + e * 2, height: grid.h * S + e * 2, zIndex: f ? 2 : 1 }}>
                <img src={it.kind === 'photo' ? stubArt(it.id, 400, 400, { label: false }) : stubArt(it.id, 440, 300, { label: false })} alt="" />
                {it.kind === 'video' ? <span className="mmb__dur">{fmtTime(it.seconds ?? 0)}</span> : null}
                <div className="mmb__title" style={{ fontSize: (it.kind === 'photo' ? 20 : 18) * S }}>{it.title}</div>
                {f ? <i className="mmb__focus" style={{ borderImageSource: `url("${MM}/thumb_high_focus.png")` }} /> : null}
              </div>
            )
          })}
          {/* page arrows: arrow_left_n / arrow_right_n at MM_GB_PAGE_LEFT/RIGHT_ARROW_X -572 / 539 from the list centre */}
          {page > 0 ? <img className="mmb__arrow" src={`${MM}/arrow_left_n.png`} alt="" style={{ left: (640 - 572) * S, top: grid.cy * S - 29 * S }} /> : null}
          {page < pages - 1 ? <img className="mmb__arrow" src={`${MM}/arrow_right_n.png`} alt="" style={{ left: (640 + 539) * S, top: grid.cy * S - 29 * S }} /> : null}
          {/* the focused file's info bar: MM_GB_PHOTO_INFO_BAR (0, 634) 1280 x 86 / MM_GB_VIDEO_INFO_BAR (0, 558) 1280 x 162,
              title at (42, 0 / 24) size 34, details size 24 */}
          {fit ? (
            <div className="mmb__info" style={{ top: (fit.kind === 'photo' ? 634 : 558) * S }}>
              <div style={{ fontSize: 34 * S, top: (fit.kind === 'photo' ? 0 : 24) * S }}>{fit.title}</div>
              <div style={{ fontSize: 24 * S, top: (fit.kind === 'photo' ? 46 : 76) * S, opacity: 0.6 }}>
                {fit.kind === 'photo' ? fit.date : fmtTime(fit.seconds ?? 0)}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

// ---- video player (CMMPlayerUIVideo, CMMVideoPlayerInfoBanner::t_InitLayout @03af6684) ----
// The info banner (0, 0) 1920 x 180 on GoldenBridge/player/bg_player_upper.png: the play state icon
// (84, 28) 32 x 30, the repeat mode (196, 28) 36 x 34 (rec_no_repeat), the play time (285, 27) 180 x 40,
// the progress bar (426, 13) 1085 x 69 (pb_progress_bg / bar / handle), the total time (1512, 27), the
// title index "1 / 4" (1610, 27) 228 x 40, the file name (84, 117) 1752 x 40; texts size 38. It shows on
// start and on keys, and hides after a few seconds (inferred 5 s).
function VideoPlayer({ list, index, onIndex, onReturn, onExit }: {
  list: Item[]; index: number; onIndex: (i: number) => void; onReturn: () => void; onExit: () => void
}) {
  const it = list[index]
  const ref = useRef<HTMLVideoElement>(null)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(it.seconds ?? 0)
  const [paused, setPaused] = useState(false)
  const [banner, setBanner] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const poke = () => {
    setBanner(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setBanner(false), 5000)
  }
  useEffect(() => {
    poke()
    return () => clearTimeout(hideTimer.current)
  }, [])

  useRemote(key => {
    const v = ref.current
    switch (key) {
      case 'Back':
        playUi(UI_SOUND.BACK)
        onReturn()
        return true
      case 'Exit':
        onExit()
        return true
      case 'Enter':
      case 'PlayPause':
        if (v) {
          if (v.paused) void v.play()
          else v.pause()
          setPaused(v.paused)
        }
        poke()
        return true
      case 'Left':
      case 'Right':
        // 10 s back / forward (inferred step)
        if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (key === 'Left' ? -10 : 10)))
        poke()
        return true
      case 'ChannelUp':
      case 'ChannelDown': {
        // previous / next file in the list (inferred keys)
        const j = index + (key === 'ChannelUp' ? 1 : -1)
        if (j >= 0 && j < list.length && list[j].kind === 'video') onIndex(j)
        return true
      }
      case 'Up':
      case 'Down':
      case 'Info':
        poke()
        return true
      default:
        return false
    }
  })

  const frac = dur ? Math.min(1, t / dur) : 0
  return (
    <div className="mmv">
      <video
        ref={ref}
        src={`${VIDEO}${it.video}`}
        autoPlay
        muted
        playsInline
        onTimeUpdate={e => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDur(e.currentTarget.duration)}
        onEnded={() => {
          const j = index + 1
          if (j < list.length && list[j].kind === 'video') onIndex(j)
          else onReturn()
        }}
      />
      <div className="mmv__banner" style={{ opacity: banner ? 1 : 0 }}>
        <img className="mmv__bg" src={`${MM}/bg_player_upper.png`} alt="" />
        <img src={`${MM}/${paused ? 'pause_37_32.png' : 'play_phase_icon_play.png'}`} alt="" style={{ left: 84, top: 28, width: 32, height: 30 }} />
        <img src={`${MM}/rec_no_repeat.png`} alt="" style={{ left: 196, top: 28, width: 36 * 61 / 32, height: 34 }} />
        <div className="mmv__t" style={{ left: 285, top: 27, width: 180 }}>{fmtTime(t)}</div>
        <div className="mmv__prog" style={{ left: 426, top: 13 + (69 - 12) / 2, width: 1085, backgroundImage: `url("${MM}/pb_progress_bg.png")` }}>
          <i style={{ width: `${frac * 100}%`, backgroundImage: `url("${MM}/pb_progress_bar.png")` }} />
          <img src={`${MM}/pb_progress_handle.png`} alt="" style={{ left: `calc(${frac * 100}% - 19px)` }} />
        </div>
        <div className="mmv__t" style={{ left: 1512, top: 27, width: 180 }}>{fmtTime(dur)}</div>
        <div className="mmv__t" style={{ left: 1610, top: 27, width: 228, textAlign: 'right' }}>{index + 1} / {list.length}</div>
        <div className="mmv__t" style={{ left: 84, top: 117, width: 1752 }}>{it.title}</div>
      </div>
    </div>
  )
}

// ---- photo player (CMMPlayerUIPhoto, CMMPhotoPlayerInfoBanner::t_Create @03b321e0) ----
// Full-screen picture; the banner on Player/photo_play_top_bg.png across the top: date (120, 20) 348 x 42,
// resolution centred at 616, file name centred at 816, the device (1338, 20) 224 x 46, size 36, and the
// play status icon (1800, 20) 36 x 36. Left / Right step through the folder's photos (inferred keys).
function PhotoPlayer({ list, index, onIndex, onReturn, onExit }: {
  list: Item[]; index: number; onIndex: (i: number) => void; onReturn: () => void; onExit: () => void
}) {
  const photos = list.map((x, i) => ({ x, i })).filter(o => o.x.kind === 'photo')
  const it = list[index]
  const [banner, setBanner] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const poke = () => {
    setBanner(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setBanner(false), 5000)
  }
  useEffect(() => {
    poke()
    return () => clearTimeout(hideTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useRemote(key => {
    const k = photos.findIndex(o => o.i === index)
    switch (key) {
      case 'Back':
        playUi(UI_SOUND.BACK)
        onReturn()
        return true
      case 'Exit':
        onExit()
        return true
      case 'Left':
      case 'Right': {
        const j = k + (key === 'Left' ? -1 : 1)
        if (j >= 0 && j < photos.length) onIndex(photos[j].i)
        else playUi(UI_SOUND.NOKEY)
        return true
      }
      case 'Enter':
      case 'Up':
      case 'Down':
      case 'Info':
        poke()
        return true
      default:
        return false
    }
  })

  return (
    <div className="mmv">
      <img className="mmv__photo" src={stubArt(it.id, 1920, 1080, { label: false })} alt="" />
      <div className="mmv__pbanner" style={{ opacity: banner ? 1 : 0, backgroundImage: `url("${MM}/photo_play_top_bg.png")` }}>
        <div className="mmv__pt" style={{ left: 120, width: 348 }}>{it.date ?? ''}</div>
        <div className="mmv__pt" style={{ left: 616 - 120, width: 240, textAlign: 'center' }}>1920 x 1080</div>
        <div className="mmv__pt" style={{ left: 816 - 174, width: 348, textAlign: 'center' }}>{it.title}</div>
        <div className="mmv__pt" style={{ left: 1338, width: 224 }}>USB</div>
        <div className="mmv__pt" style={{ left: 1600, width: 180, textAlign: 'right' }}>{photos.findIndex(o => o.i === index) + 1} / {photos.length}</div>
      </div>
    </div>
  )
}

registerApp({ id: 'mmbrowser', component: MMBrowser, z: 210 })
