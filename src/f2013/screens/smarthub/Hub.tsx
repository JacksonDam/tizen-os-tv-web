import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRemote, type RemoteKey } from '../../../input/remote'
import { isConnected } from '../../tv/online'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getSetting, getTv } from '../../tv/store'
import { getForeground } from '../../shell'
import { ColorTag } from './ColorTag'
import { colorTagColors } from './tagColors'
import {
  ARROW_GONE_X, ARROW_INIT_X, ARROW_X, ARROW_Y, defaultCentre, defaultPanelList, ENTRANCE_MS, EXIT_BG_MS,
  EXIT_FIRST_MS, EXIT_ROTATE, EXIT_TOTAL_MS, HP_SCALE, iconSrc, IMG, INIT_ROTATE_CENTRE, INIT_SCALE,
  INTRO_INIT_ROTATE, MID_ACTIVATE_MS, MOVE_EASE, MOVE_MS, NORMAL_ALPHA, NORMAL_ROTATE, NORMAL_SCALE, ONLINE_PANELS,
  PANELS, PIVOT_Z, SUB_W, SUB_X, SUB_Y, SUBMENU, SUB_MOVE_LEAD_MS, TOP_ANI_LEAD,
  TOP_ANI_MS, TOP_ICON_GAP_X, TOP_INIT_Y, TOP_TEXT_H, TOP_TEXT_W, TOP_TEXT_X, TOP_TEXT_Y,
} from './data'
import { FlipContext, normalizeMs, type Flip } from './flip'
import { BodyFocusContext, getOnlinePanel, getOnlinePanelOptions, type BodyFocus } from './panels'
import { PromoPanel } from './PromoPanel'
import { runOwnSubmenu } from './submenuActions'
import { SubMenu, type SubFocus, type SubSlide } from './SubMenu'

// The Smart Hub carousel (CHomePanelMainWindow). Offline or with the terms not agreed it shows the
// product's default list, every panel on its "Set Up Smart Hub" page and no sub menu
// (m_isDefaultPanelConfig: CHomeSubMenuWindow::OnBeginActivateAnimation @02bd0378 and OnFocusIn @02bd1464
// skip). Online with the terms agreed it shows the server list (ONLINE_PANELS) with each panel's body
// (registerOnlinePanel, ./panels.ts) and the bottom sub menu of the centred panel. Focus is in one of
// three windows (CHomeFocusManager): the top menu, the panel body (table) or the sub menu.

type PanelAnim = { rot: number; scale: number; alpha: number; tr: string; shown: boolean }
type IconAnim = { y: number; alpha: number; tr: string }
type Overlay = { img: 'focus' | 'selected'; alpha: number; tr: string }
type Phase = 'enter' | 'idle' | 'move' | 'exit' | 'minimize' | 'normalize'
type ArrowMode = 'in' | 'out'
type Zone = 'top' | 'content' | 'sub'
type Minimize = { kind: 'item' | 'submenu'; sub: number } | null

const NAV = new Set<RemoteKey>(['Up', 'Down', 'Left', 'Right', 'Enter'])
// Keys CHomePanelApp::m_RegisterUsingKeys @02bab694 takes while Smart Hub is up whose effect was not
// traced: swallowed so they don't act on the TV behind (inferred).
const SWALLOW = new Set<RemoteKey>([
  'ChannelUp', 'ChannelDown', 'PreCh', 'Info', 'Tools',
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
])
const HALF = Math.round(MOVE_MS / 2) // the top menu's out-then-in fades (m_InitCommonAlphaAnimationForSwitching)
// Minimize motion (CHomePanelMainWindow::m_PlayMinimizeWindow @02bb9e50): panels fade over
// GBHOME_ANI_MINIMIZE_WINDOW_ITEM_FLIP_TOTAL_DURATION (CHomePanelWindowBase::OnBeginMinimizeWindow
// @02bc048c), the top menu over GBHOME_ANI_MINIMIZE_WINDOW_TOTAL_DURATION (m_AnimateMinimize @02bc5ebc).
const MIN_FLIP_MS = 660
const MIN_MS = 500

