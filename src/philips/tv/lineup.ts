import { MUXES, type Channel } from '../../tv/channels'

// The mocked aerial for this European set: the museum's fictional DVB-T multiplexes (src/tv/channels.ts
// MUXES, digital services) plus a few analogue PAL stations. The TV numbers digital services from 1 in
// the order the search finds them and puts the analogue ones after them (the search result screen
// names the "First analogue channel:", as in the Polish installation footage).

export type TvChannel = Channel & { analogue?: boolean; ch?: number }

// Analogue stations: fictional, on UHF channels of the same aerial (PAL B/G).
const ANALOGUE: { name: string; ch: number; video: string }[] = [
  { name: 'Aurora One', ch: 21, video: 'loop-clouds.mp4' },
  { name: 'Riverside Local', ch: 24, video: 'loop-gradients.mp4' },
]

export type Found = { digital: TvChannel[]; analogue: TvChannel[] }

// What a full search of the aerial finds, in search order (UHF 21..69, digital first in each step).
export function searchAerial(): { rf: number; digital: TvChannel[]; analogue: TvChannel[] }[] {
  const out: { rf: number; digital: TvChannel[]; analogue: TvChannel[] }[] = []
  for (let rf = 21; rf <= 69; rf++) {
    const mux = MUXES.find(m => m.rf === rf)
    const digital: TvChannel[] = mux
      ? mux.services.map(([lcn, name, kind, hd, genre]) => ({
        number: 0, name, kind, hd, genre, delivery: kind === 'tv' ? 'DTV' : kind === 'radio' ? 'Radio' : 'Data',
        // the shared lineup's stand-in loop for this service (LOOPS[number % 2] in src/tv/channels.ts)
        video: kind === 'tv' ? (lcn % 2 ? 'loop-clouds.mp4' : 'loop-gradients.mp4') : '', rf, freqMHz: 306 + 8 * rf,
      } as TvChannel))
      : []
    const analogue: TvChannel[] = ANALOGUE.filter(a => a.ch === rf).map(a => ({
      number: 0, name: a.name, kind: 'tv', hd: false, genre: 'Entertainment', delivery: 'ATV', video: a.video,
      rf, freqMHz: 303.25 + 8 * rf, analogue: true, ch: rf,
    } as TvChannel))
    out.push({ rf, digital, analogue })
  }
  return out
}

// The stored lineup after an installation: digital services numbered 1.. in search order (data
// services are not stored as channels), then the analogue stations.
export function numberLineup(digital: TvChannel[], analogue: TvChannel[]): TvChannel[] {
  const d = digital.filter(c => c.kind !== 'data').map((c, i) => ({ ...c, number: i + 1 }))
  const a = analogue.map((c, i) => ({ ...c, number: d.length + i + 1 }))
  return [...d, ...a]
}

export function defaultLineup(): TvChannel[] {
  const steps = searchAerial()
  return numberLineup(steps.flatMap(s => s.digital), steps.flatMap(s => s.analogue))
}
