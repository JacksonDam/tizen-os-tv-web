import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRemote } from '../../../input/remote'
import { programmeAt, nextProgramme, type Channel, type GuideProgramme } from '../../../tv/channels'
import { VIDEO } from '../../assets'
import { closeApp } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { currentChannel, currentSource, currentVideo, getTv, tuneChannel, useTv } from '../../tv/store'
import { hhmm, IMG, ONTV } from './data'
import { FLIP, FlipItem, useFlip, type FlipTable } from './flip'
import { Glow, TextBox } from './kit'
import { registerOnlinePanel, type OnlinePanelProps } from './panels'

// On TV (CHomeSmartLivePanel, ETableListType 1) online: a 3 x 6 table (m_InitializeTableInfo @02bd88b4,
// CHomeOSDInfo GBHOME_SMARTLIVE_*): at GBHOME_SMARTLIVE_MAIN_GRID_POS (152, 162), columns 246 wide 30
// apart, rows 240 high with 30 then 62 between them; 13 items:
//   0      the live picture (CCVideoObject 798 x 454 over columns 0-2, rows 0-1), caption below
//   1-6    recommended programmes on now (columns 3-5, rows 0-1), 246 x 184 with a progress bar
//   7-12   "Coming Up" (row 2), 246 x 184 with the minutes to their start
// The server's recommendation engine (CHomeFreesiaInfo, S Recommendation) picks the programmes from the
// TV's programme guide; with no server thumbnails each item draws the firmware's no-thumbnail look. Here
// the picks come from the tuner's EPG (src/tv/channels.ts): the channels after the one being watched
// (inferred order), the next programmes soonest first.

const X0 = 152, Y0 = 162            // GBHOME_SMARTLIVE_MAIN_GRID_POS_X/Y
const COL = 246, GAP = 30           // GBHOME_SMARTLIVE_MAIN_GRID_DATA_WIDTH_0, CELL_SPACING_1
const ROWS = [Y0, Y0 + 240 + 30, Y0 + 240 + 30 + 240 + 62]   // DATA_HEIGHT_0 240, CELL_SPACING_2/3 30/62
const colX = (c: number) => X0 + (COL + GAP) * c
const VIDEO_W = 798, VIDEO_H = 454  // GBHOME_SMARTLIVE_VIDEO_W/H (= AIR_ITEM_CONTENT_IMG 798 x 448 + 6)
const THUMB_H = 184                 // GBHOME_SMARTLIVE_*_ITEM_CONTENT_IMG_HEIGHT
const TEXT_Y0 = 468, TEXT_H0 = 36   // GBHOME_SMARTLIVE_MAIN_GRID_FOCUSED_TEXT_POSY_0 / HEIGHT_0
const TEXT_Y1 = 198, TEXT_H1 = 38   // ..._POSY_1 / HEIGHT_1
const BOX_H0 = 58, BOX_H1 = 96      // GBHOME_SMARTLIVE_ITEM_TEXTBOX_HEIGHT_0/1
const GLOW_DX = -28, GLOW_DY = -31  // GBHOME_SMARTLIVE_MAIN_GRID_FOCUS_IMAGE_X/Y_OFFSET
const ENLARGE_W = 12, ENLARGE_H = 11 // GBHOME_SMARTLIVE_MAIN_GRID_DATA_ENLARGED_WIDTH/HEIGHT_DIFF_1
const UPCOMING_W = 90, UPCOMING_GAP = 8 // GBHOME_SMARTLIVE_MAIN_GRID_UPCOMING_TIME_TEXT_WIDTH, ..._AND_CHANEL_LOGO_GAP
const TITLE_BLUE = 'rgba(2, 141, 229, 0.8)' // 0xff028de5 at GBHOME_SMARTLIVE_TITLE_OPACITY 0.8
// The On TV service the TV was set up with (CHomeFreesiaInfo::GetProviderSourceName /
// GetCurrentProviderName, chosen in Smart Hub setup from the server's provider list). A set fed by an
// aerial: the input "TV" and the PnP Channel Source name "Aerial" (setup string 0x74d) (inferred).
const TV_PROVIDER = { source: 'TV', name: 'Aerial' }

type Pick = { chIndex: number; ch: Channel; prog: GuideProgramme }

