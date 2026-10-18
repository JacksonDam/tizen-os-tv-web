import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import type { AppProps } from '../../shell'
import { closeApp, openApp } from '../../shell'
import { playUi, UI_SOUND } from '../../tv/sound'
import { resetTv, setTv, useTv } from '../../tv/store'
import { powerOff, powerOn } from '../setup/power'
import { OSD, panelX, TRANSPARENCY_ALPHA } from './osd'
import { CAT_ICON, CategoryIcon, Help, Panel } from './parts'
import { CATEGORIES } from './tree.gen'
import type { MenuItem } from './types'
import { dimReason, itemAction } from './actions'
import { Widgets, type Widget } from './widgets'

// The 2013 Menu (exeDSP CMenuApp / CMenuMainWindowAni). Category list on the left, menu list panels
// ("blue windows") stacked to its right, help window on the far right while a list has the focus.
//   category focus: Up/Down move, Right/OK enter the list, Left/Return/Exit/MENU close
//   list focus:     Up/Down move, Right/OK run the item, Left/Return back, Exit/MENU close
// (CMenuMainWindow::t_OnCategoryKeyPress / t_OnMenuListKeyPress)

type Level = { item: MenuItem; focus: number; top: number }

// CCAnimation acceleration types (1,1)/(0,2)/(2,0) with factor 0.3 (inferred curves)
const EASE_INOUT = 'cubic-bezier(0.3,0,0.7,1)'
const EASE_OUT = 'cubic-bezier(0,0,0.7,1)'

// params: { page } a list to open on ('network-settings', or an item title such as 'Anynet+ (HDMI-CEC)');
// { item, firmwareItem } an item to run straight away (Tools, Channel List); { path } item ids to
// reopen at (return from Auto Tuning); { from } where to return when the Menu closes.
export type MenuParams = { page?: string; from?: string; item?: string; firmwareItem?: number; path?: number[] }

function visible(items: MenuItem[]) {
  return items
}

