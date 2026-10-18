import { useEffect, useState } from 'react'
import { useRemote } from '../../../../input/remote'
import { argb, img } from '../common'

// Quick Nav (red key): CEpgQuickNaviWidget. Window EPG_QUICK_NAVI_W x _H at (EPG_QUICK_NAVI_X, _Y)
// (CEpgFullMain::t_CreateAndShowQuickNavi @ 0279a9ac, CEpgQuickNaviWidget::Create @ 027d2a6c) on
// navi_popup_bg. It fades in from alpha 0x7f to 0xff in 100 ms (m_CreateShowAlphaAnimation), then the
// animated arrow (11 frames popup_arrow_in/middle/out/blank x3 + normal at EPG_QUICK_NAVI_POPUP_ARROW_X/Y,
// 1100 ms) plays and gives way to the four arrow buttons (t_OnFrameChange); keys count only after that
// (m_IsAniPlayedOver). Up/down page the channels (only with more than FULL_LIST_MAX_VISIBLE_ITEM rows,
// otherwise dimmed to EPG_DIM_ALPHA), left/right move the guide 24 hours (DVB), left is dimmed while the
// guide shows the current hour (SetPreviousTimeDirectionEnableState). Return, Exit and A close it
// (CEpgFullMain::ProcessQuickNaviKeyPress @ 0279f154).

const Q = {
  X: 1032, Y: 132, W: 516, H: 312,
  UD_W: 78, UD_H: 70, UP_X: 218, UP_Y: 62, DOWN_X: 218, DOWN_Y: 182,
  LR_W: 70, LR_H: 78, LEFT_X: 164, LEFT_Y: 118, RIGHT_X: 284, RIGHT_Y: 118,
  UD_TEXT_W: 432, TEXT_H: 36, UP_TEXT_X: 40, UP_TEXT_Y: 16, DOWN_TEXT_X: 40, DOWN_TEXT_Y: 258,
  LR_TEXT_W: 128, LEFT_TEXT_X: 26, LEFT_TEXT_Y: 136, RIGHT_TEXT_X: 366, RIGHT_TEXT_Y: 136,
  TEXT_SIZE: 30, ARROW_X: 160, ARROW_Y: 60,
  DIM: 102 / 255, // EPG_DIM_ALPHA
}
const TEXT_COLOR = 0xffffffff // EPG_QUICK_NAVI_TEXT_COLOR

// m_SetAnimatedArrowItem @ 027d707c: EPG images 132 in, 133 middle, 134 out, 102 Transparent (x3),
// 132, 133, 134, 102, 135 normal over 1100 ms (100 ms a frame: inferred from the 11 frames / 1100).
const FRAMES = ['popup_arrow_in', 'popup_arrow_middle', 'popup_arrow_out', '', '', '', 'popup_arrow_in', 'popup_arrow_middle', 'popup_arrow_out', '', 'popup_arrow_normal']

// Arrow images are drawn centred in their buttons (inferred alignment).
function ArrowButton({ x, y, w, h, src, nw, nh, dim }: { x: number; y: number; w: number; h: number; src: string; nw: number; nh: number; dim: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity: dim ? Q.DIM : 1 }}>
      <img src={img(src)} alt="" style={{ position: 'absolute', left: (w - nw * 1.5) / 2, top: (h - nh * 1.5) / 2, width: nw * 1.5, height: nh * 1.5 }} />
    </div>
  )
}

function Label({ x, y, w, text, dim }: { x: number; y: number; w: number; text: string; dim: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: Q.TEXT_H, lineHeight: `${Q.TEXT_H}px`, textAlign: 'center', whiteSpace: 'pre', fontSize: Q.TEXT_SIZE, color: argb(TEXT_COLOR), opacity: dim ? Q.DIM : 1 }}>
      {text}
    </div>
  )
}

export function QuickNavi({ canGoBack, canPage, onClose, onMove }: { canGoBack: boolean; canPage: boolean; onClose: () => void; onMove: (d: 'Up' | 'Down' | 'Left' | 'Right') => void }) {
  const [shown, setShown] = useState(false)
  const [frame, setFrame] = useState(-1) // -1 before the arrow animation, FRAMES.length when done
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    // alpha animation 100 ms, then the arrow drawing animation (200 ms alarm: t_PlayArrowDrawingAniTimeoutCallback)
    const timers: number[] = []
    for (let i = 0; i <= FRAMES.length; i++) timers.push(window.setTimeout(() => setFrame(i), 300 + i * 100))
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(t => clearTimeout(t))
    }
  }, [])
  const ready = frame >= FRAMES.length

  useRemote(key => {
    if (!ready) return key !== 'VolumeUp' && key !== 'VolumeDown' && key !== 'Mute'
    switch (key) {
      case 'Up':
      case 'Down':
        if (canPage) onMove(key)
        return true
      case 'Left':
      case 'Right':
        onMove(key)
        return true
      case 'Back':
      case 'Exit':
      case 'Red':
        onClose()
        return true
      default:
        return true
    }
  })

  // the left/right texts: g_EPGWStringEng 110 '<<A>> hrs' with A = "24" (FlagEnableForDVB)
  const hrs = '24 hrs'
  return (
    <div style={{ position: 'absolute', left: Q.X, top: Q.Y, width: Q.W, height: Q.H, opacity: shown ? 1 : 0.5, transition: 'opacity 100ms linear' }}>
      <img src={img('EPG/navi_popup_bg.bmp')} alt="" style={{ position: 'absolute', left: 0, top: 0, width: Q.W, height: Q.H }} />
      <Label x={Q.UP_TEXT_X} y={Q.UP_TEXT_Y} w={Q.UD_TEXT_W} text="Previous Page" dim={!canPage} />
      <Label x={Q.DOWN_TEXT_X} y={Q.DOWN_TEXT_Y} w={Q.UD_TEXT_W} text="Next Page" dim={!canPage} />
      <Label x={Q.LEFT_TEXT_X} y={Q.LEFT_TEXT_Y} w={Q.LR_TEXT_W} text={hrs} dim={!canGoBack} />
      <Label x={Q.RIGHT_TEXT_X} y={Q.RIGHT_TEXT_Y} w={Q.LR_TEXT_W} text={hrs} dim={false} />
      {frame >= 0 && frame < FRAMES.length && FRAMES[frame] && (
        <img src={img(`EPG/${FRAMES[frame]}.bmp`)} alt="" style={{ position: 'absolute', left: Q.ARROW_X, top: Q.ARROW_Y, width: 129 * 1.5, height: 129 * 1.5 }} />
      )}
      {ready && (
        <>
          <ArrowButton x={Q.UP_X} y={Q.UP_Y} w={Q.UD_W} h={Q.UD_H} src="EPG/popup_arrow_up_normal.bmp" nw={27} nh={51} dim={!canPage} />
          <ArrowButton x={Q.DOWN_X} y={Q.DOWN_Y} w={Q.UD_W} h={Q.UD_H} src="EPG/popup_arrow_down_normal.bmp" nw={27} nh={51} dim={!canPage} />
          <ArrowButton x={Q.LEFT_X} y={Q.LEFT_Y} w={Q.LR_W} h={Q.LR_H} src="EPG/popup_arrow_left_normal.bmp" nw={51} nh={27} dim={!canGoBack} />
          <ArrowButton x={Q.RIGHT_X} y={Q.RIGHT_Y} w={Q.LR_W} h={Q.LR_H} src="EPG/popup_arrow_right_normal.bmp" nw={51} nh={27} dim={false} />
        </>
      )}
    </div>
  )
}
