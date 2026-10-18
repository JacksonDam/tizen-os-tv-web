import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useForeground } from '../../../shell'
import { currentChannel, currentSource, useTv } from '../../../tv/store'
import { argb, img, IMG_SCALE } from '../common'
import { deviceName } from '../sources'
import { PopupBg } from './PopupBg'

// What the TV shows when there is no picture (banner 5, CViewerSignalStatus: t_Create 0x024bb6a8,
// m_SetSignalText 0x024bc620, m_SetStyle 0x024bb540, m_ShowWithDescriptionStyle 0x024bcad0,
// m_ShowOnlyMessageStyle 0x024bbdd4, m_ShowAudioAni 0x024bbebc, t_ShowNoMotion 0x024bcfa8):
//   - an input without a signal: "No Signal" with the input's name and what to check (status 0,
//     "with description" style);
//   - a radio service: the sound animation (status 8, box_radiosignal1..3);
//   - a data service: "Data Service" (status 0xb, message-only style) (inferred mapping).
// The window drifts 20 px up and down every second (move info: 1000 ms, step NOSIGNAL_MOVE_UNIT,
// range 3 steps) so it doesn't burn in. All values in 1920 stage px.

const BIG = { x: 542, y: 430, w: 836, h: 220 }               // VIEWER_NOSIGNAL_BIG_WND_*
const MSG = { x: 544, y: 474, w: 832, h: 132 }               // VIEWER_NOSIGNAL_WND_*
const AUDIO = { x: 668, y: 441, w: 584, h: 198 }             // AUDIO_LABEL_OPERATION_*
const TITLE = { x: 52, y: 36, w: 724, h: 48 }                // NOSIGNAL_LABEL_MESSAGE_*
const SRC = { x: 56, y: 96, w: 724, h: 60 }                  // NOSIGNAL_LABEL_SOURCE_TYPE_*
const DESC = { x: 56, y: 172, w: 724, h: 48, gap: 4 }        // NOSIGNAL_MULTILABEL_MESSAGE_X/_WITH_SOURCE_Y/W, LABEL_MESSAGE_H, _GAP
const WITH_SOURCE_H = 264                                    // NOSIGNAL_MULTILABEL_MESSAGE_WITH_SOURCE_H
const MOVE = { step: 20, range: 60, ms: 1000 }
const SHOW_DELAY_MS = 1000                                   // (inferred) signal check after a switch
const COLOR = {
  title: argb(0xff7ddcff),     // NOSIGNAL_TITLE_COLOR
  text: argb(0xffffffff),      // NOSIGNAL_TEXT_COLOR
  srcBg: argb(0x594a4a4a),     // NOSIGNAL_SOURCE_TYPE_BG_COLOR
}
const FONT_5 = 36              // VIEWER_FONT_SIZE_5
const FONT_7 = 40              // VIEWER_FONT_SIZE_7 (title in the description style)

// TVViewer strings 261 'No Signal', 671 / 672 (PC input), 90 'Data Service'.
const NO_SIGNAL = 'No Signal'
const CHECK_SOURCE = '(1) Check the cable connections and the settings of your source device.\n(2) Press Source on your remote control to select the connected source device.'
const CHECK_PC = '(1) Check the VGA cable and the PC signal settings (e.g. resolution, mode, etc.)\n(2) Press Source on your remote control to select another source.'
const DATA_SERVICE = 'Data Service'

type Status = { kind: 'nosignal'; source: string; pc: boolean } | { kind: 'radio' } | { kind: 'data' } | null

const text = {
  position: 'absolute' as const,
  fontFamily: "'SamsungSVD', sans-serif",
  fontWeight: 500, // shadow_eu.ttf
  color: COLOR.text,
}

function useDrift(active: boolean) {
  const [dy, setDy] = useState(0)
  useEffect(() => {
    if (!active) return
    setDy(0)
    let cur = 0
    let down = true // (inferred) first step direction
    const t = setInterval(() => {
      cur += down ? MOVE.step : -MOVE.step
      if (cur >= MOVE.range) {
        cur = MOVE.range
        down = false
      } else if (cur <= -MOVE.range) {
        cur = -MOVE.range
        down = true
      }
      setDy(cur)
    }, MOVE.ms)
    return () => clearInterval(t)
  }, [active])
  return dy
}

