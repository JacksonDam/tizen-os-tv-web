import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRemote, type RemoteKey } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getSetting } from '../../tv/store'
import {
  ARROW_GONE_X, ARROW_INIT_X, ARROW_X, ARROW_Y, defaultCentre, defaultPanelList, ENTRANCE_MS, EXIT_BG_MS,
  EXIT_FIRST_MS, EXIT_ROTATE, EXIT_TOTAL_MS, iconSrc, IMG, INIT_ROTATE_CENTRE, INIT_SCALE, INTRO_INIT_ROTATE,
  MID_ACTIVATE_MS, MOVE_EASE, MOVE_MS, NORMAL_ALPHA, NORMAL_ROTATE, NORMAL_SCALE, PANELS, PIVOT_Z, TOP_ANI_LEAD,
  TOP_ANI_MS, TOP_ICON_GAP_X, TOP_INIT_Y, TOP_TEXT_H, TOP_TEXT_W, TOP_TEXT_X, TOP_TEXT_Y,
} from './data'
import { PromoPanel } from './PromoPanel'

// The Smart Hub carousel as CHomePanelMainWindow draws it for a fresh TV with no network: the panels
// of the product's default list on a 3D cylinder, each showing its "Set Up Smart Hub" page, the top
// menu of panel icons, the side arrows and the panel-coloured gradient background. The submenu row
// (CHomeSubMenuWindow) is not drawn in this state: its activate animation, which brings the buttons up
// from y = 1080, is skipped while m_isDefaultPanelConfig is set (OnBeginActivateAnimation @02bd0378,
// OnFocusIn @02bd1464 returns 0).

type PanelAnim = { rot: number; scale: number; alpha: number; tr: string; shown: boolean }
type IconAnim = { y: number; alpha: number; tr: string }
type Overlay = { img: 'focus' | 'selected'; alpha: number; tr: string }
type Phase = 'enter' | 'idle' | 'move' | 'exit'
type ArrowMode = 'in' | 'out'

const NAV = new Set<RemoteKey>(['Up', 'Down', 'Left', 'Right', 'Enter'])
// Keys CHomePanelApp::m_RegisterUsingKeys @02bab694 takes while Smart Hub is up whose effect was not
// traced: swallowed so they don't act on the TV behind (inferred).
const SWALLOW = new Set<RemoteKey>([
  'ChannelUp', 'ChannelDown', 'PreCh', 'Info', 'Tools',
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
])
const HALF = Math.round(MOVE_MS / 2) // the top menu's out-then-in fades (m_InitCommonAlphaAnimationForSwitching)

function nextFrame(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn))
}

