import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { F13 } from '../../assets'
import { depthOffset, OSD, panelW } from './osd'
import type { MenuItem } from './types'
import { getValue, optionText } from './values'

export const IMG = `${F13}/menu`

// Category icon files (CMenuMainWindow::t_SetCategoryItem: selected, normal, dim, + _opaque variants)
export const CAT_ICON: Record<number, string> = {
  0x14: '01_picture', 0x134: '02_sound', 0x1b6: '03_channel', 3: '04_network', 1: '05_smart', 2: '05_smart',
  0x2cc: '06_system', 0x6e4: '07_support',
}
// MenuAnimation sequences (CMenuUtil::m_Set*IconMotion): frames per strip
const ANIM: Record<string, string> = {
  '01_picture': 'picture', '02_sound': 'sound', '03_channel': 'channel', '04_network': 'network',
  '05_smart': 'smart', '06_system': 'system', '07_support': 'support',
}
const ANIM_FRAMES = { intro: 9, loop: 50, ending: 5 } as const
const SUPPORT_INTRO = 19

// renderer type -> [indent (title renderer +0x14), kind] (CMenuListRendererFinder::FindRenderer)
type Kind = 'title' | 'value' | 'string' | 'icon' | 'slider' | 'tint' | 'short'
const RENDER: Record<number, [number, Kind]> = {
  0: [0, 'title'], 1: [0, 'value'], 2: [0, 'string'], 3: [0, 'icon'], 4: [1, 'value'], 5: [1, 'string'],
  6: [0, 'slider'], 7: [1, 'slider'], 8: [0, 'tint'], 9: [1, 'tint'], 11: [1, 'title'], 12: [2, 'title'],
  13: [2, 'slider'], 14: [0, 'short'],
}

// Value shown by a container item that displays its child's value (sublist entry items)
export const VALUE_OF: Record<number, number> = { 0x23: 0x24, 0xdb: 0xdc, 0x519: 0x51a, 0x42: 0x43, 0x64: 0x65, 0x197: 0x198, 0x297: 0x298 }

export function findItem(root: MenuItem[], id: number): MenuItem | undefined {
  for (const it of root) {
    if (it.id === id) return it
    const k = it.k && findItem(it.k, id)
    if (k) return k
  }
  return undefined
}

// ---- category list ----

// CMenuCategoryRendererAni: prologue (alpha in, 300 ms) -> intro (18 fps) -> loop (25 fps) while the
// item is focused in the active category list; ending (10 fps) when the focus leaves.
export function CategoryIcon({ base, state, img }: { base: string; state: 'focus' | 'idle'; img: string }) {
  const [seq, setSeq] = useState<'none' | 'intro' | 'loop' | 'ending'>('none')
  const [frame, setFrame] = useState(0)
  const [alpha, setAlpha] = useState(0)
  const prev = useRef(state)
  useEffect(() => {
    if (state === 'focus') {
      setSeq('intro')
      setFrame(0)
      setAlpha(0)
      requestAnimationFrame(() => requestAnimationFrame(() => setAlpha(1)))
    } else if (prev.current === 'focus') {
      setSeq('ending')
      setFrame(0)
    }
    prev.current = state
  }, [state])
  useEffect(() => {
    if (seq === 'none') return
    const n = seq === 'intro' && base === '07_support' ? SUPPORT_INTRO : ANIM_FRAMES[seq]
    const fps = seq === 'intro' ? OSD.ICON_FPS_INTRO : seq === 'loop' ? OSD.ICON_FPS_LOOP : OSD.ICON_FPS_END
    const delay = seq === 'intro' ? OSD.ICON_PROLOGUE_MS : 0
    let f = 0
    let t: ReturnType<typeof setTimeout>
    const step = () => {
      f++
      if (f >= n) {
        if (seq === 'intro') return setSeq('loop')
        if (seq === 'ending') return setSeq('none')
        f = 0
      }
      setFrame(f)
      t = setTimeout(step, 1000 / fps)
    }
    t = setTimeout(step, delay + 1000 / fps)
    return () => clearTimeout(t)
  }, [seq, base])
  const n = seq === 'intro' && base === '07_support' ? SUPPORT_INTRO : seq === 'none' ? 1 : ANIM_FRAMES[seq]
  return (
    <div className="m13-caticon">
      {seq === 'none' && <img src={`${IMG}/${img}.png`} alt="" />}
      {seq !== 'none' && (
        <div
          className="m13-caticon-anim"
          style={{
            backgroundImage: `url(${IMG}/anim_${ANIM[base]}_${seq}.png)`,
            backgroundSize: `${n * OSD.CAT_ICON}px ${OSD.CAT_ICON}px`,
            backgroundPosition: `${-frame * OSD.CAT_ICON}px 0`,
            opacity: seq === 'intro' ? alpha : 1,
            transition: seq === 'intro' ? `opacity ${OSD.ICON_PROLOGUE_MS}ms cubic-bezier(0.3,0,0.7,1)` : undefined,
          }}
        />
      )}
    </div>
  )
}

