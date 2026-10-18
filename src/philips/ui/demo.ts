import { useSyncExternalStore } from 'react'
import type { RemoteKey } from '../../input/remote'
import { F, type Juice, W } from '../fw/juice'
import { getProp, setProp, type TvEnv } from './env'
import { P } from './props'
import { hide, repaint, show, timer, type Screen } from './screens'

// The demo application of mtv522eu (ceapdemo, properties 0x1b9..0x1e0 through ceapdemo__demoapi_*,
// CeapPropRangeValues index 5) and its screens in panel#30, driven by the panels' event-action tables
// (JuicePanels +0x3c / +0x44, FUN_008e7438: {key group or event, condition property, property to set,
// widget, value, result, action 1 show / 2 hide / 5 focus}):
//
// - TV menu > Features > Demo (node 5, panel#28): list#8 on property 0x1bd, values 0 Pixel Plus,
//   1 Ambilight, 2 100 Hz Clear LCD, 3 Settings assistant, 4 Active Control. Its focus event (0x303d)
//   shows the strip panel#29 at (0,384) in place of the menu footer: "Exit" on the red key and
//   "Press OK to start this demo." OK on the list (key group 0x8043) sets property 0x1c0, whose
//   handler (demoapi Set case 5, 0x68e064) starts the selected demo.
// - Pixel Plus (demo 1 of demctl, 0x68dae8): when the picture cannot be demonstrated
//   (demctl_EnableDemo returns 3) event 0x4181 shows status#76 "Pixel Plus demo not available";
//   otherwise event 0x40f2 hides the TV menu (panel#15) and the strip and shows panel#42 (status#59
//   "PIXEL PLUS DEMO", status#60 "Off" on the left, status#61 "On" on the right) with the dividing
//   line panel#40 (property 0x1dc: demctl_GetLineType(1) = 1, a vertical line at x = 424..425).
//   OK (list#11, property 0x1d5 values 5 / 6) toggles split screen and full screen: events 0x4258
//   (hide the line and the Off / On labels) and 0x4257 (show them). The end event 0x414a hides the
//   demo, focuses the demo list again and shows the strip (string 1119: "Press Menu to stop").
// - Active Control (event 0x4148): panel#38, "Active Control" with list#10 (property 0x71f, Off / On)
//   and seven bars (slider#1..#7: Contrast, Dynamic contrast, Colour, Sharpness, DNR, Motion, Tint,
//   properties 0x1c5, 0x1c7, 0x1c4, 0x1c9, 0x1c6, 0x1c8, 0x1ca = ceapjagcpuiapps__vctl_Get 0x3f..0x45,
//   the picture analysis of Active Control). Key group 0x97 (red, Menu, ...) ends it (0x4149).
// - Ambilight (0x4222, panel#53) and 100 Hz Clear LCD (0x4219, panel#44) are other models'
//   features and are not offered, like the menu hides them; the Settings assistant demo (0x4220,
//   panel#47) needs the Settings assistant, which the exhibit does not build.

export const DEMO_PROP = 0x1bd
export const DEMO_LIST = W('list', 8)
export const DEMO_VALUES = [0, 4] // Pixel Plus, Active Control (offered on this set)
export const DEMO_STRIP = W('panel', 29)

type DemoState = { kind: 'pp'; full: boolean } | { kind: 'ac' } | null
let state: DemoState = null
const subs = new Set<() => void>()
function setState(s: DemoState) {
  state = s
  subs.forEach(f => f())
  repaint()
}
export function getDemo() {
  return state
}
export function useDemo() {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
    () => state,
  )
}

// ---- the Active Control bars: the picture analysis (inferred: computed from the stand-in loop) ----
// Active Control measures the incoming picture and corrects it; the demo shows the correction per
// processing. The exhibit samples the playing loop (64x36) twice a second and derives the bars from
// its statistics: contrast from the luminance spread, dynamic contrast from the histogram tails,
// colour from the saturation, sharpness from the gradients, DNR from the pixel-level noise, motion
// from the frame difference and tint from the hue balance (inferred).
const AC_PROPS = { contrast: 0x1c5, dynContrast: 0x1c7, colour: 0x1c4, sharpness: 0x1c9, dnr: 0x1c6, motion: 0x1c8, tint: 0x1ca }
const bars: Record<number, number> = {}
let prevFrame: Uint8ClampedArray | null = null
let sampler: ReturnType<typeof setInterval> | null = null
function sample() {
  const v = document.querySelector('video.ph-live') as HTMLVideoElement | null
  const on = getProp(P.activeControl) === 16
  if (!v || !on || v.readyState < 2) {
    for (const p of Object.values(AC_PROPS)) bars[p] = 0
    prevFrame = null
    repaint()
    return
  }
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 36
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.drawImage(v, 0, 0, 64, 36)
  const d = ctx.getImageData(0, 0, 64, 36).data
  const n = 64 * 36
  const lum = new Float32Array(n)
  let sum = 0
  let sat = 0
  let warm = 0
  for (let i = 0; i < n; i++) {
    const r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = y
    sum += y
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    sat += mx ? (mx - mn) / mx : 0
    warm += (r - b) / 255
  }
  const mean = sum / n
  let varsum = 0
  let grad = 0
  let noise = 0
  for (let y = 0; y < 36; y++) {
    for (let x = 0; x < 64; x++) {
      const i = y * 64 + x
      varsum += (lum[i] - mean) ** 2
      if (x < 63 && y < 35) {
        grad += Math.abs(lum[i + 1] - lum[i]) + Math.abs(lum[i + 64] - lum[i])
        noise += Math.abs(lum[i] - (lum[i + 1] + lum[i + 64]) / 2)
      }
    }
  }
  const sorted = Array.from(lum).sort((a, b) => a - b)
  const spread = sorted[Math.floor(n * 0.95)] - sorted[Math.floor(n * 0.05)]
  let motion = 0
  if (prevFrame) {
    for (let i = 0; i < n; i++) motion += Math.abs(d[4 * i] - prevFrame[4 * i])
    motion /= n
  }
  prevFrame = d.slice()
  const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)))
  bars[AC_PROPS.contrast] = clamp(100 - Math.sqrt(varsum / n) * 1.2)
  bars[AC_PROPS.dynContrast] = clamp(100 - spread / 2.55)
  bars[AC_PROPS.colour] = clamp(100 - (sat / n) * 160)
  bars[AC_PROPS.sharpness] = clamp(100 - grad / (n * 0.2))
  bars[AC_PROPS.dnr] = clamp(noise / (n * 0.08))
  bars[AC_PROPS.motion] = clamp(motion * 4)
  bars[AC_PROPS.tint] = clamp(50 + (warm / n) * 100)
  repaint()
}

