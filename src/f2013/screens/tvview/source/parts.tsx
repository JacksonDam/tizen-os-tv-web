import type { CSSProperties, ReactNode } from 'react'
import { IMG_SCALE, img } from '../common'

// A firmware bitmap drawn as a 9-slice (CCImageCompositeDrawing with 9 rects) at stage rect
// (x, y, w, h). Slices are in bitmap pixels (the 1280-OSD image); they are drawn x1.5 like the bitmap.
export function Nine({ src, x, y, w, h, t, r, b, l, style, children }: {
  src: string
  x: number
  y: number
  w: number
  h: number
  t: number
  r: number
  b: number
  l: number
  style?: CSSProperties
  children?: ReactNode
}) {
  const s = IMG_SCALE
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderStyle: 'solid',
        borderWidth: `${t * s}px ${r * s}px ${b * s}px ${l * s}px`,
        borderImageSource: `url(${img(src)})`,
        borderImageSlice: `${t} ${r} ${b} ${l} fill`,
        borderImageRepeat: 'stretch',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// A text drawing in a stage box with the engine's alignment (CCDrawing::t_GetAlignedPosition:
// H 0 left, 1 centre, 2 right; V 3 top, 4 middle, 5 bottom).
export function Text({ x, y, w, h, size, color, h_align = 0, v_align = 4, children, style }: {
  x: number
  y: number
  w: number
  h: number
  size: number
  color: string
  h_align?: 0 | 1 | 2
  v_align?: 3 | 4 | 5
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        display: 'flex',
        alignItems: v_align === 3 ? 'flex-start' : v_align === 5 ? 'flex-end' : 'center',
        justifyContent: h_align === 0 ? 'flex-start' : h_align === 2 ? 'flex-end' : 'center',
        fontSize: size,
        color,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{children}</span>
    </div>
  )
}

// A bitmap at stage rect (x, y, w, h) (w/h default to the bitmap's OSD size given in bitmap px).
export function Pic({ src, x, y, w, h, style }: {
  src: string
  x: number
  y: number
  w: number
  h: number
  style?: CSSProperties
}) {
  return (
    <img
      src={img(src)}
      alt=""
      draggable={false}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}
    />
  )
}

export const rgb = (r: number, g: number, b: number, a = 255) =>
  a >= 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})`