export function MenuApp({ params }: AppProps) {
  const p = (params ?? {}) as MenuParams
  const transparency = useTv(s => s.settings['menu.958'])
  const settingsSeq = useTv(s => s.settings)
  const cats = CATEGORIES
  const [cat, setCat] = useState(0)
  const [area, setArea] = useState<'cat' | 'list'>('cat')
  const [levels, setLevels] = useState<Level[]>([])
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)  // 0 hidden, 1 bg+panel fade in at START_X, 2 panel moving to STOP_X, 3 open
  const [anim, setAnim] = useState<{ x0: number; dur: number; ease: string }>({ x0: OSD.PANEL_START_X, dur: OSD.BLUE_START_ALPHA_MS, ease: EASE_INOUT })
  const [busy, setBusy] = useState(false)
  const [helpOn, setHelpOn] = useState(false)
  const [widget, setWidget] = useState<Widget | null>(null)
  const [, setTick] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((ms: number, f: () => void) => {
    timers.current.push(setTimeout(f, ms))
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const level0 = useMemo<Level>(() => ({ item: cats[cat], focus: 0, top: 0 }), [cats, cat])
  const stack = levels.length ? levels : [level0]
  const depth = levels.length ? levels.length - 1 : 0
  const cur = stack[depth]
  const curItems = visible(cur.item.k ?? [])
  const focusedItem = area === 'list' ? curItems[cur.focus] : undefined
  void settingsSeq

  // ---- opening (CMenuMainWindowAni::t_ProcessShowMainWindow) ----
  const direct = useRef(false)
  useEffect(() => {
    // direct access (CMenuMainWindow::t_ShowMainWindow(1, ...)): open on the list, no category intro
    let target: [number, MenuItem[]] | null = null
    if (p.page === 'network-settings') target = findPath(cats, it => it.id === 0x4d)
    else if (p.page) target = findPath(cats, it => it.t === p.page)
    else if (p.item) target = findPath(cats, it => it.t === p.item)
    else if (p.path?.length) target = findPath(cats, it => it.id === p.path![p.path!.length - 1])
    if (target) {
      const [ci, chain] = target
      direct.current = true
      setCat(ci)
      const isPage = !!p.page && p.page !== 'network-settings' && chain[chain.length - 1].k?.length
      const lv = levelsFor(cats[ci], isPage ? chain : chain)
      if (isPage) lv.push({ item: chain[chain.length - 1], focus: 0, top: 0 })
      setLevels(lv)
      setArea('list')
      setAnim({ x0: OSD.PANEL_START_X, dur: 0, ease: EASE_INOUT })
      setPhase(3)
      setHelpOn(true)
      const last = chain[chain.length - 1]
      if (p.item || p.page === 'network-settings') {
        const container = lv[lv.length - 1].item
        const w = itemAction(last, { close, enterChild: () => {}, refresh: () => setTick(t => t + 1), siblings: container.k ?? [], factoryReset })
        if (w) setWidget(w)
      }
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase(1)))
    later(OSD.BLUE_ALPHA_POS_GAP_MS, () => {
      setAnim({ x0: OSD.PANEL_STOP_X, dur: OSD.BLUE_START_POS_MS, ease: EASE_INOUT })
      setPhase(2)
    })
    later(OSD.BLUE_ALPHA_POS_GAP_MS + OSD.BLUE_START_POS_MS, () => setPhase(3))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    closeApp('menu')
    if (p.from === 'smarthub') openApp('smarthub')
  }, [p.from])

  // ---- focus changes ----
  const enterList = () => {
    // CMenuMainWindowAni::t_AfterFocusChangeCategoryToMenuList: panel STOP_X -> START_X (256 ms)
    setArea('list')
    setLevels([{ ...level0 }])
    setBusy(true)
    setAnim({ x0: OSD.PANEL_START_X, dur: OSD.BLUE_NORMAL_POS_MS, ease: EASE_INOUT })
    later(OSD.BLUE_NORMAL_POS_MS, () => {
      setBusy(false)
      setHelpOn(true)
    })
  }
  const backToCategory = () => {
    // t_AfterFocusChangeMenuListToCategory: panel START_X -> STOP_X, help hides
    setArea('cat')
    setHelpOn(false)
    setLevels([])
    setBusy(true)
    setAnim({ x0: OSD.PANEL_STOP_X, dur: OSD.BLUE_NORMAL_POS_MS, ease: EASE_INOUT })
    later(OSD.BLUE_NORMAL_POS_MS, () => setBusy(false))
  }
  const enterChild = (it: MenuItem) => {
    if (depth >= 4 || !it.k) return
    setLevels(ls => [...(ls.length ? ls : [level0]), { item: it, focus: Math.max(0, it.k!.findIndex(k => k.en !== false)), top: 0 }])
    setBusy(true)
    later(OSD.BLUE_NORMAL_POS_MS, () => setBusy(false))
  }
  const backToParent = () => {
    setLevels(ls => ls.slice(0, -1))
    setBusy(true)
    later(OSD.BLUE_NORMAL_POS_MS, () => setBusy(false))
  }
  const move = (d: number) => {
    const items = curItems
    const f = cur.focus + d
    if (f < 0 || f >= items.length) return
    // CSingleLineListWidget skips items whose focus is unavailable? dimmed items stay focusable.
    let top = cur.top
    if (f < top) top = f
    if (f >= top + OSD.VISIBLE) top = f - OSD.VISIBLE + 1
    setLevels(ls => ls.map((l, i) => (i === ls.length - 1 ? { ...l, focus: f, top } : l)))
    playUi(UI_SOUND.MOVE)
  }
  const runItem = (it: MenuItem) => {
    playUi(UI_SOUND.SELECT)
    if (it.en === false) {
      setWidget(dimReason(it))
      return
    }
    const w = itemAction(it, {
      close,
      enterChild,
      refresh: () => setTick(t => t + 1),
      siblings: curItems,
      factoryReset: () => factoryReset(),
    })
    if (w) setWidget(w)
  }

  useRemote((key: RemoteKey) => {
    if (widget) return false
    if (phase < 3 || busy) return key !== 'VolumeUp' && key !== 'VolumeDown'
    if (key === 'Exit' || key === 'Settings') {
      close()
      return true
    }
    if (area === 'cat') {
      if (key === 'Up' || key === 'Down') {
        const n = cat + (key === 'Up' ? -1 : 1)
        if (n >= 0 && n < cats.length) {
          setCat(n)
          playUi(UI_SOUND.MOVE)
        }
        return true
      }
      if (key === 'Right' || key === 'Enter') {
        if (key === 'Enter') playUi(UI_SOUND.SELECT)
        if ((cats[cat].k ?? []).length) enterList()
        return true
      }
      if (key === 'Left' || key === 'Back') {
        close()
        return true
      }
      return key !== 'Home' ? true : false
    }
    if (key === 'Up' || key === 'Down') {
      move(key === 'Up' ? -1 : 1)
      return true
    }
    if (key === 'Right' || key === 'Enter') {
      const it = curItems[cur.focus]
      if (it) runItem(it)
      return true
    }
    if (key === 'Left' || key === 'Back') {
      if (depth < 1) backToCategory()
      else backToParent()
      return true
    }
    return key !== 'Home' ? true : false
  })

  const alphaBg = TRANSPARENCY_ALPHA[Number(transparency ?? 1)] ?? TRANSPARENCY_ALPHA[1]
  const listFocused = area === 'list'
  const hidden = !!widget && (widget.kind === 'sliderAW' || widget.kind === 'sublistAW')
  const dimmed = !!widget && !hidden

  return (
    <div className="m13-osd">
      <div className="m13-scene" style={{ left: OSD.SCENE_X, top: OSD.SCENE_Y, width: OSD.SCENE_W, height: OSD.SCENE_H, visibility: hidden ? 'hidden' : 'visible' }}>
        {/* back panel */}
        <div className="m13-back" style={{ opacity: phase >= 1 ? 1 : 0, transition: `opacity ${OSD.MAIN_BG_ALPHA_MS}ms ${EASE_INOUT}` }}>
          <div className="m13-back-shadow" style={{ left: OSD.BACK_IMG_X, top: OSD.BACK_IMG_Y, width: OSD.BACK_IMG_W, height: OSD.BACK_IMG_H }} />
          <div
            className="m13-back-frame"
            style={{ left: OSD.BACK_IMG_X + OSD.BACK_IMG_GAP, top: OSD.BACK_IMG_Y + OSD.BACK_IMG_GAP, width: OSD.BACK_IMG_W - 2 * OSD.BACK_IMG_GAP, height: OSD.BACK_IMG_H - 2 * OSD.BACK_IMG_GAP }}
          />
          <div
            className="m13-back-black"
            style={{
              left: OSD.BACK_IMG_X + OSD.BACK_IMG_GAP + OSD.MENU_3_UNIT, top: OSD.BACK_IMG_Y + OSD.BACK_IMG_GAP + OSD.MENU_3_UNIT,
              width: OSD.BACK_IMG_W - 2 * (OSD.BACK_IMG_GAP + OSD.MENU_3_UNIT), height: OSD.BACK_IMG_H - 2 * (OSD.BACK_IMG_GAP + OSD.MENU_3_UNIT),
              opacity: alphaBg,
            }}
          />
        </div>

        {/* category list */}
        <div className="m13-cats" style={{ width: OSD.CAT_W, height: OSD.CAT_H, opacity: phase >= 3 ? 1 : 0, transition: `opacity ${OSD.CAT_TEXT_ALPHA_MS}ms` }}>
          {area === 'cat' && !widget && (
            <div className="m13-cat-hl" style={{ top: OSD.CAT_MARGIN_TOP + cat * itemH() + (itemH() - 68) / 2 }} />
          )}
          {cats.map((c, i) => {
            const base = CAT_ICON[c.id]
            const focused = i === cat
            const disabled = c.en === false
            const opaque = !!widget
            const img = `${base}_${disabled ? 'dim' : focused && (area === 'list' || area === 'cat') ? 'selected' : 'normal'}${opaque ? '_opaque' : ''}`
            const textColor = disabled || opaque ? OSD.SEMI_WHITE : focused && area === 'cat' ? OSD.YELLOW : OSD.WHITE
            return (
              <div key={c.id} className="m13-cat" style={{ top: OSD.CAT_MARGIN_TOP + i * itemH(), height: itemH() }}>
                <div style={{ position: 'absolute', left: OSD.CAT_ICON_X, top: (itemH() - OSD.CAT_ICON) / 2 }}>
                  <CategoryIcon base={base} img={img} state={focused && area === 'cat' && phase >= 3 && !widget ? 'focus' : 'idle'} />
                </div>
                <div
                  className="m13-cat-text"
                  style={{ left: OSD.CAT_TEXT_X, width: OSD.CAT_TEXT_W, height: itemH(), color: textColor, opacity: area === 'cat' ? 1 : 0, transition: `opacity ${OSD.CAT_TEXT_ALPHA_MS}ms ${area === 'cat' ? 'cubic-bezier(0.3,0,1,1)' : EASE_OUT}` }}
                >
                  {c.t}
                </div>
              </div>
            )
          })}
        </div>

        {/* menu list panels */}
        {stack.map((l, i) => {
          const top = i === stack.length - 1
          const x = i === 0 ? (top ? anim.x0 : panelX(0, false)) : top ? panelX(i, true) : panelX(i, false)
          const state = !top ? 0 : area === 'list' ? (widget ? 0 : 1) : 3
          return (
            <Panel
              key={`${i}:${l.item.id}`}
              title={l.item.t}
              items={visible(l.item.k ?? [])}
              level={i}
              focus={l.focus}
              top={l.top}
              state={state}
              x={i === 0 ? x : x}
              alpha={i === 0 ? (phase >= 1 ? 1 : 0) : 1}
              contentAlpha={top ? 1 : 0}
              ease={EASE_INOUT}
              dur={i === 0 ? anim.dur : OSD.BLUE_NORMAL_POS_MS}
              bgAlpha={top && dimmed ? OSD.ALPHA_THIRTY : 1}
            />
          )
        })}

        {/* help window */}
        <div className="m13-help-host" style={{ left: OSD.HELP_X, top: OSD.HELP_Y, width: OSD.HELP_W, height: OSD.HELP_H }}>
          {listFocused && helpOn && !busy && <Help item={focusedItem} dim={dimmed} />}
        </div>

      </div>
      {widget && (
        <div className="m13-widgets" style={{ left: hidden ? 0 : OSD.SCENE_X, top: hidden ? 0 : OSD.SCENE_Y }}>
          <Widgets
            widget={widget}
            level={depth}
            row={cur.focus - cur.top}
            onClose={() => {
              setWidget(null)
              if (p.from === 'tools' && direct.current) close()
            }}
            onExitMenu={close}
            onChange={w => setWidget(w)}
            onValue={() => setTick(t => t + 1)}
          />
        </div>
      )}
    </div>
  )
}