// ---- the demo screens ----
export class DemoScreen implements Screen {
  name = 'demo'
  layer = 15
  covers = true
  modal = true
  onEnd: () => void

  constructor(onEnd: () => void) {
    this.onEnd = onEnd
  }

  draw(j: Juice, env: TvEnv) {
    const s = state
    if (!s) return
    if (s.kind === 'pp') {
      // the Off / On labels and the line only in split screen (events 0x4258 / 0x4257)
      // (panel#30 draws its children in order: the line panel#40 before the demo panel#42)
      if (s.full) for (const w of [W('status', 60), W('status', 61)]) env.hidden.add(w)
      if (!s.full) j.draw(W('panel', 40), 0, 0, 0)
      j.draw(W('panel', 42), 0, 0, 0)
    } else {
      // the Active Control list (Off / On) has the focus; the bars show the analysis
      const lw = W('list', 10)
      const ids = j.listValueIds(lw)
      env.lists.set(lw, { focus: Math.max(0, ids.indexOf(getProp(P.activeControl))), top: 0, expanded: true })
      for (const [p, v] of Object.entries(bars)) env.overrides.set(+p, v)
      j.draw(W('panel', 38), 0, 0, F.FOCUS)
    }
  }

  key(k: RemoteKey) {
    const s = state
    if (!s) return false
    // volume and mute stay with the TV (not in the demo's blocked key group 0x7a)
    if (k === 'VolumeUp' || k === 'VolumeDown' || k === 'Mute' || k === 'Power') return false
    if (s.kind === 'pp') {
      if (k === 'Enter') setState({ kind: 'pp', full: !s.full })
      else if (k === 'Settings' || k === 'Back' || k === 'Exit') this.end() // Menu (Back: inferred)
      return true
    }
    if (k === 'Up' || k === 'Down') {
      // list#10: the cursor is the value (Active Control Off 20 / On 16)
      setProp(P.activeControl, getProp(P.activeControl) === 16 ? 20 : 16)
      sample()
    } else if (k === 'Settings' || k === 'Back' || k === 'Exit' || k === 'Red') this.end() // key group 0x97
    return true
  }

  end() {
    if (sampler) clearInterval(sampler)
    sampler = null
    setState(null)
    hide('demo')
    this.onEnd()
  }
}

// "Pixel Plus demo not available" (status#76 of panel#30 at (482,18)); shown for 3 s (inferred)
class NotAvailable implements Screen {
  name = 'demo-na'
  layer = 16
  draw(j: Juice) {
    j.draw(W('status', 76), 482, 18, 0)
  }
}

// Starts the demo with list#8's value; returns false when it cannot start (the caller stays in the menu)
export function startDemo(value: number, pictureAvailable: boolean, onStart: () => void, onEnd: () => void): boolean {
  if (value === 0) {
    // the set cannot demonstrate Pixel Plus without a picture (radio, no signal, an undecodable
    // service): demctl_EnableDemo fails and 0x4181 shows the message (condition inferred)
    if (!pictureAvailable) {
      show(new NotAvailable())
      timer('demo-na', 3000, () => hide('demo-na'))
      repaint()
      return false
    }
    onStart()
    setState({ kind: 'pp', full: false })
    show(new DemoScreen(onEnd))
    return true
  }
  if (value === 4) {
    onStart()
    setState({ kind: 'ac' })
    sample()
    if (sampler) clearInterval(sampler)
    sampler = setInterval(sample, 500)
    show(new DemoScreen(onEnd))
    return true
  }
  return false
}

export function demoStripDraw(j: Juice) {
  j.draw(DEMO_STRIP, 0, 384, 0)
}
