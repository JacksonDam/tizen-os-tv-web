import { MUXES, SCAN_LINEUP, type Channel } from '../../../../tv/channels'

// Mocked EU Air auto scan, following CChannelSearchManagerDVBAuto / CAutoTuneProgressDVBWindow
// (spec/setup.md 4.4). The state at any moment is derived from the elapsed scan time.
//
// Digital pass: the middleware's EU Air channel list, VHF E5-E12 then UHF 21-69 = 57 steps (inferred:
// the list comes from g_pAppTV+0x248(2); the reference shows "Channel 5" at 0 % and "Channel 6" at 1 %,
// which fits m_CalculateSearchPercentEU only with 57 steps). Each step shows "Channel <n>"
// (t_ProcessSearchChannel); a step whose multiplex has services raises the counts, draws the number
// highlighted and sleeps 200 ms (t_ProcessChannelFound, UpdateWindow: PCTime::Sleep(200)).
// Analogue pass: a frequency sweep, the label shows the channel name "C<n>" from the frequency ("C--"
// between channels, CCountryOption::GetChannelNumFromFreq). Nothing is found (no analogue
// transmitters in the mock). Lock times live in the tuner middleware, not in exeDSP: the step and sweep
// times below are inferred.

export const SCAN_TIMING = {
  stepMs: 500,         // per digital channel (inferred)
  foundPauseMs: 200,   // UI sleep after a channel with services (firmware)
  analogueMs: 10000,   // the analogue sweep (inferred)
  analogueTickMs: 250, // how often the sweep text updates (inferred)
  resultHideMs: 700,   // result -> hide progress, show the preview (m_OnProgressHideAlarmCallback)
}

// Scan speed: ?scanspeed=<n> in the page URL for quick runs.
export const SCAN_SPEED = (() => {
  const v = typeof location === 'undefined' ? NaN : Number(new URLSearchParams(location.search).get('scanspeed'))
  return v > 0 ? v : 1
})()

export type ChannelType = 'Digital & Analogue' | 'Digital' | 'Analogue'
export type Aerial = 'Air' | 'Cable'

const EU_AIR_CHANNELS = [5, 6, 7, 8, 9, 10, 11, 12, ...Array.from({ length: 49 }, (_, i) => 21 + i)]

type Step = { at: number; label: string; number: string; found?: boolean; pct: number }

export type ScanPlan = {
  steps: Step[]                          // text/percent changes in time order
  found: { at: number; ch: Channel }[]   // services in the order they are found
  digital: boolean
  analogue: boolean
  totalMs: number
}

// EU air channel name of an analogue picture carrier (inferred: E2-E4, E5-E12, 21-69 rasters).
function analogueName(mhz: number) {
  const near = (f: number) => Math.abs(mhz - f) <= 3.5
  for (let n = 2; n <= 4; n++) if (near(48.25 + 7 * (n - 2))) return `C${n}`
  for (let n = 5; n <= 12; n++) if (near(175.25 + 7 * (n - 5))) return `C${n}`
  for (let n = 21; n <= 69; n++) if (near(471.25 + 8 * (n - 21))) return `C${n}`
  return 'C--'
}

export function makePlan(aerial: Aerial, type: ChannelType, channelLabel: string): ScanPlan {
  const digital = type !== 'Analogue'
  const analogue = type !== 'Digital'
  const steps: Step[] = []
  const found: ScanPlan['found'] = []
  const { stepMs, foundPauseMs, analogueMs, analogueTickMs } = SCAN_TIMING
  let t = 0
  // nothing is broadcast on the cable input (inferred: the mock has no cable network)
  const muxes = aerial === 'Air' ? MUXES : []
  if (digital) {
    const total = EU_AIR_CHANNELS.length
    EU_AIR_CHANNELS.forEach((rf, i) => {
      // m_CalculateSearchPercentEU: step*100/total, halved when an analogue pass follows
      const raw = Math.floor(((i + 1) * 100) / total)
      const pct = analogue ? Math.floor(raw / 2) : raw
      steps.push({ at: t, label: channelLabel, number: String(rf), pct })
      t += stepMs
      const mux = muxes.find(m => m.rf === rf)
      if (mux) {
        for (const s of mux.services) found.push({ at: t, ch: SCAN_LINEUP.find(c => c.number === s[0])! })
        steps.push({ at: t, label: channelLabel, number: String(rf), found: true, pct })
        t += foundPauseMs
      }
    })
  }
  if (analogue) {
    // t_UpdateAnalogProgress: (MHz*100 - 3900) / 850, i.e. 39 MHz = 0 %, 889 MHz = 100 %
    const n = Math.round(analogueMs / analogueTickMs)
    for (let i = 0; i < n; i++) {
      const mhz = 39 + (850 * i) / n
      const a = Math.floor((mhz * 100 - 3900) / 850)
      steps.push({ at: t, label: analogueName(mhz), number: '', pct: digital ? Math.floor(a / 2) + 50 : a })
      t += analogueTickMs
    }
  }
  return { steps, found, digital, analogue, totalMs: t }
}

export function stepAt(plan: ScanPlan, t: number): Step | undefined {
  let cur: Step | undefined
  for (const s of plan.steps) {
    if (s.at > t) break
    cur = s
  }
  return cur
}

export function foundAt(plan: ScanPlan, t: number): Channel[] {
  return plan.found.filter(f => f.at <= t).map(f => f.ch)
}