// the item flip (flip.tsx): the table's 3 x 6 cells; the picture covers cells 0-2 and 6-8
const FLIP_TABLE: FlipTable = {
  layout: FLIP.onTv,
  rect: k => ({ x: colX(k % 6), y: ROWS[Math.floor(k / 6)], w: COL, h: 240 }),
  merged: [[0, 1, 2, 6, 7, 8]],
}
// The picture the pieces of item 0 carry: CCTableLayoutListControl::m_SeparateForLayoutAni renders the
// item, live picture included, into one image before t_OnBeginMinimizeWindow hides the video object, so
// the pieces show the frame of that moment; it stays theirs for the way back (layout 1 -> 0 cuts nothing).
let still: string | null = null

// The table position of each item (column, row) for key moves; item 0 covers columns 0-2, rows 0-1.
function cellOf(i: number): { c: number; r: number } {
  if (i === 0) return { c: 0, r: 0 }
  if (i <= 6) return { c: 3 + ((i - 1) % 3), r: Math.floor((i - 1) / 3) }
  return { c: i - 7, r: 2 }
}
function itemAt(c: number, r: number): number {
  if (r === 2) return 7 + c
  if (c <= 2) return 0
  return 1 + r * 3 + (c - 3)
}

// CCTableLayoutListControl moves: to the neighbouring cell; from the picture right goes to the top
// recommended item and down to the first Coming Up item (inferred from the table geometry).
function step(i: number, key: 'Up' | 'Down' | 'Left' | 'Right'): number | null {
  const { c, r } = cellOf(i)
  if (i === 0) {
    if (key === 'Right') return 1
    if (key === 'Down') return 7
    return null
  }
  if (key === 'Left') return c === 0 ? null : itemAt(c - 1, r)
  if (key === 'Right') return c === 5 ? null : itemAt(c + 1, r)
  if (key === 'Up') return r === 0 ? null : itemAt(c, r - 1)
  return r === 2 ? null : itemAt(c, r + 1)
}

function picks(now: Date): { rec: Pick[]; next: Pick[] } {
  const s = getTv()
  const tv = s.channels.map((ch, chIndex) => ({ ch, chIndex })).filter(x => x.ch.kind === 'tv')
  const start = Math.max(0, tv.findIndex(x => x.chIndex === s.channel))
  const order = tv.slice(start + 1).concat(tv.slice(0, start + 1))
  const rec = order.slice(0, 6).map(x => ({ ...x, prog: programmeAt(x.ch, now) }))
  const next = order
    .map(x => ({ ...x, prog: nextProgramme(x.ch, now) }))
    .sort((a, b) => a.prog.start.getTime() - b.prog.start.getTime() || a.ch.number - b.ch.number)
    .slice(0, 6)
  return { rec, next }
}

