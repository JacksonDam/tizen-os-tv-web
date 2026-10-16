import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { currentChannel, useTv } from '../../tv/store'
import { useShellView } from '../../tv/shell'
import { onPictureModeChanged, pictureParams, pictureTransform } from './picture'
import { audioSettings } from './sound'
import { applySettings, duck, playProgramme, stopAll } from './audio/engine'
import { styleFor } from './audio/styles'
import { buildOverrides, enlarge, enlargeExtra, highContrast } from './themeRewrite'
import './av.css'

// Always-mounted helpers (registered as overlays, so they run while the TV is on): the picture engine
// for the video plane, the audio engine, and the accessibility display modes.

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

// ---- programme audio ----

export function AvAudio() {
  const s = useTv(st => st)
  const view = useShellView()
  const ch = s.source === 'TV' ? currentChannel(s) : undefined
  // the channel scan owns the tuner: no programme while it runs
  const id = view.app === 'channel-search' ? null : s.source === 'TV' ? (ch && ch.kind !== 'data' ? `ch:${ch.number}` : null) : s.source
  const settings = audioSettings(s)
  const key = JSON.stringify(settings)

  useEffect(() => applySettings(settings), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    playProgramme(id, styleFor(s.source, ch), ch ? ch.number : s.source === 'HDMI1' ? 701 : 702)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopAll(), []) // standby

  // retuning mutes for a moment (channel change ~0.4 s, input switch screen 0.7 s)
  const tune = useRef(s.tuneSeq)
  const sw = useRef(s.switchSeq)
  useEffect(() => {
    if (s.tuneSeq !== tune.current) duck(400)
    if (s.switchSeq !== sw.current) duck(800)
    tune.current = s.tuneSeq
    sw.current = s.switchSeq
  }, [s.tuneSeq, s.switchSeq])
  return null
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
