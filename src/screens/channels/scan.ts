import { MUXES, SCAN_LINEUP, type Channel } from '../../tv/channels'

// Mocked channel scan (spec2/channels.md 2.12). Timings are invented (a real Air scan takes 2-4 minutes),
// compressed to about 50 s at speed 1. The state at any moment is derived from the elapsed scan time.

export const MOCK_SCAN = {
  digital: { firstRf: 21, lastRf: 69, msPerChannel: 700, msPerService: 180, percentEnd: 85 },
  analog: { durationMs: 9000, fromMHz: 48, toMHz: 855, steps: 40 },
  cable: { fromMHz: 114, toMHz: 858, stepMHz: 8, msPerStep: 300 },  // nothing on the cable input (inferred)
  holdAt100Ms: 800,
  highlightMs: 500,
  speed: 1,             // 4 = quick demo (~13 s)
} as const

// Scan speed: MOCK_SCAN.speed, or ?scanspeed=<n> in the page URL for quick runs.
export const SCAN_SPEED = (() => {
  const v = typeof location === 'undefined' ? NaN : Number(new URLSearchParams(location.search).get('scanspeed'))
  return v > 0 ? v : MOCK_SCAN.speed
})()

export type Antenna = 'Air' | 'Cable' | 'Satellite'
export type ChannelTypeChoice = 'Digital & Analog' | 'Digital' | 'Analog'

export type ScanPlan = {
  antenna: Antenna
  digital: boolean          // which passes run (the other type's rows show "-")
  analog: boolean
  steps: { at: number; text: string }[]   // progress text1 changes
  found: { at: number; ch: Channel }[]    // services in the order they are found
  digitalMs: number         // end of the digital pass
  totalMs: number           // end of the last pass (100 %)
}

export function makePlan(antenna: Antenna, type: ChannelTypeChoice): ScanPlan {
  const digital = type !== 'Analog'
  const analog = type !== 'Digital'
  const steps: ScanPlan['steps'] = []
  const found: ScanPlan['found'] = []
  let t = 0
  if (digital && antenna === 'Air') {
    // RF 21-69 (UHF, 8 MHz raster): 700 ms per channel, +180 ms per service on a multiplex
    const { firstRf, lastRf, msPerChannel, msPerService } = MOCK_SCAN.digital
    for (let rf = firstRf; rf <= lastRf; rf++) {
      steps.push({ at: t, text: `DTV Air  Channel ${rf}` })
      t += msPerChannel
      for (const s of MUXES.find(m => m.rf === rf)?.services ?? []) {
        t += msPerService
        found.push({ at: t, ch: SCAN_LINEUP.find(c => c.number === s[0])! })
      }
    }
  } else if (digital) {
    const { fromMHz, toMHz, stepMHz, msPerStep } = MOCK_SCAN.cable
    for (let f = fromMHz; f <= toMHz; f += stepMHz) {
      steps.push({ at: t, text: `DTV Cable  ${f} MHz` })
      t += msPerStep
    }
  }
  const digitalMs = t
  if (analog) {
    // 48 -> 855 MHz in ~40 steps; nothing is found (EU analogue switch-off)
    const { durationMs, fromMHz, toMHz, steps: n } = MOCK_SCAN.analog
    for (let i = 0; i < n; i++) {
      const mhz = Math.round(fromMHz + ((toMHz - fromMHz) * i) / (n - 1))
      steps.push({ at: digitalMs + (durationMs * i) / n, text: `${antenna}  ${mhz} MHz` })
    }
    t += durationMs
  }
  return { antenna, digital, analog, steps, found, digitalMs, totalMs: t }
}

// Percent shown in text2: the digital pass covers 0-85 % when an analogue pass follows.
export function percentAt(plan: ScanPlan, t: number) {
  if (t >= plan.totalMs) return 100
  const split = plan.digital && plan.analog ? MOCK_SCAN.digital.percentEnd : plan.digital ? 100 : 0
  if (t < plan.digitalMs) return Math.floor((split * t) / plan.digitalMs)
  return Math.floor(split + ((100 - split) * (t - plan.digitalMs)) / (plan.totalMs - plan.digitalMs))
}

export function textAt(plan: ScanPlan, t: number) {
  let text = plan.steps[0]?.text ?? ''
  for (const s of plan.steps) {
    if (s.at > t) break
    text = s.text
  }
  return text
}

export function foundAt(plan: ScanPlan, t: number): Channel[] {
  return plan.found.filter(f => f.at <= t).map(f => f.ch)
}

// The blue flash of text1/text2 for 0.5 s after each found service (csp:0xc460c).
export function highlightAt(plan: ScanPlan, t: number) {
  return plan.found.some(f => f.at <= t && t - f.at < MOCK_SCAN.highlightMs * SCAN_SPEED)
}

// EU count rows (csp:0xe13d0 t_UpdateEUFindResult): a type that is not scanned shows "-".
export function countRows(plan: ScanPlan, chs: Channel[]): [label: string, value: string][] {
  const n = (k: Channel['kind']) => chs.filter(c => c.kind === k).length
  const d = (v: number) => (plan.digital ? String(v) : '-')
  return [
    ['Digital', d(chs.length)],
    [' - TV', d(n('tv'))],
    [' - Radio', d(n('radio'))],
    [' - Data/Other', d(n('data'))],
    ['Analog', plan.analog ? '0' : '-'],
  ]
}