function NoSignalWindow({ source, pc, dy }: { source: string; pc: boolean; dy: number }) {
  const desc = useRef<HTMLDivElement>(null)
  const [textH, setTextH] = useState(0)
  const [rows, setRows] = useState(1)
  useLayoutEffect(() => {
    const el = desc.current
    if (!el) return
    const h = el.scrollHeight
    setTextH(h)
    setRows(Math.max(1, Math.round((h + DESC.gap) / (FONT_5 * 1.2 + DESC.gap))))
  }, [pc])
  // ResizeWindowByMultiTextLabel 0x024866cc: a taller text grows the window, centred on the screen
  const grow = textH > DESC.h
  const h = grow ? TITLE.y + DESC.y + textH : WITH_SOURCE_H
  const y = grow ? Math.floor((1080 - h) / 2) : BIG.y
  return (
    <div className="f13-tvv-fade" style={{ position: 'absolute', left: BIG.x, top: y + dy, width: BIG.w, height: h }}>
      <PopupBg w={BIG.w} h={h} />
      <div style={{ ...text, left: TITLE.x, top: TITLE.y, width: TITLE.w, height: TITLE.h, lineHeight: `${TITLE.h}px`, textAlign: 'center', fontSize: FONT_7, color: COLOR.title }}>
        {NO_SIGNAL}
      </div>
      <div style={{ position: 'absolute', left: SRC.x, top: SRC.y, width: SRC.w, height: SRC.h, background: COLOR.srcBg }} />
      <div style={{ ...text, left: SRC.x, top: SRC.y, width: SRC.w, height: SRC.h, lineHeight: `${SRC.h}px`, textAlign: 'center', fontSize: FONT_5 }}>
        {source}
      </div>
      <div
        ref={desc}
        style={{
          ...text,
          left: DESC.x,
          top: DESC.y,
          width: DESC.w,
          fontSize: FONT_5,
          lineHeight: `calc(1.2em + ${DESC.gap}px)`, // (inferred) font height plus the row gap
          whiteSpace: 'pre-wrap',
          // one row centred, several rows left-aligned (m_ShowWithDescriptionStyle)
          textAlign: rows === 1 ? 'center' : 'left',
        }}
      >
        {pc ? CHECK_PC : CHECK_SOURCE}
      </div>
    </div>
  )
}

function MessageWindow({ message, dy }: { message: string; dy: number }) {
  return (
    <div className="f13-tvv-fade" style={{ position: 'absolute', left: MSG.x, top: MSG.y + dy, width: MSG.w, height: MSG.h }}>
      <PopupBg w={MSG.w} h={MSG.h} />
      <div style={{ ...text, left: TITLE.x, top: TITLE.y, width: TITLE.w, height: TITLE.h, lineHeight: `${TITLE.h}px`, textAlign: 'center', fontSize: FONT_5 }}>
        {message}
      </div>
    </div>
  )
}

// m_ShowAudioAni: each move tick shows the next frame (image 0x10, 0x11, 0xf = box_radiosignal2, 3, 1).
function RadioWindow({ dy }: { dy: number }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), MOVE.ms)
    return () => clearInterval(t)
  }, [])
  const file = ['TVViewer/box_radiosignal1.bmp', 'TVViewer/box_radiosignal2.bmp', 'TVViewer/box_radiosignal3.bmp'][frame]
  return (
    <img
      className="f13-tvv-fade"
      src={img(file)}
      alt=""
      style={{ position: 'absolute', left: AUDIO.x / IMG_SCALE, top: (AUDIO.y + dy) / IMG_SCALE, zoom: IMG_SCALE }}
    />
  )
}

export function SignalStatus() {
  const source = useTv(currentSource)
  const ch = useTv(currentChannel)
  const isTv = useTv(s => s.source === 'TV')
  const switchSeq = useTv(s => s.switchSeq)
  const fg = useForeground()

  let want: Status = null
  // (Screen Mirroring has its own waiting screen, not a no-signal message)
  if (!isTv && !source.video && source.id !== 'MIRRORING') {
    // t_SetSourceText: the input's name, then ' : ' and the device name when there is one
    const dev = deviceName(source.id)
    want = { kind: 'nosignal', source: dev ? `${source.title} : ${dev}` : source.title, pc: source.id === 'PC' }
  }
  else if (isTv && ch?.kind === 'radio') want = { kind: 'radio' }
  else if (isTv && ch?.kind === 'data') want = { kind: 'data' }
  const key = want ? `${want.kind}:${want.kind === 'nosignal' ? want.source : ch?.number}` : ''

  // the status appears a moment after the switch (signal detection)
  const [shownKey, setShownKey] = useState('')
  useEffect(() => {
    setShownKey('')
    if (!key) return
    const t = setTimeout(() => setShownKey(key), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [key, switchSeq])

  const dy = useDrift(!!shownKey && !fg)
  if (!want || shownKey !== key || fg) return null
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
      {want.kind === 'nosignal' && <NoSignalWindow source={want.source} pc={want.pc} dy={dy} />}
      {want.kind === 'data' && <MessageWindow message={DATA_SERVICE} dy={dy} />}
      {want.kind === 'radio' && <RadioWindow dy={dy} />}
    </div>
  )
}