// What Smart Hub had focused when it handed over to an item (CHomePanelMainWindow::OnMinimizeWindow
// keeps the focused window, +0x608); coming back to that panel restores it.
let minimized: { panel: number; zone: Zone; sub: number; body?: Record<string, unknown> } | null = null

function nextFrame(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn))
}

function rgb([r, g, b]: number[]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

// Online = connected with the Smart Hub terms agreed (useSmartHubOnline), read once when Smart Hub opens.
function isOnlineNow() {
  const s = getTv()
  return isConnected(s.network) && s.smartHub.agreed
}

// `normalize`: Smart Hub comes back from an item one of its panels ran (the hub task normalizes,
// CHomePanelApp::t_OnEndNormalizing @02bae604 -> CHomePanelMainWindow::OnNormalizeWindow @02bbb810)
// instead of opening.
export function Hub({ close, onSetup, startPanel, normalize = false }: {
  close: () => void; onSetup: () => void; startPanel?: number; normalize?: boolean
}) {
  const online = useMemo(isOnlineNow, [])
  const list = useMemo(() => (online ? ONLINE_PANELS : defaultPanelList(getSetting('country', 'United Kingdom'))), [online])
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
  const requested = startPanel !== undefined ? list.indexOf(startPanel) : -1
  const startCentre = first + (requested >= 0 ? requested : defaultCentre(list))
  // the panel body registered for a panel type (online only); without one the default page shows
  const bodyOf = (type: number) => (online ? getOnlinePanel(type) : undefined)
  const subOf = (type: number) => (bodyOf(type) ? SUBMENU[type] ?? [] : [])

  const [centre, setCentre] = useState(startCentre)
  const [focusPanel, setFocusPanel] = useState(startCentre) // panel whose content has the focus (-1 while moving)
  const centreRef = useRef(startCentre)
  const [zone, setZoneState] = useState<Zone>('content')
  const zoneRef = useRef<Zone>('content')
  const [idle, setIdle] = useState(false)
  const phase = useRef<Phase>(normalize ? 'normalize' : 'enter')
  const setPhase = (p: Phase) => {
    phase.current = p
    setIdle(p === 'idle')
  }
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // what was focused when this panel handed over (normalize only)
  const [back] = useState(() => (normalize && minimized?.panel === list[startCentre - first] ? minimized : null))
  useEffect(() => {
    minimized = null
  }, [])
  // each panel body's focus (panels.ts useBodyFocus), kept for the hand-over
  const bodyFocus = useRef(new Map<number, Record<string, unknown>>())
  const bodyCtx = useRef(new Map<number, BodyFocus>())
  function bodyFocusOf(type: number): BodyFocus {
    let c = bodyCtx.current.get(type)
    if (!c) {
      c = {
        resume: back?.panel === type ? back.body : undefined,
        keep: (name, value) => {
          bodyFocus.current.set(type, { ...bodyFocus.current.get(type), [name]: value })
        },
      }
      bodyCtx.current.set(type, c)
    }
    return c
  }

  // ---- panels: activation start state (OnBeginActivateAnimation @02bc0afc); coming back, the panels
  // are at their places with alpha 0 (the minimize faded them) ----
  const [panels, setPanels] = useState<PanelAnim[]>(() =>
    list.map((_, i) => {
      const s = slotOf(first + i, startCentre)
      if (normalize) return { rot: NORMAL_ROTATE[row][s], scale: NORMAL_SCALE[s], alpha: 0, tr: 'none', shown: stateOf(s) < 2 }
      if (s === 2) return { rot: INIT_ROTATE_CENTRE, scale: INIT_SCALE, alpha: 0, tr: 'none', shown: true }
      return { rot: INTRO_INIT_ROTATE[row][s], scale: NORMAL_SCALE[s], alpha: 0, tr: 'none', shown: stateOf(s) < 2 }
    }),
  )
  // OnNormalizeWindow shows the scene root at once: background and top menu (CHomeTopMenuWindow::
  // OnBeginNormalizeWindow @02bc5668 sets every icon to alpha 255 and only the centred name visible)
  const [bg, setBg] = useState({ alpha: normalize ? 1 : 0, tr: 'none' })
  const [icons, setIcons] = useState<IconAnim[]>(() =>
    list.map(() => (normalize ? { y: 0, alpha: 1, tr: 'none' } : { y: TOP_INIT_Y, alpha: 0, tr: 'none' })),
  )
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    list.map((_, i) => ({ img: 'selected', alpha: first + i === startCentre ? 1 : 0, tr: 'none' })),
  )
  const [labelY, setLabelY] = useState(TOP_TEXT_Y)
  const [labels, setLabels] = useState<{ alpha: number; tr: string }[]>(() =>
    list.map((_, i) => ({ alpha: normalize && first + i === startCentre ? 1 : 0, tr: 'none' })),
  )
  // coming back the arrows wait at their start (CHomeSideIndicatorWindow::OnBeginNormalizeWindow @02bca7d0
  // -> m_initArrows) and play their entrance when the motion ends (OnEndNormalizeWindow @02bc9e00)
  const [arrows, setArrows] = useState<{ mode: ArrowMode; seq: number }>({ mode: normalize ? 'out' : 'in', seq: 0 })
  // the item flip of the centred panel's tables (flip.tsx); coming back it starts folded (layout 1, as
  // OnEndMinimizeWindow @02bc05a0 leaves it) and t0 is set when the motion starts
  const [flip, setFlip] = useState<Flip | null>(() => (normalize ? { dir: 'in', t0: -1 } : null))
  // sub menus: one per panel, hidden 108 px low until their panel is centred
  const [subs, setSubs] = useState<SubSlide[]>(() => list.map(() => ({ shown: false, base: 0 })))
  const [subFocus, setSubFocus] = useState<SubFocus>({ index: 0, visible: false })
  const subFocusRef = useRef(0)
  const [minimize, setMinimize] = useState<Minimize>(null)
  const [topAlpha, setTopAlpha] = useState({ alpha: 1, tr: 'none' })

  const setZone = (z: Zone) => {
    zoneRef.current = z
    setZoneState(z)
  }
  const centreType = () => list[centreRef.current - first]

  // ---- opening (m_PlayActivating, activate path) ----
  useEffect(() => {
    if (normalize) {
      playNormalize()
      return
    }
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
      setLabels(list.map((_, i) => ({ alpha: first + i === startCentre ? 1 : 0, tr: `opacity ${ENTRANCE_MS}ms linear` })))
      setIcons(list.map((_, i) => ({
        y: 0, alpha: 1,
        tr: `transform ${TOP_ANI_MS}ms linear ${HALF + TOP_ANI_LEAD * (first + i)}ms, opacity ${ENTRANCE_MS}ms linear`,
      })))
      // the centred panel's sub menu rises with the activation (CHomeSubMenuWindow::OnBeginActivateAnimation)
      setSubs(ss => ss.map((s, i) => (first + i === startCentre ? { shown: true, base: 0 } : s)))
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
    later(ENTRANCE_MS + MID_ACTIVATE_MS, () => setPhase('idle'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- coming back (CHomePanelMainWindow::m_PlayNormalizeWindow @02bb9f2c) ----
  function playNormalize() {
    const type = list[startCentre - first]
    nextFrame(() => {
      // every panel from alpha 0 to its slot alpha in GBHOME_ANI_MINIMIZE_WINDOW_ITEM_FLIP_TOTAL_DURATION,
      // linear (CHomePanelWindowBase::OnBeginNormalizeWindow @02bc066c), while the centred panel's tables
      // unfold (PlayFlipAnimation, layout 0)
      setPanels(ps => ps.map((p, i) => ({ ...p, alpha: NORMAL_ALPHA[slotOf(first + i, startCentre)], tr: `opacity ${MIN_FLIP_MS}ms linear` })))
      setFlip({ dir: 'in', t0: document.timeline.currentTime as number })
      // the sub menu rises again (CHomeSubMenuWindow::OnBeginNormalizeWindow @02bd16d8); the button that
      // ran its item is back in place at once
      setSubs(ss => ss.map((s, i) => (first + i === startCentre ? { shown: true, base: 0, back: back?.zone === 'sub' ? back.sub : -1 } : s)))
    })
    // the motion ends when every table has unfolded (normalizeMs); then the arrows come in and the focus
    // goes back to the window that had it, else to the panel (m_ProcessEndNormalizeWindowAnimation @02bbaa88)
    later(normalizeMs(type), () => {
      setFlip(null)
      setArrows(a => ({ mode: 'in', seq: a.seq + 1 }))
      if (back?.zone === 'sub' && subOf(type).length) {
        setZone('sub')
        subFocusRef.current = back.sub
        setSubFocus({ index: back.sub, visible: true })
      }
      setPhase('idle')
    })
  }

  // ---- moving the carousel (m_OnMovePanel @02bba4ac, CHomePanelWindowBase::m_animateMovePanel @02bc1ea0) ----
  function move(dir: 1 | -1, steps = 1) {
    const c = centreRef.current
    let c2 = c
    for (let k = 0; k < steps; k++) c2 = c2 + dir > last ? first : c2 + dir < first ? last : c2 + dir
    if (c2 === c) return
    setPhase('move')
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
    const img = zoneRef.current === 'top' ? 'focus' : 'selected'
    setOverlays(os => os.map((ov, i) =>
      i === oi ? { ...ov, alpha: 0, tr: `opacity ${HALF}ms linear` }
        : i === ni ? { img, alpha: 1, tr: `opacity ${HALF}ms linear ${HALF}ms` } : ov))
    setLabels(ls => ls.map((l, i) =>
      i === oi ? { alpha: 0, tr: `opacity ${HALF}ms linear` }
        : i === ni ? { alpha: 1, tr: `opacity ${HALF}ms linear ${HALF}ms` } : l))
    // sub menus (CHomeSubMenuWindow::OnBeginMovePanelAnimation @02bcfd04): the old one slides down at
    // once, the new one rises from GBHOME_ANI_SUBMENU_MOVE_SHOW_LEADTIME; the focus box hides
    setSubs(ss => ss.map((s, i) => (i === oi ? { shown: false, base: 0 } : i === ni ? { shown: true, base: SUB_MOVE_LEAD_MS } : s)))
    const fromSub = zoneRef.current === 'sub'
    setSubFocus(f => ({ ...f, visible: false }))
    // side arrows slide out and come back once the panels have settled (inferred)
    setArrows(a => ({ mode: 'out', seq: a.seq }))
    later(MOVE_MS, () => {
      setPanels(ps => ps.map((p, i) => ({ ...p, shown: stateOf(slotOf(first + i, c2)) < 2 })))
      setFocusPanel(c2)
      setArrows(a => ({ mode: 'in', seq: a.seq + 1 }))
      // focus stays in the sub menu when it moved the carousel: the new panel's first item coming from
      // the left, its last coming from the right (OnFocusIn @02bd1464, event 0x11900f) (inferred)
      if (fromSub) {
        const items = subOf(list[c2 - first])
        if (items.length) {
          const idx = dir > 0 ? 0 : items.length - 1
          subFocusRef.current = idx
          setSubFocus({ index: idx, visible: true })
        } else setZone('content')
      }
      setPhase('idle')
    })
  }

  // Focus moving between the panel and the top menu: the active icon's overlay fades out and back in
  // with the other image (CHomeTopMenuWindow::OnFocusIn/OnFocusOut, callback_topicon_alpha_animation).
  function setTopFocus(top: boolean) {
    const was = zoneRef.current === 'top'
    setZone(top ? 'top' : 'content')
    if (was === top) return
    const ci = centreRef.current - first
    setOverlays(os => os.map((ov, i) => (i === ci ? { ...ov, alpha: 0, tr: `opacity ${HALF}ms linear` } : ov)))
    later(HALF, () =>
      setOverlays(os => os.map((ov, i) =>
        i === centreRef.current - first ? { img: zoneRef.current === 'top' ? 'focus' : 'selected', alpha: 1, tr: `opacity ${HALF}ms linear` } : ov)),
    )
  }

  // Into the sub menu from the panel (event 0x119011, sound 16): the focus box rises from y 1080
  // (AnimateSubmenuFocus case 3) on the first item.
  function enterSub(index = 0) {
    if (!subOf(centreType()).length) return false
    playUi(UI_SOUND.MOVE)
    setZone('sub')
    subFocusRef.current = index
    setSubFocus({ index, visible: true })
    return true
  }
  // Up out of the sub menu (case 2, sound 16, event 0x119012): the box drops and fades.
  function leaveSub() {
    playUi(UI_SOUND.MOVE)
    setSubFocus(f => ({ ...f, visible: false }))
    setZone('content')
  }

  // ---- closing (m_PlayExitWindow @02bb9c60) ----
  function exit() {
    setPhase('exit')
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
    // CHomeSubMenuWindow::OnBeginExitWindow: the sub menu slides down from 250 ms, 34 ms apart
    setSubs(ss => ss.map(() => ({ shown: false, base: EXIT_FIRST_MS })))
    setSubFocus(f => ({ ...f, visible: false }))
    later(EXIT_TOTAL_MS, close)
  }

  // ---- running an item (events 0x11901d-0x11901f -> OnMinimizeWindow, m_CompleteMinimizeMotion) ----
  // Panels fade out over 660 ms while the centred panel's items flip away, the top menu and arrows fade
  // over 500 ms, the sub menu slides away; from a sub menu item the colour tag grows from the button
  // into the top-left corner (type 2, CHomeSubMenuWindow::OnBeginMinimizeWindow @02bd1b2c). Then the
  // item runs (0x11901a -> CHomeExecutor) and Smart Hub gives way to it.
  function launch(run: () => void, kind: 'item' | 'submenu' = 'item') {
    if (phase.current === 'minimize' || phase.current === 'exit') return
    setPhase('minimize')
    minimized = { panel: centreType(), zone: zoneRef.current, sub: subFocusRef.current, body: bodyFocus.current.get(centreType()) }
    const lin = `${MIN_FLIP_MS}ms linear`
    setPanels(ps => ps.map(p => ({ ...p, alpha: 0, tr: `opacity ${lin}` })))
    // the centred panel's tables fold away (flip.tsx), the focus glow goes at once
    setFlip({ dir: 'out', t0: document.timeline.currentTime as number })
    setTopAlpha({ alpha: 0, tr: `opacity ${MIN_MS}ms linear` })
    setArrows(a => ({ mode: 'out', seq: a.seq }))
    // the other sub menu buttons slide down (220 ms each from 250 ms, 34 ms apart)
    setSubs(ss => ss.map(() => ({ shown: false, base: EXIT_FIRST_MS })))
    setSubFocus(f => ({ ...f, visible: false }))
    if (kind === 'submenu') setMinimize({ kind, sub: subFocusRef.current })
    later(Math.max(MIN_FLIP_MS, MIN_MS), () => {
      run()
      // nothing took over (no such application here): Smart Hub goes away as after a launch
      if (getForeground()?.id === 'smarthub' && phase.current === 'minimize') close()
    })
  }
  const launchItem = (run: () => void) => launch(run, 'item')
  const launchSub = (run: () => void) => launch(run, 'submenu')

  useRemote(key => {
    if (key === 'VolumeUp' || key === 'VolumeDown' || key === 'Mute' || key === 'Power') return false
    if (phase.current !== 'idle') return true // keys are dropped while an animation runs
    const z = zoneRef.current
    const type = centreType()
    const hasBody = !!bodyOf(type)
    switch (key) {
      case 'Left':
      case 'Right': {
        const dir = key === 'Left' ? -1 : 1
        if (z === 'sub') {
          // AnimateSubmenuFocus cases 4/5: along the buttons (sound 16); past the ends the panel moves
          const items = subOf(type)
          const j = subFocusRef.current + dir
          if (j >= 0 && j < items.length) {
            playUi(UI_SOUND.MOVE)
            subFocusRef.current = j
            setSubFocus({ index: j, visible: true })
            return true
          }
        }
        move(dir)
        return true
      }
      case 'Up':
        if (z === 'content') {
          playUi(UI_SOUND.MOVE)
          setTopFocus(true)
        } else if (z === 'sub') leaveSub()
        else playUi(UI_SOUND.NOKEY)
        return true
      case 'Down':
        if (z === 'top') {
          playUi(UI_SOUND.MOVE)
          setTopFocus(false)
        } else if (z === 'content' && hasBody) enterSub()
        else if (z === 'sub') playUi(UI_SOUND.NOKEY)
        return true
      case 'Enter':
        if (z === 'top') {
          playUi(UI_SOUND.MOVE)
          setTopFocus(false)
        } else if (z === 'sub') {
          // CHomeWindowInputListener::NotifyKeyPress, sub menu window: sound 8, then the item runs
          // (CHomeExecutor::ProcessExecutionSecondApp -> ExecuteSubMenuItem)
          playUi(UI_SOUND.SELECT)
          const i = subFocusRef.current
          if (!getOnlinePanelOptions(type).submenu?.(i, launchSub)) runOwnSubmenu(type, i, launchSub)
        } else if (!hasBody) onSetup() // CHomeDefaultPanelInputListener: event 0x119066 -> Smart Hub setup (0x523)
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
        if (zoneRef.current === 'sub') setSubFocus(f => ({ ...f, visible: false }))
        setTopFocus(true)
        if (d > 0) move(-1, d)
        else move(1, -d)
        return true
      }
      default:
        return NAV.has(key) || SWALLOW.has(key)
    }
  })

  // top icons: GBHOME_TOP_ICON_POS_X 670 + 116 per order index (even counts -58), drawn 1.5x (115.5 x 109.5)
  const iconW = 77 * HP_SCALE
  const iconLeft = (o: number) => 670 + TOP_ICON_GAP_X * o - (n % 2 === 0 ? 58 : 0)
  const labelLeft = (o: number) => TOP_TEXT_X + TOP_ICON_GAP_X * o - (n % 2 === 0 ? 58 : 0)
  const cp = PANELS[list[centre - first]]
  const ctype = list[centre - first]
  const citems = subOf(ctype)

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
            const Body = bodyOf(type)
            const isCentre = first + i === focusPanel
            return (
              <FlipContext.Provider key={i} value={first + i === centre ? flip : null}>
                <div
                  className="sh-panel"
                  style={{
                    transform: `translateZ(${-PIVOT_Z}px) rotateY(${p.rot}deg) translateZ(${PIVOT_Z}px) scale(${p.scale}, ${p.scale})`,
                    opacity: p.alpha,
                    transition: p.tr,
                    visibility: p.shown ? 'visible' : 'hidden',
                  }}
                >
                  {Body ? (
                    <BodyFocusContext.Provider value={bodyFocusOf(type)}>
                      <Body
                        active={idle && isCentre && zone === 'content'}
                        width={1920}
                        height={1080}
                        exitUp={() => {
                          if (zoneRef.current !== 'content' || phase.current !== 'idle') return
                          playUi(UI_SOUND.MOVE)
                          setTopFocus(true)
                        }}
                        exitDown={() => {
                          if (zoneRef.current !== 'content' || phase.current !== 'idle') return
                          if (!enterSub()) playUi(UI_SOUND.NOKEY)
                        }}
                        launch={launchItem}
                      />
                    </BodyFocusContext.Provider>
                  ) : (
                    <PromoPanel type={type} focused={zone === 'content' && isCentre} />
                  )}
                </div>
              </FlipContext.Provider>
            )
          })}
        </div>
      </div>
      {/* top menu: one icon per panel; the active one carries the selected (panel focused) or focus
          (top menu focused) image as an overlay; the panel name (size 34) under it */}
      <div className="sh-top" style={{ opacity: topAlpha.alpha, transition: topAlpha.tr }}>
        {list.map((type, i) => {
          const o = first + i
          const d = PANELS[type]
          const ic = icons[i]
          const ov = overlays[i]
          return (
            <div
              key={i}
              className="sh-top__icon"
              style={{ left: iconLeft(o), width: iconW, height: 73 * HP_SCALE, transform: `translateY(${ic.y}px)`, opacity: ic.alpha, transition: ic.tr }}
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
                color: d.nameColor, opacity: l.alpha, transition: `${l.tr}, top ${TOP_ANI_MS}ms linear`,
              }}
            >
              {d.name}
            </div>
          )
        })}
      </div>
      {list.map((type, i) => (
        <SubMenu
          key={`s${i}`}
          panel={type}
          items={subOf(type)}
          slide={subs[i]}
          focus={first + i === centre ? (minimize?.kind === 'submenu' ? { ...subFocus, visible: false } : subFocus) : { index: 0, visible: false }}
        />
      ))}
      {minimize?.kind === 'submenu' && citems.length > 0 && (
        <MinimizeTag panel={ctype} label={citems[minimize.sub]} x={SUB_X[citems.length][minimize.sub]} w={SUB_W[citems.length]} />
      )}
      <div style={{ opacity: topAlpha.alpha, transition: topAlpha.tr }}>
        <Arrows mode={arrows.mode} seq={arrows.seq} />
      </div>
    </div>
  )
}