// ---- menu list rows ----

// CMenuTitleRenderer::t_GetFontColor(focused, drawing state, enabled)
function fontColor(focused: boolean, state: number, enabled: boolean) {
  if (!enabled) return OSD.WHITE_DIM
  if (state === 0) return focused ? OSD.YELLOW_DIM : OSD.WHITE_DIM
  return focused ? OSD.YELLOW : OSD.WHITE
}

function Slider({ it, value, x, w, active }: { it: MenuItem; value: number; x: number; w: number; active: boolean }) {
  const [min, max] = it.v ?? [0, 100]
  const f = max > min ? (value - min) / (max - min) : 0
  return (
    <div className={`m13-slider${active ? '' : ' m13-slider--dim'}`} style={{ left: x, width: w, top: (OSD.ITEM_H - OSD.SLIDER_H) / 2 }}>
      <div className="m13-slider-fill" style={{ width: Math.max(0, Math.round(w * f)) }} />
    </div>
  )
}

export function Row({ it, level, focused: f, state }: { it: MenuItem; level: number; focused: boolean; state: number }) {
  const focused = f && state !== 3   // the preview list (category focus) draws no focus
  const [indent, kind] = RENDER[it.r ?? 0] ?? [0, 'title']
  const enabled = it.en !== false
  const color = fontColor(focused, state, enabled)
  const dOff = depthOffset(level)
  const titleW = kind === 'title' ? OSD.TEXT_TITLE_ONLY_W : OSD.TEXT_TITLE_W
  const valueItem = VALUE_OF[it.id] ? { ...it, id: VALUE_OF[it.id] } : it
  const value = getValue(valueItem)
  let right: string | null = null
  if (kind === 'string') right = optionText(it, value)
  if (kind === 'value' || kind === 'slider' || kind === 'short') right = String(value)
  if (kind === 'tint') right = `R${value}`
  const textStyle: CSSProperties = { color }
  return (
    <div className="m13-row" style={{ height: OSD.ITEM_H }}>
      {indent > 0 && (
        <img
          className="m13-dot"
          src={`${IMG}/${focused && state === 1 && enabled ? 'setting_list_dot_s' : 'setting_list_dot'}.png`}
          style={{ left: OSD.DOT_OFFSET * indent + OSD.DOT_X + dOff * 0, opacity: enabled && state !== 0 ? 1 : 0.498 }}
          alt=""
        />
      )}
      <div
        className="m13-row-title"
        style={{ ...textStyle, left: OSD.TEXT_TITLE_X + OSD.DOT_OFFSET * indent, width: titleW - OSD.DOT_OFFSET * indent }}
      >
        {it.t}
      </div>
      {(kind === 'slider' || kind === 'short' || kind === 'tint') && (
        <Slider it={it} value={value} x={OSD.SLIDER_X + dOff} w={kind === 'short' ? OSD.SLIDER_SHORT_W : OSD.SLIDER_W} active={enabled && (state !== 0 || focused)} />
      )}
      {kind === 'tint' && (
        <div className="m13-row-value m13-row-value--left" style={{ ...textStyle, left: OSD.TINT_LEFT_X + dOff, width: OSD.TINT_TEXT_W }}>
          {`G${(it.v?.[1] ?? 100) - value}`}
        </div>
      )}
      {right !== null && (
        <div className="m13-row-value" style={{ ...textStyle, left: OSD.TEXT_RIGHT_X + dOff, width: OSD.TEXT_RIGHT_W }}>
          {right}
        </div>
      )}
    </div>
  )
}

