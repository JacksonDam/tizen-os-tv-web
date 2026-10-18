import { useEffect, useRef, useState } from 'react'
import { registerHotkey } from '../../../shell'
import { playUi, UI_SOUND } from '../../../tv/sound'
import { getTv, useTv } from '../../../tv/store'
import { img, IMG_SCALE } from '../common'
import { Jog } from './jog'

// Volume OSD (Ace factory -> CViewerVolumeSmart: t_Create 0x024fb500, t_Show 0x024fbc1c,
// t_ShowVolumeLevel 0x024fb778, m_PlayVolumeNumberAnimation 0x024fb0e4, t_Hide 0x024fc1c4) and the
// mute icon (CViewerMuteSmart 0x02509f40 / CViewerMute::t_Show 0x024a7bb4). Values in 1920 stage px
// (CViewerOSDInfo at 1920/960).

const WND = { x: 0, y: 388, w: 500, h: 306 }        // SMART_VOLUME_WND_X/Y, SMART_VOLUME_RECEIVER_W, _WND_H
const JOG = { x: -206, hiddenX: -306, y: 0, size: 306 } // SMART_VOLUME_JOG_MAIN_X/Y/W; created at -W
const NUM_X = [102, 144, 186]                        // SMART_VOLUME_NUM31_X / NUM32_X / NUM33_X
const NUM_Y = 114                                    // SMART_VOLUME_NUM_HIGH_Y
const ICON_GAP = 48 + 4                              // SMART_VOLUME_IMAGE_W + SMART_VOLUME_IMAGE_GAP
const HIDE_MS = 1000                                 // CViewerManager::StartBannerTimer(2)
const NUM_ANI_GUARD_MS = 500                         // PCAlarm at +0x3f4 (continuous key presses)

const MUTE = { x: 30, y: 492, step: 78, range: 2 * 78, interval: 3000 } // VIEWER_MUTE_SMART_WND_*, VIEWER_MUTE_MOVE_UNIT, MUTE_MOVE_BOUNDARY, t_SetMoveTimer

// Volume keys: the shell changes the level (step 1, 0..100, unmutes); the OSD only needs to know a
// key came (it shows even at the ends of the range).
type VolKey = { dir: 1 | 2; seq: number }
let volKey: VolKey = { dir: 1, seq: 0 }
const subs = new Set<() => void>()
function pressed(dir: 1 | 2) {
  volKey = { dir, seq: volKey.seq + 1 }
  // after the shell applied the change
  setTimeout(() => subs.forEach(f => f()), 0)
  return false
}
registerHotkey('VolumeUp', () => pressed(1))
registerHotkey('VolumeDown', () => pressed(2))

// Volume digits (image id 0xd4 + digit = volume_w_N.bmp) at the slot positions for 1, 2 or 3 digits.
function digits(v: number) {
  const s = String(Math.max(0, Math.min(100, v)))
  return s.split('').map((c, i) => ({ src: `TVViewer/volume_w_${c}.bmp`, x: NUM_X[i] }))
}

export function VolumeOsd() {
  const [st, setSt] = useState({ shown: false, level: getTv().volume, prev: -1, anim: 0, seq: 0, up: true })
  const lastChange = useRef(0)
  const lastLevel = useRef(getTv().volume)

  useEffect(() => {
    const f = () => {
      const s = getTv()
      const now = performance.now()
      // t_Show: the VolCh sound whenever a volume key moved the level
      if (s.volume !== lastLevel.current) playUi(UI_SOUND.VOLCH)
      lastLevel.current = s.volume
      setSt(p => {
        const changed = p.shown ? s.volume !== p.level : false
        // the number animates when the level changed while shown, and not during a run of presses
        const animate = changed && now - lastChange.current >= NUM_ANI_GUARD_MS
        if (changed) lastChange.current = now
        return {
          shown: true,
          level: s.volume,
          prev: animate ? p.level : -1,
          anim: animate ? p.anim + 1 : p.anim,
          seq: p.seq + 1,
          up: volKey.dir === 1,
        }
      })
    }
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])

  useEffect(() => {
    if (!st.shown) return
    const t = setTimeout(() => setSt(p => ({ ...p, shown: false })), HIDE_MS)
    return () => clearTimeout(t)
  }, [st.shown, st.seq])

  const now = digits(st.level)
  const old = st.prev >= 0 ? digits(st.prev) : []
  // digits that changed count (10 -> 9, 100 -> 99) are hidden instead of animated out
  const oldShown = old.length === now.length
  const iconX = now[now.length - 1].x + ICON_GAP
  return (
    <div style={{ position: 'absolute', left: WND.x, top: WND.y, width: WND.w, height: WND.h, overflow: 'hidden', zIndex: 900, pointerEvents: 'none' }}>
      <Jog
        kind="volume"
        x={JOG.x}
        hiddenX={JOG.hiddenX}
        y={JOG.y}
        size={JOG.size}
        shown={st.shown}
        pos={st.level}
        count={100}
        up={st.up}
        highlightAtMin={false}
      />
      {st.shown && (
        <>
          {oldShown &&
            old.map((d, i) => (
              <img key={`o${st.anim}-${i}`} className="f13-tvv-vol-out" src={img(d.src)} alt="" style={{ position: 'absolute', left: d.x / IMG_SCALE, top: NUM_Y / IMG_SCALE, zoom: IMG_SCALE }} />
            ))}
          {now.map((d, i) => (
            <img key={`n${st.anim}-${i}`} className={st.anim ? 'f13-tvv-vol-in' : undefined} src={img(d.src)} alt="" style={{ position: 'absolute', left: d.x / IMG_SCALE, top: NUM_Y / IMG_SCALE, zoom: IMG_SCALE }} />
          ))}
          {/* t_GetVolumeIconImage: TV speaker -> image 0xb9 vol_speaker.bmp */}
          <img src={img('TVViewer/vol_speaker.bmp')} alt="" style={{ position: 'absolute', left: iconX / IMG_SCALE, top: NUM_Y / IMG_SCALE, zoom: IMG_SCALE }} />
        </>
      )}
    </div>
  )
}

// The mute icon stays while muted and moves 78 px every 3 s, down first, between 336 and 648
// (CViewerIViewerSimple::MoveWindow 0x024876e0 with the move info of CViewerMute::t_SetMoveTimer).
export function MuteOsd() {
  const muted = useTv(s => s.muted)
  const [y, setY] = useState(MUTE.y)
  useEffect(() => {
    if (!muted) return
    setY(MUTE.y)
    let cur = MUTE.y
    let down = true
    const t = setInterval(() => {
      if (down) {
        cur += MUTE.step
        if (cur >= MUTE.y + MUTE.range) {
          cur = MUTE.y + MUTE.range
          down = false
        }
      } else {
        cur -= MUTE.step
        if (cur <= MUTE.y - MUTE.range) {
          cur = MUTE.y - MUTE.range
          down = true
        }
      }
      setY(cur)
    }, MUTE.interval)
    return () => clearInterval(t)
  }, [muted])
  if (!muted) return null
  // image 0xfe volume_w_mute.bmp (0xfd volume_w_mute_cn.bmp for China) at VIEWER_MUTE_SMART_ICON (0, 0)
  return (
    <img
      src={img('TVViewer/volume_w_mute.bmp')}
      alt=""
      style={{ position: 'absolute', left: MUTE.x / IMG_SCALE, top: y / IMG_SCALE, zoom: IMG_SCALE, zIndex: 890, pointerEvents: 'none' }}
    />
  )
}