export function OnTvPanel({ active, exitUp, exitDown, launch }: OnlinePanelProps) {
  const [now, setNow] = useState(() => new Date())
  // CHomeSmartLivePanel::CallbackCurrentTimeText: a 10 s alarm refreshes the clock text
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])
  const tuneSeq = useTv(s => s.tuneSeq + s.switchSeq * 1000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { rec, next } = useMemo(() => picks(now), [now.getMinutes(), tuneSeq])
  const video = useTv(currentVideo)
  const [focus, setFocus] = useState(0)
  // the live picture goes as the minimize motion starts and comes back when Smart Hub has come back
  // (CHomeSmartLivePanel::t_OnBeginMinimizeWindow @02bd9ca4 hides the video object +0x1d84 and turns the
  // video off; t_OnEndNormalizeWindow @02bd9a10 shows it again); meanwhile the pieces carry the still
  const flip = useFlip()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [frame, setFrame] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (flip?.dir !== 'out') return
    const v = videoRef.current
    still = null
    if (v && v.videoWidth) {
      const c = document.createElement('canvas')
      c.width = VIDEO_W
      c.height = VIDEO_H
      c.getContext('2d')?.drawImage(v, 0, 0, VIDEO_W, VIDEO_H)
      still = c.toDataURL('image/jpeg', 0.9)
    }
    setFrame(still)
  }, [flip?.dir])
  const pigStill = flip ? (flip.dir === 'out' ? frame : still) : null

  const run = (fn: () => void) => (launch ? launch(fn) : fn())

  useRemote(key => {
    switch (key) {
      case 'Up':
      case 'Down':
      case 'Left':
      case 'Right': {
        const j = step(focus, key)
        if (j === null) {
          if (key === 'Up') exitUp()
          else if (key === 'Down') (exitDown ?? (() => playUi(UI_SOUND.NOKEY)))()
          else return false // past the left/right edge: the carousel turns
          return true
        }
        playUi(UI_SOUND.MOVE)
        setFocus(j)
        return true
      }
      case 'Enter': {
        playUi(UI_SOUND.SELECT)
        if (focus === 0) {
          // the picture: Smart Hub gives way to the TV (inferred: CHomeExecutor::m_ExecuteNativeApp)
          run(() => closeApp('smarthub'))
        } else {
          // a programme: tune its channel (CHomeExecutor::m_ExecuteOnTVRecommeded @0467b24c ->
          // m_TuneRFChannel); Coming Up items tune the same way (inferred)
          const p = focus <= 6 ? rec[focus - 1] : next[focus - 7]
          if (p) run(() => {
            tuneChannel(p.chIndex)
            closeApp('smarthub')
          })
        }
        return true
      }
      default:
        return false
    }
  }, active)

  // focused item rect (small items grow by ENLARGED_WIDTH/HEIGHT_DIFF_1, centred, inferred)
  const fc = cellOf(focus)
  const fx = focus === 0 ? X0 : colX(fc.c) - ENLARGE_W / 2
  const fy = focus === 0 ? Y0 : ROWS[fc.r] - ENLARGE_H / 2
  const fw = focus === 0 ? VIDEO_W : COL + ENLARGE_W
  const fh = focus === 0 ? VIDEO_H + BOX_H0 : THUMB_H + ENLARGE_H + BOX_H1

  const s = getTv()
  const src = currentSource(s)
  const ch = currentChannel(s)
  // caption: CHomeInfo::GetPIGString @046867e4 = the activity's channel string, then the channel number
  // and name, separated by spaces; from the end of the first part on the text takes 0xff3b61ae
  // (CHomeSmartGuideListItemRenderer::t_OnUpdate @02bdc3b8)
  const pigHead = src.id === 'TV' ? 'TV' : src.title
  const pigTail = src.id === 'TV' && ch ? `${ch.number} ${ch.name}` : ''

  return (
    <div className="ontv">
      {/* "On Now" (string 69) + " | " + the time (format 2), (152, 108) 370 x 40, size 32, Medium,
          0xff028de5 at 0.8, left (m_UpdateCurrentTimeInfo @02bdb284) */}
      <div className="ontv__title" style={{ left: 152, top: 108, width: 370, color: TITLE_BLUE }}>On Now | {hhmm(now)}</div>
      {/* the On TV service: provider source and provider name joined by " - " (CHomeInfo::
          GetSourceNameOnTV @04686c48), (1256, 108) 520 x 40, right-aligned. Server data: stub. */}
      <div className="ontv__title" style={{ left: 1256, top: 108, width: 520, textAlign: 'right', color: TITLE_BLUE }}>
        {TV_PROVIDER.source} - {TV_PROVIDER.name}
      </div>

      {/* item 0: the live picture */}
      <FlipItem table={FLIP_TABLE} cell={0}>
        <div className="ontv__pig" style={{ left: X0, top: Y0, width: VIDEO_W, height: VIDEO_H }}>
          {pigStill ? <img src={pigStill} alt="" /> : null}
        </div>
        {focus === 0 && active ? (
          <TextBox style={{ left: X0, top: Y0 + VIDEO_H, width: VIDEO_W, height: BOX_H0 }} />
        ) : null}
        <div
          className="ontv__cap"
          style={{ left: X0 + 10, top: Y0 + TEXT_Y0, width: VIDEO_W - 20, height: TEXT_H0, color: focus === 0 && active ? '#000' : '#fff' }}
        >
          {pigHead}{pigTail ? <span style={{ color: '#3b61ae' }}> {pigTail}</span> : null}
        </div>
      </FlipItem>
      {/* the video object (CCVideoObject, m_InitializePanel @02bdb67c) over item 0 */}
      <div className="ontv__pig ontv__video" style={{ left: X0, top: Y0, width: VIDEO_W, height: VIDEO_H, visibility: flip ? 'hidden' : 'visible' }}>
        {video ? <video ref={videoRef} key={video} src={`${VIDEO}${video}`} autoPlay muted loop playsInline /> : null}
      </div>

      {rec.map((p, k) => {
        const i = 1 + k
        const { c, r } = cellOf(i)
        const total = p.prog.end.getTime() - p.prog.start.getTime()
        const frac = Math.max(0, Math.min(1, (now.getTime() - p.prog.start.getTime()) / total))
        return (
          <FlipItem key={i} table={FLIP_TABLE} cell={r * 6 + c}>
            <Item x={colX(c)} y={ROWS[r]} p={p} focused={active && focus === i} progress={frac} now={now} />
          </FlipItem>
        )
      })}

      {/* "Coming Up" (string 70): (152, 670) 246 x 40, size 32; the 2 px boundary line at y 693 starts 20 px
          after the text and runs to x 1778, white at 0.2 (m_InitializePanel @02bdb67c) */}
      <div className="ontv__title ontv__next" style={{ left: 152, top: 670, color: TITLE_BLUE }}>
        <span>Coming Up</span>
        <i />
      </div>
      {next.map((p, c) => (
        <FlipItem key={7 + c} table={FLIP_TABLE} cell={12 + c}>
          <Item x={colX(c)} y={ROWS[2]} p={p} focused={active && focus === 7 + c} upcoming now={now} />
        </FlipItem>
      ))}

      <Glow x={fx} y={fy} w={fw} h={fh} dx={GLOW_DX} dy={GLOW_DY} show={active} />
    </div>
  )
}