// Self Diagnosis > Reset (CMenuMainWidgetAgency::t_OnFactoryResetAlarmCallback): factory state, empty
// channel list, then the TV turns off and on again and Plug & Play runs on that power-on.
function factoryReset() {
  resetTv()
  setTv({ channels: [], setupDone: false })
  powerOff()
  setTimeout(() => powerOn(), 1000)
}

// Deep links: find the path (category index + item chain) to the first item matching `pred`.
function findPath(cats: MenuItem[], pred: (it: MenuItem) => boolean): [number, MenuItem[]] | null {
  const walk = (items: MenuItem[], chain: MenuItem[]): MenuItem[] | null => {
    for (const it of items) {
      if (pred(it)) return [...chain, it]
      if (it.k) {
        const r = walk(it.k, [...chain, it])
        if (r) return r
      }
    }
    return null
  }
  for (let i = 0; i < cats.length; i++) {
    const r = walk(cats[i].k ?? [], [])
    if (r) return [i, r]
  }
  return null
}

// Levels for a path: each container's list focused on the next item of the path.
function levelsFor(cat: MenuItem, chain: MenuItem[]): Level[] {
  const out: Level[] = []
  let container = cat
  for (const it of chain) {
    const items = container.k ?? []
    const focus = Math.max(0, items.indexOf(it))
    out.push({ item: container, focus, top: Math.max(0, focus - OSD.VISIBLE + 1) })
    if (!it.k || it === chain[chain.length - 1]) break
    container = it
  }
  return out
}

function itemH() {
  return (OSD.CAT_H - 2 * OSD.CAT_MARGIN_TOP) / OSD.CAT_COUNT
}


