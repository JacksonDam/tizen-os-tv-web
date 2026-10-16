import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTv } from '../../tv/store'
import { onPictureModeChanged, pictureParams, pictureTransform } from './picture'
import { buildOverrides, enlarge, enlargeExtra, highContrast } from './themeRewrite'
import './av.css'

// Always-mounted helpers (registered as overlays, so they run while the TV is on): the picture engine
// for the video plane and the accessibility display modes. The stand-in sources have no sound: the
// programme audio of a real TV comes from the broadcast or the HDMI device, not the firmware.

function useStage() {
  const ref = useRef<HTMLSpanElement>(null)
  const [stage, setStage] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => setStage(ref.current?.closest<HTMLElement>('.stage') ?? null), [])
  return { ref, stage }
}

// ---- picture: CSS variables read by .live-video and the Now Playing previews (av.css) ----

export function AvPicture() {
  const { ref, stage } = useStage()
  const tv = useTv(s => s)
  const p = useMemo(() => pictureParams(tv), [tv])
  const transform = pictureTransform(tv)
  const mode = useTv(s => s.settings.picturemode)
  const lastMode = useRef(mode)

  // a picture mode change swaps in that mode's Expert Settings
  useEffect(() => {
    const from = lastMode.current
    lastMode.current = mode
    if (from !== undefined && mode !== undefined && from !== mode) onPictureModeChanged(Number(from), Number(mode))
    else if (from === undefined && mode !== undefined && Number(mode) !== 65537) onPictureModeChanged(65537, Number(mode))
  }, [mode])

  const svg = !!p.matrix || p.gamma !== 1 || p.shadow !== 0 || p.sharpen !== 0
  useEffect(() => {
    if (!stage) return
    stage.style.setProperty('--av-filter', `${svg ? 'url(#av-picture) ' : ''}${p.filter}`)
    stage.style.setProperty('--av-transform', transform)
  }, [stage, svg, p.filter, transform])

  const table = Array.from({ length: 17 }, (_, i) => {
    const x = i / 16
    const lift = p.shadow * 0.025 * Math.pow(1 - x, 3)
    return Math.max(0, Math.min(1, Math.pow(x, p.gamma) + lift)).toFixed(4)
  }).join(' ')
  const a = Math.max(0, p.sharpen)

  return (
    <span ref={ref} className="av-defs">
      <svg width="0" height="0" aria-hidden="true">
        <filter id="av-picture" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          {p.matrix ? <feColorMatrix type="matrix" values={p.matrix} /> : <feColorMatrix type="identity" />}
          {(p.gamma !== 1 || p.shadow !== 0) && (
            <feComponentTransfer>
              <feFuncR type="table" tableValues={table} />
              <feFuncG type="table" tableValues={table} />
              <feFuncB type="table" tableValues={table} />
            </feComponentTransfer>
          )}
          {p.sharpen > 0 && (
            <feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix={`0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`} />
          )}
          {p.sharpen < 0 && <feGaussianBlur stdDeviation={(-p.sharpen * 0.9).toFixed(2)} />}
        </filter>
      </svg>
    </span>
  )
}

// ---- accessibility display modes on the whole output ----

function useThemeSheet(stage: HTMLElement | null, cls: string, on: boolean, build: () => string) {
  useEffect(() => {
    if (!stage || !on) return
    const el = document.createElement('style')
    el.dataset.avTheme = cls
    const fill = () => {
      el.textContent = build()
    }
    fill()
    document.head.appendChild(el)
    stage.classList.add(cls)
    // stylesheets added later (lazy modules, dev reloads) get their twins too
    let t: ReturnType<typeof setTimeout> | undefined
    const mo = new MutationObserver(muts => {
      if (muts.some(m => [...m.addedNodes].some(n => n !== el && (n.nodeName === 'STYLE' || n.nodeName === 'LINK')))) {
        clearTimeout(t)
        t = setTimeout(fill, 50)
      }
    })
    mo.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      clearTimeout(t)
      mo.disconnect()
      el.remove()
      stage.classList.remove(cls)
    }
  }, [stage, cls, on, build])
}

const buildHc = () => buildOverrides('av-hc', highContrast)
const buildEnlarge = () => buildOverrides('av-enlarge', enlarge, enlargeExtra('av-enlarge'))

export function AvAccessibility() {
  const { ref, stage } = useStage()
  const gray = useTv(s => Number(s.settings.grayscale ?? 0) === 1)
  const hc = useTv(s => Number(s.settings.highcontrast ?? 0) === 1)
  const big = useTv(s => Number(s.settings.enlarge ?? 0) === 1)
  useEffect(() => {
    stage?.classList.toggle('av-grayscale', gray)
  }, [stage, gray])
  useThemeSheet(stage, 'av-hc', hc, buildHc)
  useThemeSheet(stage, 'av-enlarge', big, buildEnlarge)
  return <span ref={ref} className="av-defs" />
}
