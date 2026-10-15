import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// The TV UI is laid out on a fixed 1920x1080 canvas (FLUX assets are authored at 3840x2160 and
// used at half size). The canvas is scaled uniformly to fit the window and letterboxed in black.
export const STAGE_W = 1920
export const STAGE_H = 1080

export function Stage({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = host.current!
    const update = () => {
      const scale = Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H)
      setFit({ scale, x: (el.clientWidth - STAGE_W * scale) / 2, y: (el.clientHeight - STAGE_H * scale) / 2 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={host} className="stage-host">
      <div
        className="stage"
        style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}
      >
        {children}
      </div>
    </div>
  )
}