// A recommended or Coming Up programme (CHomeSmartGuideListItemRenderer, item types 1 and 2).
function Item({ x, y, p, focused, progress, upcoming, now }: {
  x: number; y: number; p: Pick; focused: boolean; progress?: number; upcoming?: boolean; now: Date
}) {
  const ex = focused ? ENLARGE_W / 2 : 0
  const ey = focused ? ENLARGE_H / 2 : 0
  const w = COL + ex * 2
  // minutes to the start: "+%02d" + "min" (string 82) in 0xb030b4ff (UpdateTime @02bd9540)
  const mins = Math.max(1, Math.round((p.prog.start.getTime() - now.getTime()) / 60000))
  const lead = upcoming ? UPCOMING_W + UPCOMING_GAP : 0
  return (
    <div className="ontv__item" style={{ left: x - ex, top: y - ey, width: w, zIndex: focused ? 2 : 1 }}>
      {/* no server thumbnail: thumbnail/default_blank_ontv_184.png, the title over it (size 28, centred,
          bottom, 2 lines max, box (10, 117) 226 x 64) on a black band at 0.4 from y 144 (1 line) or 118
          (2 lines) (GBHOME_SMARTLIVE_ITEM_NOT_THUMBNAIL_*) */}
      <div className="ontv__thumb" style={{ height: THUMB_H + ey * 2 }}>
        <img src={`${IMG}/thumbnail/default_blank_ontv_184.png`} alt="" />
        <NoThumbTitle title={p.prog.title} />
      </div>
      {progress !== undefined ? (
        // GBHOME_SMARTLIVE: sg_progress_bg / sg_progress (3 x 3, drawn 1.5x) under the picture,
        // DATA_WIDTH_0 x elapsed / running time (UpdateTime)
        <div className="ontv__prog" style={{ top: THUMB_H + ey * 2, width: w }}>
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
      {focused ? <TextBox style={{ left: 0, top: THUMB_H + ey * 2, width: w, height: BOX_H1 }} /> : null}
      {upcoming ? (
        <div className="ontv__upc" style={{ top: TEXT_Y1 + ey * 2, width: UPCOMING_W, height: TEXT_H1 }}>+{String(mins).padStart(2, '0')}min</div>
      ) : null}
      <div
        className="ontv__cap"
        style={{ left: lead + 10, top: TEXT_Y1 + ey * 2, width: w - lead - 20, height: TEXT_H1, color: focused ? '#000' : '#fff' }}
      >
        <b>{p.ch.name}</b> {p.prog.title}
      </div>
      {focused ? (
        // the programme time (0xff00aeef, GBHOME_SMARTLIVE_ITEM_2LINE_TEXT_FONT_SIZE 25), shown while
        // focused (renderer +0x21fc); text format inferred
        <div className="ontv__time" style={{ top: TEXT_Y1 + ey * 2 + TEXT_H1, width: w - 20 }}>
          {hhmm(p.prog.start)} - {hhmm(p.prog.end)}
        </div>
      ) : null}
    </div>
  )
}

function NoThumbTitle({ title }: { title: string }) {
  // one or two rows: measured roughly by length at size 28 in 226 px (inferred)
  const two = title.length > 16
  return (
    <>
      <div className="ontv__band" style={{ top: two ? 118 : 144 }} />
      <div className="ontv__tt">{title}</div>
    </>
  )
}

registerOnlinePanel(ONTV, OnTvPanel)
