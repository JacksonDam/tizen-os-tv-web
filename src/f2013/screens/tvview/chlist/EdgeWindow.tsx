import { useEffect, useRef, useState } from 'react'
import { argb } from '../common'
import { C, DISABLE_ALPHA, EDGE_MS, EDGE_WINDOW_BG_ALPHA, L } from './layout'
import { S, type EdgeItem } from './model'
import { AniText, Composite, Pic } from './parts'

// CChannelListEdgeWindow: "Sorting" (left key) at x 1182 hinged on its left edge, "Mode" (right key)
// at x 1428 hinged on the right edge of the screen (m_CreateAnimationObject puts the window under a
// pivot object at CHLIST_EDGE_PIVOT_LEFT_X / RIGHT_X, y 540). m_AnimationShow turns it in from
// -90 / +90 degrees about the vertical axis while the motion alpha goes 0 -> 255 (350 ms);
// m_AnimationHide turns it back out. The 3D camera of the scene is not in the callers: the CSS
// perspective (1920 px from the stage centre) and the sense of rotation (swinging in from behind the
// list) are inferred.
export type EdgeKind = 'sorting' | 'mode'

export function EdgeWindow({ kind, items, focus, leaving, onGone }: {
  kind: EdgeKind
  items: EdgeItem[]
  focus: number
  leaving: boolean
  onGone: () => void
}) {
  const [open, setOpen] = useState(false)
  const gone = useRef(onGone)
  gone.current = onGone
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    return () => cancelAnimationFrame(r)
  }, [])
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => gone.current(), EDGE_MS)
    return () => clearTimeout(t)
  }, [leaving])

  const left = kind === 'sorting'
  const x = left ? L.EDGE_WINDOW_LEFT_X : L.EDGE_WINDOW_RIGHT_X
  const shown = open && !leaving
  const angle = shown ? 0 : left ? 90 : -90
  const enabled = !leaving
  const rows = Math.floor((1080 - L.EDGE_LIST_MARGIN_TOP - L.EDGE_LIST_MARGIN_BOTTOM) / L.EDGE_ITEM_H)
  const top = Math.max(0, Math.min(focus - rows + 1, items.length - rows))
  const visible = items.slice(top, top + rows)

  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 1920, perspectiveOrigin: '960px 540px' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          width: L.EDGE_WINDOW_W,
          height: 1080,
          transformOrigin: left ? '0 50%' : '100% 50%',
          transform: `rotateY(${angle}deg)`,
          opacity: shown ? 1 : 0,
          // rotation: types 0/2 (decelerating), alpha: types 1/1 (inferred curves)
          transition: `transform ${EDGE_MS}ms cubic-bezier(0.2,0.6,0.3,1), opacity ${EDGE_MS}ms ease-in-out`,
        }}
      >
        {/* m_CreateAndShowBG: sorting_mode_bg (alpha 230), sorting_ch_top_line under the title */}
        <Pic src="ChannelList/sorting_mode_bg.bmp" x={0} y={0} style={{ opacity: EDGE_WINDOW_BG_ALPHA }} />
        <Pic src="ChannelList/sorting_ch_top_line.bmp" x={0} y={L.EDGE_TITLE_H} />
        {/* m_CreateAndShowTitle / m_SetTitleText: "Sorting" (string 30) or "Mode" (string 9), 48 px */}
        <AniText text={left ? S.SORTING : S.MODE} x={L.EDGE_TITLE_X} y={0} w={L.EDGE_TITLE_W} h={L.EDGE_TITLE_H} size={L.EDGE_TITLE_FONT_SIZE} color={C.WHITE} />
        {enabled && items.length > 0 && (
          <Composite
            src="Common/list_highlight.bmp"
            iw={82}
            ih={85}
            x={L.EDGE_LIST_MARGIN_LEFT + (L.EDGE_ITEM_W - L.EDGE_LIST_FOCUS_W) / 2}
            y={L.EDGE_LIST_MARGIN_TOP + (focus - top) * L.EDGE_ITEM_H + (L.EDGE_ITEM_H - L.EDGE_LIST_FOCUS_H) / 2}
            w={L.EDGE_LIST_FOCUS_W}
            h={L.EDGE_LIST_FOCUS_H}
          />
        )}
        {visible.map((it, i) => (
          <Item key={it.key} item={it} y={L.EDGE_LIST_MARGIN_TOP + i * L.EDGE_ITEM_H} focused={enabled && top + i === focus} widgetEnabled={enabled} />
        ))}
        {top > 0 && <Pic src="AppCM/act_arrow_up_nor.bmp" x={L.EDGE_LIST_ARROW_X} y={L.EDGE_LIST_ARROW_UP_Y} />}
        {top + rows < items.length && <Pic src="AppCM/act_arrow_down_nor.bmp" x={L.EDGE_LIST_ARROW_X} y={L.EDGE_LIST_ARROW_DOWN_Y} />}
      </div>
    </div>
  )
}

// CChannelListEdgeRenderer::Draw (0x029be904): tick (ch_sublist_check) on the current choice, the
// name (38 px, white; yellow when focused), the value for pop-up items (32 px, CHLIST_FONT_COLOR_BLUE,
// right-aligned in the right half), the separator line under flagged items. A disabled item, or any
// item while the window is disabled, is drawn white at CHLIST_DISABLE_ALPHA.
function Item({ item, y, focused, widgetEnabled }: { item: EdgeItem; y: number; focused: boolean; widgetEnabled: boolean }) {
  const dim = !item.enabled || !widgetEnabled
  const alpha = dim ? DISABLE_ALPHA : 1
  const nameColor = !dim && focused ? C.YELLOW : C.WHITE
  return (
    <div style={{ position: 'absolute', left: L.EDGE_LIST_MARGIN_LEFT, top: y, width: L.EDGE_ITEM_W, height: L.EDGE_ITEM_H }}>
      {item.checked && <Pic src="ChannelList/ch_sublist_check.bmp" x={L.EDGE_ITEM_CHECK_X} y={L.EDGE_ITEM_CHECK_Y} style={{ opacity: alpha }} />}
      <AniText
        text={item.name}
        x={L.EDGE_ITEM_NAME_X}
        y={0}
        w={item.value ? L.EDGE_ITEM_NAME_W - L.ITEM_CHANNEL_GAP - L.EDGE_ITEM_NAME_W / 2 : L.EDGE_ITEM_NAME_W}
        h={L.EDGE_ITEM_H}
        size={L.EDGE_ITEM_NAME_FONT_SIZE}
        color={nameColor}
        scroll={focused && !dim}
        opacity={alpha}
      />
      {item.value && (
        <AniText
          text={item.value}
          x={L.EDGE_ITEM_VALUE_X}
          y={0}
          w={L.EDGE_ITEM_NAME_W / 2}
          h={L.EDGE_ITEM_H}
          size={L.POPUP_FONT_SIZE}
          color={!dim && focused ? C.YELLOW : C.BLUE}
          align="right"
          opacity={alpha}
        />
      )}
      {item.separator && (
        <div
          style={{
            position: 'absolute',
            left: L.EDGE_ITEM_LINE_X,
            top: L.EDGE_ITEM_LINE_Y,
            width: L.EDGE_ITEM_LINE_W,
            height: L.EDGE_ITEM_LINE_H,
            background: argb(C.EDGE_BOUNDARYLINE),
          }}
        />
      )}
    </div>
  )
}
