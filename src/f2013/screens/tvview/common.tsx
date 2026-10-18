import type { CSSProperties } from 'react'
import { F13 } from '../../assets'

// Shared bits of the TV-viewing screens (TV viewer overlays, Source, Channel List, Guide, Tools).
//
// Coordinate space. exeDSP's OSD on this model is 1280x720 (AppConfig::D_OSD_RESOLUTION 0x500;
// AppMWOSDInfo::t_InitOSDInfo -> t_InitResolution(.., 0x500, 0x3c0)). Layout statics such as
// CViewerOSDInfo::* are written in a 960x540 base and scaled by w/960 at start-up, and the bitmaps are
// drawn 1:1 in the 1280 OSD. On the 1920x1080 stage that means: layout values x2 (we evaluate the
// initializers with 1920/960, see spec/tvview.md), bitmaps x1.5.
export const IMG_SCALE = 1.5

// Firmware bitmaps converted to PNG (alpha kept) in public/f13/tvview/<firmware folder>/<name>.png,
// addressed by their firmware path ("TVViewer/ch_jog_main.bmp").
export function img(path: string) {
  return `${F13}/tvview/${path.replace(/\.bmp$/i, '')}.png`
}

// A firmware bitmap at stage position (x, y) drawn at its OSD size (natural size x1.5), or stretched
// to w x h stage pixels when given.
export function Bmp({ src, x = 0, y = 0, w, h, style, className }: {
  src: string
  x?: number
  y?: number
  w?: number
  h?: number
  style?: CSSProperties
  className?: string
}) {
  const s: CSSProperties = { position: 'absolute', left: x, top: y, ...style }
  if (w !== undefined) s.width = w
  if (h !== undefined) s.height = h
  if (w === undefined && h === undefined) {
    // CSS zoom also scales the element's own left/top, so place it in zoomed units
    s.zoom = IMG_SCALE
    s.left = x / IMG_SCALE
    s.top = y / IMG_SCALE
  }
  return <img className={className} src={img(src)} alt="" draggable={false} style={s} />
}

// ARGB colour constant (as the firmware writes them, 0xAARRGGBB) to CSS.
export function argb(c: number) {
  const a = ((c >>> 24) & 255) / 255
  const r = (c >>> 16) & 255
  const g = (c >>> 8) & 255
  const b = c & 255
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+a.toFixed(3)})`
}

// The UI fonts: Samsung SVD Light (300) is the font exeDSP's text drawings use unless noted.
export const FONT = "'SamsungSVD', sans-serif"