// A menu list panel (CMenuMainWindow::t_CreateMenuList): blue_panel composite, title, 7-row list with
// set_list_high focus box and up/down cue arrows.
export function Panel({ title, items, level, focus, top, state, x, alpha, contentAlpha, ease, dur, bgAlpha }: {
  title: string; items: MenuItem[]; level: number; focus: number; top: number; state: number
  x: number; alpha: number; contentAlpha: number; ease: string; dur: number; bgAlpha: number
}) {
  const w = panelW(level)
  const shown = items.slice(top, top + OSD.VISIBLE)
  return (
    <div
      className="m13-panel"
      style={{ left: x, width: w, opacity: alpha, transition: `left ${dur}ms ${ease}, opacity ${dur}ms ${ease}` }}
    >
      <div className="m13-panel-bg" style={{ opacity: bgAlpha }} />
      <div className="m13-panel-content" style={{ opacity: contentAlpha, transition: `opacity ${OSD.BLUE_NORMAL_POS_MS}ms` }}>
        <div className="m13-panel-title" style={{ left: OSD.TITLE_X, top: OSD.TITLE_Y, width: OSD.TITLE_W, height: OSD.TITLE_H }}>{title}</div>
        <div className="m13-list" style={{ top: OSD.LIST_Y, height: OSD.LIST_H, width: w }}>
          {state === 1 && focus >= top && focus < top + OSD.VISIBLE && (
            <div className="m13-focus" style={{ top: OSD.LIST_MARGIN_TOP + (focus - top) * OSD.ITEM_H + (OSD.ITEM_H - 82) / 2, width: w }} />
          )}
          {state === 0 && focus >= top && focus < top + OSD.VISIBLE && (
            <div
              className="m13-pressed"
              style={{ top: OSD.LIST_MARGIN_TOP + (focus - top) * OSD.ITEM_H, width: OSD.PRESSED_W + depthOffset(level), height: OSD.ITEM_H }}
            />
          )}
          {shown.map((it, i) => (
            <div key={it.id + ':' + i} className="m13-row-wrap" style={{ top: OSD.LIST_MARGIN_TOP + i * OSD.ITEM_H, width: w }}>
              <Row it={it} level={level} focused={top + i === focus} state={state} />
            </div>
          ))}
          {state === 1 && top > 0 && <img className="m13-cue" src={`${IMG}/act_arrow_up_nor.png`} style={{ left: (w - 42) / 2, top: 0 }} alt="" />}
          {state === 1 && top + OSD.VISIBLE < items.length && (
            <img className="m13-cue" src={`${IMG}/act_arrow_down_nor.png`} style={{ left: (w - 42) / 2, top: OSD.LIST_H - 29 }} alt="" />
          )}
        </div>
      </div>
    </div>
  )
}

// CMenuHelpWindow / CHelpWindow::t_SetHelpContent: help text at (21, 26), then the item's children as
// a sub-item list (icon_help_dot belt + light blue 20 px text, 32 px rows).
export function Help({ item, dim }: { item?: MenuItem; dim: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [textH, setTextH] = useState(0)
  useEffect(() => {
    setTextH(ref.current ? ref.current.offsetHeight : 0)
  }, [item])
  if (!item) return null
  const subs = (item.k ?? []).map(k => k.t)
  const subTop = (item.h ? OSD.HELP_TOP_GAP + textH : 0) + OSD.HELP_TEXT_SUB_GAP + OSD.HELP_SUB_MARGIN_H
  const max = Math.max(0, Math.floor((OSD.HELP_H - subTop - OSD.HELP_SUB_BOTTOM_GAP) / OSD.HELP_SUB_H))
  return (
    <div className="m13-help" style={{ opacity: dim ? OSD.ALPHA_THIRTY : 1 }}>
      {item.h && (
        <div ref={ref} className="m13-help-text" style={{ left: OSD.HELP_MARGIN, top: OSD.HELP_TOP_GAP, width: OSD.HELP_W - 2 * OSD.HELP_MARGIN }}>
          {item.h}
        </div>
      )}
      {subs.slice(0, max).map((s, i) => (
        <div key={i} className="m13-help-sub" style={{ top: subTop + i * OSD.HELP_SUB_H }}>
          <img src={`${IMG}/icon_help_dot.png`} style={{ left: OSD.HELP_SUB_BELT_X }} alt="" />
          <div style={{ left: OSD.HELP_SUB_TEXT_X, width: OSD.HELP_SUB_W - OSD.HELP_SUB_TEXT_X + OSD.HELP_SUB_BELT_X }}>{s}</div>
        </div>
      ))}
    </div>
  )
}
