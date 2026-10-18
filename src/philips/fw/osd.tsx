import { useEffect, useRef, useState } from 'react'
import { PH } from '../assets'
import { FONT, Juice, OSD_H, OSD_W, type Env } from './juice'
import { loadMem, type Mem } from './mem'

// The OSD plane: the TV draws its menus into an 852x480 plane that the display scales to the panel.
// Here one canvas covers the 1920x1080 stage and the Juice port draws into it with that scale.

let assets: Promise<{ mem: Mem; atlas: HTMLImageElement }> | null = null
export function loadAssets() {
  assets ??= (async () => {
    const font = new FontFace(FONT, `url(${PH}/fw/PHLSC4.ttf)`)
    const atlas = new Image()
    atlas.src = `${PH}/fw/atlas.png`
    const [mem] = await Promise.all([
      loadMem(),
      font.load().then(f => document.fonts.add(f)),
      atlas.decode(),
    ])
    return { mem, atlas }
  })()
  return assets
}

export function useJuice(env: Env) {
  const [j, setJ] = useState<Juice | null>(null)
  useEffect(() => {
    let live = true
    loadAssets().then(({ mem, atlas }) => {
      if (live) setJ(new Juice(mem, atlas, env))
    })
    return () => {
      live = false
    }
  }, [env])
  return j
}

export function OsdPlane({ juice, paint, seq }: { juice: Juice | null; paint: (j: Juice) => void; seq: unknown }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !juice) return
    const ctx = c.getContext('2d')!
    juice.ctx = ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(c.width / OSD_W, 0, 0, c.height / OSD_H, 0, 0)
    ctx.imageSmoothingEnabled = true
    paint(juice)
  })
  void seq
  return <canvas ref={ref} className="ph-osd" width={1920} height={1080} />
}