function rgb([r, g, b]: number[]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

export function Hub({ close, onSetup }: { close: () => void; onSetup: () => void }) {
  const list = useMemo(() => defaultPanelList(getSetting('country', 'United Kingdom')), [])
  const n = list.length
  const row = n - 1
  // order indices used by n panels (CHomePanelMainWindow::OnActivateWindow @02bbb990)
  const first = n === 2 ? 2 : n <= 4 ? 1 : 0
  const last = first + n - 1
  const slotOf = (o: number, c: number) => {
    let s = o - c + 2
    while (s < first) s += n
    while (s > last) s -= n
    return s
  }
  const stateOf = (s: number) => (s === 2 ? 0 : s === 1 || s === 3 ? 1 : 2) // centre, adjacent, hidden
  const startCentre = first + defaultCentre(list)

  const [centre, setCentre] = useState(startCentre)
  const [focusPanel, setFocusPanel] = useState(startCentre) // panel whose button has the focus (-1 while moving)
  const centreRef = useRef(startCentre)
  const [focus, setFocus] = useState<'content' | 'top'>('content')
  const focusRef = useRef<'content' | 'top'>('content')
  const phase = useRef<Phase>('enter')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // ---- panels: activation start state (OnBeginActivateAnimation @02bc0afc) ----
  const [panels, setPanels] = useState<PanelAnim[]>(() =>
    list.map((_, i) => {
      const s = slotOf(first + i, startCentre)
      if (s === 2) return { rot: INIT_ROTATE_CENTRE, scale: INIT_SCALE, alpha: 0, tr: 'none', shown: true }
      return { rot: INTRO_INIT_ROTATE[row][s], scale: NORMAL_SCALE[s], alpha: 0, tr: 'none', shown: stateOf(s) < 2 }
    }),
  )
  const [bg, setBg] = useState({ alpha: 0, tr: 'none' })
  const [icons, setIcons] = useState<IconAnim[]>(() => list.map(() => ({ y: TOP_INIT_Y, alpha: 0, tr: 'none' })))
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    list.map((_, i) => ({ img: 'selected', alpha: first + i === startCentre ? 1 : 0, tr: 'none' })),
  )
  const [labelY, setLabelY] = useState(TOP_TEXT_Y)
  const [labels, setLabels] = useState<{ alpha: number; tr: string }[]>(() =>
    list.map((_, i) => ({ alpha: first + i === startCentre ? 1 : 0, tr: 'none' })),
  )
  const [arrows, setArrows] = useState<{ mode: ArrowMode; seq: number }>({ mode: 'in', seq: 0 })

  // ---- opening (m_PlayActivating, activate path) ----
  useEffect(() => {
    nextFrame(() => {
      // centre panel: +45 deg, 0.9, alpha 0 -> normal over 833 ms, linear (m_animatePanel @02bc0914)
      setPanels(ps => ps.map((p, i) => {
        const s = slotOf(first + i, startCentre)
        if (s !== 2) return p
        const lin = `${ENTRANCE_MS}ms linear`
        return { ...p, rot: 0, scale: 1, alpha: 1, tr: `transform ${lin}, opacity ${lin}` }
      }))
      // background fades in over the TV picture (m_PlayBackgroundFadeIn @02bb9654, 833 ms linear)
      setBg({ alpha: 1, tr: `opacity ${ENTRANCE_MS}ms linear` })
      // top icons slide down from y -120 (250 ms, 34 ms per slot, from +416 ms) and fade in over 833 ms
      setIcons(list.map((_, i) => ({
        y: 0, alpha: 1,
        tr: `transform ${TOP_ANI_MS}ms linear ${HALF + TOP_ANI_LEAD * (first + i)}ms, opacity ${ENTRANCE_MS}ms linear`,
      })))
    })
    // OnMidActivateAnimation @02bbfe58: the other panels turn by GBHOME_ANI_PANEL_INTRO_ROTATE (+5/-5)
    // and fade to their slot alpha over 500 ms, linear
    later(ENTRANCE_MS, () => {
      setPanels(ps => ps.map((p, i) => {
        const s = slotOf(first + i, startCentre)
        if (s === 2) return p
        const lin = `${MID_ACTIVATE_MS}ms linear`
        return { ...p, rot: NORMAL_ROTATE[row][s], alpha: NORMAL_ALPHA[s], tr: `transform ${lin}, opacity ${lin}` }
      }))
    })
    later(ENTRANCE_MS + MID_ACTIVATE_MS, () => {
      phase.current = 'idle'
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- moving the carousel (m_OnMovePanel @02bba4ac, CHomePanelWindowBase::m_animateMovePanel @02bc1ea0) ----
  function move(dir: 1 | -1, steps = 1) {
    const c = centreRef.current
    let c2 = c
    for (let k = 0; k < steps; k++) c2 = c2 + dir > last ? first : c2 + dir < first ? last : c2 + dir
    if (c2 === c) return
    phase.current = 'move'
    playUi(UI_SOUND.MOVE_PANEL)
    centreRef.current = c2
    setCentre(c2)
    setFocusPanel(-1)
    setPanels(ps => ps.map((p, i) => {
      const o = first + i
      // relative rotation, summed per step from slot to slot (GBHOME_ANI_PANEL_NORMAL_ROTATE_left/right:
      // each step is the shorter way except the panel that wraps, which goes round behind)
      let delta = 0
      let cc = c
      for (let k = 0; k < steps; k++) {
        const nc = cc + dir > last ? first : cc + dir < first ? last : cc + dir
        const s0 = slotOf(o, cc)
        const s1 = slotOf(o, nc)
        let d = NORMAL_ROTATE[row][s1] - NORMAL_ROTATE[row][s0]
        if (dir > 0 && d > 0) d -= 360   // panels move left (slots decrease)
        if (dir < 0 && d < 0) d += 360   // panels move right
        delta += d
        cc = nc
      }
      const s0 = slotOf(o, c)
      const s1 = slotOf(o, c2)
      const st0 = stateOf(s0)
      const st1 = stateOf(s1)
      const motion = `transform ${MOVE_MS}ms ${MOVE_EASE}`
      // with 3 panels the panel that wraps from one side to the other dips to alpha 0 in 104 ms and
      // comes back to its slot alpha in 104 ms at 625 ms
      if (n === 3 && st0 === 1 && st1 === 1) {
        later(Math.floor((MOVE_MS * 3) / 4), () =>
          setPanels(qs => qs.map((q, j) => (j === i ? { ...q, alpha: NORMAL_ALPHA[s1], tr: `${motion}, opacity ${MOVE_MS >> 3}ms linear` } : q))),
        )
        return { rot: p.rot + delta, scale: NORMAL_SCALE[s1], alpha: 0, tr: `${motion}, opacity ${MOVE_MS >> 3}ms linear`, shown: true }
      }
      return {
        rot: p.rot + delta, scale: NORMAL_SCALE[s1], alpha: NORMAL_ALPHA[s1],
        tr: `${motion}, opacity ${MOVE_MS}ms linear`, shown: st0 < 2 || st1 < 2,
      }
    }))
    // top menu: the old overlay and name fade out, then the new ones fade in (416 + 416 ms, linear)
    const oi = c - first
    const ni = c2 - first
    const img = focusRef.current === 'top' ? 'focus' : 'selected'
    setOverlays(os => os.map((ov, i) =>
      i === oi ? { ...ov, alpha: 0, tr: `opacity ${HALF}ms linear` }
        : i === ni ? { img, alpha: 1, tr: `opacity ${HALF}ms linear ${HALF}ms` } : ov))
    setLabels(ls => ls.map((l, i) =>
      i === oi ? { alpha: 0, tr: `opacity ${HALF}ms linear` }
        : i === ni ? { alpha: 1, tr: `opacity ${HALF}ms linear ${HALF}ms` } : l))
    // side arrows slide out and come back once the panels have settled (inferred)
    setArrows(a => ({ mode: 'out', seq: a.seq }))
    later(MOVE_MS, () => {
      setPanels(ps => ps.map((p, i) => ({ ...p, shown: stateOf(slotOf(first + i, c2)) < 2 })))
      setFocusPanel(c2)
      setArrows(a => ({ mode: 'in', seq: a.seq + 1 }))
      phase.current = 'idle'
    })
  }

  // Focus moving between the panel and the top menu: the active icon's overlay fades out and back in
  // with the other image (CHomeTopMenuWindow::OnFocusIn/OnFocusOut, callback_topicon_alpha_animation).
  function setTopFocus(top: boolean) {
    const f = top ? 'top' : 'content'
    if (focusRef.current === f) return
    focusRef.current = f
    setFocus(f)
    const ci = centreRef.current - first
    setOverlays(os => os.map((ov, i) => (i === ci ? { ...ov, alpha: 0, tr: `opacity ${HALF}ms linear` } : ov)))
    later(HALF, () =>
      setOverlays(os => os.map((ov, i) =>
        i === centreRef.current - first ? { img: focusRef.current === 'top' ? 'focus' : 'selected', alpha: 1, tr: `opacity ${HALF}ms linear` } : ov)),
    )
  }

  // ---- closing (m_PlayExitWindow @02bb9c60) ----
  function exit() {
    phase.current = 'exit'
    const c = centreRef.current
    const lin = `${MOVE_MS}ms linear ${EXIT_FIRST_MS}ms`
    setPanels(ps => ps.map((p, i) => {
      const s = slotOf(first + i, c)
      return { ...p, rot: p.rot + EXIT_ROTATE[row][s], scale: INIT_SCALE, alpha: 0, tr: `transform ${lin}, opacity ${lin}` }
    }))
    setBg({ alpha: 0, tr: `opacity ${EXIT_BG_MS}ms linear ${EXIT_FIRST_MS}ms` })
    // CHomeTopMenuWindow::m_AnimateExit: icons back to y -120 and names to y 0, fading, 250 ms, 34 ms apart
    setIcons(list.map((_, i) => ({
      y: TOP_INIT_Y, alpha: 0,
      tr: `transform ${TOP_ANI_MS}ms linear ${TOP_ANI_LEAD * (first + i)}ms, opacity ${TOP_ANI_MS}ms linear ${TOP_ANI_LEAD * (first + i)}ms`,
    })))
    setLabelY(0)
    setLabels(ls => ls.map(() => ({ alpha: 0, tr: `opacity ${TOP_ANI_MS}ms linear` })))
    setArrows(a => ({ mode: 'out', seq: a.seq }))
    later(EXIT_TOTAL_MS, close)
  }

  useRemote(key => {
    if (key === 'VolumeUp' || key === 'VolumeDown' || key === 'Mute' || key === 'Power') return false
    if (phase.current !== 'idle') return true // keys are dropped while an animation runs
    switch (key) {
      case 'Left':
        move(-1)
        return true
      case 'Right':
        move(1)
        return true
      case 'Up':
        if (focusRef.current === 'content') {
          playUi(UI_SOUND.MOVE)
          setTopFocus(true)
        } else playUi(UI_SOUND.NOKEY)
        return true
      case 'Down':
        if (focusRef.current === 'top') {
          playUi(UI_SOUND.MOVE)
          setTopFocus(false)
        }
        return true
      case 'Enter':
        if (focusRef.current === 'top') {
          playUi(UI_SOUND.MOVE)
          setTopFocus(false)
        } else onSetup() // CHomeDefaultPanelInputListener: event 0x119066 -> Smart Hub setup (0x523)
        return true
      case 'Back':
      case 'Exit':
        exit()
        return true
      case 'Home': {
        // event 0x11901b: close if the opening panel is centred, else turn back to it the short way
        // round with the top menu focused (CHomePanelMainWindow::m_LocatePanel @02bba5a8)
        let d = centreRef.current - startCentre
        if (d === 0) {
          exit()
          return true
        }
        if (d > Math.floor(n / 2)) d -= n
        else if (d < -Math.floor(n / 2)) d += n
        setTopFocus(true)
        if (d > 0) move(-1, d)
        else move(1, -d)
        return true
      }
      default:
        return NAV.has(key) || SWALLOW.has(key)
    }
  })

  const iconLeft = (o: number) => 728 + TOP_ICON_GAP_X * o - (n % 2 === 0 ? 58 : 0) - 38.5
  const labelLeft = (o: number) => TOP_TEXT_X + TOP_ICON_GAP_X * o - (n % 2 === 0 ? 58 : 0)
  const cp = PANELS[list[centre - first]]

  return (
    <div className="sh">
      <div
        className="sh-bg"
        style={{ '--sh-top': rgb(cp.bg[0]), '--sh-bottom': rgb(cp.bg[1]), opacity: bg.alpha, transition: `${bg.tr === 'none' ? '' : bg.tr + ', '}--sh-top ${MOVE_MS}ms linear, --sh-bottom ${MOVE_MS}ms linear` } as CSSProperties}
      />
      <div className="sh-3d">
        <div className="sh-world">
          {list.map((type, i) => {
            const p = panels[i]
            return (
              <div
                key={i}
                className="sh-panel"
                style={{
                  transform: `translateZ(${-PIVOT_Z}px) rotateY(${p.rot}deg) translateZ(${PIVOT_Z}px) scale(${p.scale}, ${p.scale})`,
                  opacity: p.alpha,
                  transition: p.tr,
                  visibility: p.shown ? 'visible' : 'hidden',
                }}
              >
                <PromoPanel type={type} focused={focus === 'content' && first + i === focusPanel} />
              </div>
            )
          })}
        </div>
      </div>
      {/* top menu: one 77x73 icon per panel; the active one carries the selected (panel focused) or
          focus (top menu focused) image as an overlay; the panel name (size 34) under it */}
      <div className="sh-top">
        {list.map((type, i) => {
          const o = first + i
          const d = PANELS[type]
          const ic = icons[i]
          const ov = overlays[i]
          return (
            <div
              key={i}
              className="sh-top__icon"
              style={{ left: iconLeft(o), transform: `translateY(${ic.y}px)`, opacity: ic.alpha, transition: ic.tr }}
            >
              <img src={iconSrc(d.icon, 'normal')} alt="" />
              <img src={iconSrc(d.icon, ov.img)} alt="" style={{ opacity: ov.alpha, transition: ov.tr }} />
            </div>
          )
        })}
        {list.map((type, i) => {
          const o = first + i
          const d = PANELS[type]
          const l = labels[i]
          return (
            <div
              key={`l${i}`}
              className="sh-top__name"
              style={{
                left: labelLeft(o), top: labelY, width: TOP_TEXT_W, height: TOP_TEXT_H, lineHeight: `${TOP_TEXT_H}px`,
                color: d.nameColor, opacity: l.alpha * icons[i].alpha, transition: `${l.tr}, top ${TOP_ANI_MS}ms linear`,
              }}
            >
              {d.name}
            </div>
          )
        })}
      </div>
      <Arrows mode={arrows.mode} seq={arrows.seq} />
    </div>
  )
}

// Side arrows (CHomeSideIndicatorWindow): three copies per side slide outward from
// GBHOME_ANI_ARROW_INIT_POS_X to GBHOME_ARROW_POS_X over 667 ms, 166 ms apart; copies 0 and 1 flash to
// alpha 0.35 and back to 0 (250 + 250 ms), copy 2 fades to 1 over 667 ms and stays. On a panel move
// copy 2 slides to GBHOME_DISAPPEARED_ARROW_POS_X and fades over 333 ms.
function Arrows({ mode, seq }: { mode: ArrowMode; seq: number }) {
  return (
    <>
      {(['left', 'right'] as const).map(side =>
        [0, 1, 2].map(i => {
          const src = `${IMG}/arrow/arrow_home_${side}_nor.png`
          const main = i === 2
          if (mode === 'out') {
            if (!main) return null
            return (
              <img
                key={`${side}${i}`}
                className="sh-arrow"
                src={src}
                alt=""
                style={{ top: ARROW_Y, transform: `translateX(${ARROW_GONE_X[side]}px)`, opacity: 0, transition: 'transform 333ms linear, opacity 333ms linear' }}
              />
            )
          }
          return (
            <img
              key={`${side}${i}-${seq}`}
              className={`sh-arrow ${main ? 'sh-arrow--main' : 'sh-arrow--trail'}`}
              src={src}
              alt=""
              style={{
                top: ARROW_Y,
                '--x0': `${ARROW_INIT_X[side][i]}px`,
                '--x1': `${ARROW_X[side][i]}px`,
                transform: `translateX(${ARROW_X[side][i]}px)`,
                opacity: main ? 1 : 0,
                animationDelay: `${166 * i}ms`,
              } as CSSProperties}
            />
          )
        }),
      )}
    </>
  )
}