// The colour tag growing out of the chosen sub menu button: from the button (x, 972, button width x
// 375) to 400 x 375 at the top-left corner over GBHOME_ANI_MINIMIZE_WINDOW_TOTAL_DURATION, its text box
// from (button x + 30, 1002) to (30, 30) while the text fades in from 167 ms
// (GBHOME_SUBMENU_COLOR_TAG_TEXT_ALPHA_ANIMATION_LEADTIME); the button's own label fades out in 167 ms.
function MinimizeTag({ panel, label, x, w }: { panel: number; label: string; x: number; w: number }) {
  const [go, setGo] = useState(false)
  useEffect(() => nextFrame(() => setGo(true)), [])
  const [top, bottom] = colorTagColors(panel)
  return (
    <ColorTag
      label={label}
      top={top}
      bottom={bottom}
      style={{
        left: go ? 0 : x, top: go ? 0 : SUB_Y, width: go ? 400 : w,
        transition: `left ${MIN_MS}ms linear, top ${MIN_MS}ms linear, width ${MIN_MS}ms linear`,
      }}
      textStyle={{
        opacity: go ? 1 : 0,
        transition: `opacity ${MIN_MS - 167}ms linear 167ms`,
      }}
    />
  )
}

// Side arrows (CHomeSideIndicatorWindow), 69x111 drawn 1.5x: three copies per side slide outward from
// GBHOME_ANI_ARROW_INIT_POS_X to GBHOME_ARROW_POS_X over 667 ms, 166 ms apart; copies 0 and 1 flash to
// alpha 0.35 and back to 0 (250 + 250 ms), copy 2 fades to 1 over 667 ms and stays. On a panel move
// copy 2 slides to GBHOME_DISAPPEARED_ARROW_POS_X and fades over 333 ms.
function Arrows({ mode, seq }: { mode: ArrowMode; seq: number }) {
  const size = { width: 69 * HP_SCALE, height: 111 * HP_SCALE }
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
                style={{ ...size, top: ARROW_Y, transform: `translateX(${ARROW_GONE_X[side]}px)`, opacity: 0, transition: 'transform 333ms linear, opacity 333ms linear' }}
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
                ...size,
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
