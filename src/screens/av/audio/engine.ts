import type { Inst, Style } from './styles'
import { onAnyKey } from '../../../input/remote'

// The TV's audio path for the mocked sources, in Web Audio:
//   programme (generative, styles.ts) -> Equalizer (7 bands) -> Sound Mode (Amplify) -> Balance
//   -> Auto Volume -> volume/mute/Sound Output -> limiter -> speakers.
// Browsers only start audio after a user gesture: the context is created on the first key press or
// click (remote button, keyboard, or the automation hook), then the wanted programme starts. Curves
// and amounts are (inferred) unless noted.

let ctx: AudioContext | null = null
let unlocked = false

function audio(): AudioContext | null {
  if (!unlocked) return null
  if (!ctx) {
    try {
      ctx = new AudioContext({ latencyHint: 'playback' })
    } catch {
      return null
    }
  }
  return ctx
}

function unlock() {
  const first = !unlocked
  unlocked = true
  const c = audio()
  if (c && c.state === 'suspended') void c.resume()
  if (first) {
    if (lastSettings) applySettings(lastSettings)
    if (wanted) playProgramme(wanted.id, wanted.style, wanted.seed)
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', unlock)
  window.addEventListener('pointerdown', unlock)
  onAnyKey(unlock)
}

// ---- output chain ----

// Equalizer bands (menu EqualizerView: 100 Hz ... 10 kHz, sliders -10..10).
export const EQ_BANDS = [100, 200, 500, 1000, 2000, 5000, 10000]
const EQ_DB_PER_STEP = 0.6

type Chain = {
  input: GainNode
  eq: BiquadFilterNode[]
  ampLow: BiquadFilterNode
  ampMid: BiquadFilterNode
  ampHigh: BiquadFilterNode
  ampGain: GainNode
  left: GainNode
  right: GainNode
  autoDry: GainNode
  autoWet: GainNode
  master: GainNode
  duck: GainNode
  analyser: AnalyserNode
}
let chain: Chain | null = null

function impulse(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  return buf
}

function getChain(): Chain | null {
  const c = audio()
  if (!c) return null
  if (chain) return chain
  const input = c.createGain()
  // a small room so the synth voices blend
  const send = c.createGain()
  send.gain.value = 0.18
  const verb = c.createConvolver()
  verb.buffer = impulse(c, 1.8)
  const eqIn = c.createGain()
  input.connect(eqIn)
  input.connect(send).connect(verb).connect(eqIn)

  let node: AudioNode = eqIn
  const eq = EQ_BANDS.map(f => {
    const b = c.createBiquadFilter()
    b.type = 'peaking'
    b.frequency.value = f
    b.Q.value = 1.1
    b.gain.value = 0
    node.connect(b)
    node = b
    return b
  })
  const ampLow = c.createBiquadFilter()
  ampLow.type = 'lowshelf'
  ampLow.frequency.value = 120
  const ampMid = c.createBiquadFilter()
  ampMid.type = 'peaking'
  ampMid.frequency.value = 1200
  ampMid.Q.value = 1
  const ampHigh = c.createBiquadFilter()
  ampHigh.type = 'highshelf'
  ampHigh.frequency.value = 2500
  const ampGain = c.createGain()
  node.connect(ampLow).connect(ampMid).connect(ampHigh).connect(ampGain)

  const split = c.createChannelSplitter(2)
  const merge = c.createChannelMerger(2)
  const left = c.createGain()
  const right = c.createGain()
  ampGain.connect(split)
  split.connect(left, 0).connect(merge, 0, 0)
  split.connect(right, 1).connect(merge, 0, 1)

  const autoDry = c.createGain()
  const autoWet = c.createGain()
  autoWet.gain.value = 0
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -30
  comp.ratio.value = 8
  comp.knee.value = 6
  comp.attack.value = 0.005
  comp.release.value = 0.25
  const makeup = c.createGain()
  makeup.gain.value = 2
  const sum = c.createGain()
  merge.connect(autoDry).connect(sum)
  merge.connect(comp).connect(makeup).connect(autoWet).connect(sum)

  const master = c.createGain()
  master.gain.value = 0
  const duck = c.createGain()
  const limiter = c.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.ratio.value = 20
  limiter.attack.value = 0.002
  limiter.release.value = 0.1
  const analyser = c.createAnalyser()
  analyser.fftSize = 1024
  sum.connect(master).connect(duck).connect(limiter).connect(analyser).connect(c.destination)
  chain = { input, eq, ampLow, ampMid, ampHigh, ampGain, left, right, autoDry, autoWet, master, duck, analyser }
  return chain
}

const ramp = (p: AudioParam, v: number, t = 0.05) => {
  const c = ctx!
  p.cancelScheduledValues(c.currentTime)
  p.setTargetAtTime(v, c.currentTime, t / 3)
}

export type AudioSettings = {
  volume: number            // 0..100
  muted: boolean
  output: number            // Sound Output: 0 TV Speaker, 1 Audio Out (nothing connected: silent)
  soundMode: number         // 1 Standard, 5 Amplify
  balance: number           // -10 (L) .. 10 (R)
  eq: number[]              // 7 x -10..10
  autoVolume: boolean
}

// Volume curve: 0 = silent, 12 (the default) about -9 dB, 100 = full scale (inferred).
export const volumeGain = (v: number) => (v <= 0 ? 0 : Math.pow(v / 100, 0.5))

let lastSettings: AudioSettings | null = null

export function applySettings(s: AudioSettings) {
  lastSettings = s
  const ch = getChain()
  if (!ch) return
  ramp(ch.master.gain, s.muted || s.output !== 0 ? 0 : volumeGain(s.volume))
  s.eq.forEach((v, i) => ramp(ch.eq[i].gain, v * EQ_DB_PER_STEP, 0.1))
  const amplify = s.soundMode === 5
  ramp(ch.ampLow.gain, amplify ? -2 : 0, 0.1)
  ramp(ch.ampMid.gain, amplify ? 3 : 0, 0.1)
  ramp(ch.ampHigh.gain, amplify ? 5 : 0, 0.1)
  ramp(ch.ampGain.gain, amplify ? 1.18 : 1, 0.1)
  // Balance attenuates the opposite speaker (linear, silent at the end stop)
  ramp(ch.left.gain, s.balance > 0 ? 1 - s.balance / 10 : 1, 0.1)
  ramp(ch.right.gain, s.balance < 0 ? 1 + s.balance / 10 : 1, 0.1)
  ramp(ch.autoDry.gain, s.autoVolume ? 0 : 1, 0.2)
  ramp(ch.autoWet.gain, s.autoVolume ? 1 : 0, 0.2)
}

// Channel change and input switch: the TV mutes while it retunes.
export function duck(ms: number) {
  const ch = getChain()
  if (!ch || !ctx) return
  const t = ctx.currentTime
  ch.duck.gain.cancelScheduledValues(t)
  ch.duck.gain.setTargetAtTime(0, t, 0.01)
  ch.duck.gain.setTargetAtTime(1, t + ms / 1000, 0.08)
}

// ---- programme synthesis ----

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

let noiseBuf: AudioBuffer | null = null
function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

class Programme {
  readonly out: GainNode
  private readonly c: AudioContext
  private readonly step: number
  private readonly offset: number      // wall-clock seconds minus context time
  private next = -1                    // next step index to schedule
  private readonly root: number
  private readonly beds: AudioScheduledSourceNode[] = []
  private readonly bedGain: GainNode | null = null

  readonly style: Style
  readonly seed: number
  readonly id: string

  constructor(c: AudioContext, dest: AudioNode, style: Style, seed: number, id: string) {
    this.style = style
    this.seed = seed
    this.id = id
    this.c = c
    this.out = c.createGain()
    this.out.gain.value = 0
    this.out.connect(dest)
    this.out.gain.setTargetAtTime(1.2 * style.level, c.currentTime, 0.25)
    this.step = 60 / style.bpm / 4
    this.offset = Date.now() / 1000 - c.currentTime
    this.root = 45 + ((seed * 7) % 12) // A2..G#3, a different key per channel
    if (style.noise) this.bedGain = this.startBed(style.noise)
  }

  stop() {
    const t = this.c.currentTime
    this.out.gain.cancelScheduledValues(t)
    this.out.gain.setTargetAtTime(0, t, 0.08)
    setTimeout(() => {
      this.beds.forEach(b => b.stop())
      this.out.disconnect()
    }, 600)
  }

  // schedule every step that starts before `until` (context time)
  schedule(until: number) {
    const now = this.c.currentTime
    const song = (t: number) => t + this.offset
    if (this.next < 0) this.next = Math.ceil(song(now + 0.05) / this.step)
    for (;;) {
      const when = this.next * this.step - this.offset
      if (when > until) break
      if (when >= now - 0.01) this.render(this.next, Math.max(when, now))
      this.next++
    }
  }

  private deg(d: number, octave: number) {
    const s = this.style.scale
    const o = Math.floor(d / s.length)
    const i = ((d % s.length) + s.length) % s.length
    return this.root + 12 * (octave + o) + s[i]
  }

  private chordAt(bar: number) {
    const st = this.style
    return st.prog[Math.floor(bar / st.barsPerChord) % st.prog.length]
  }

  private chordTones(d: number, octave: number) {
    const tones = [d, d + 2, d + 4]
    if (this.style.sevenths) tones.push(d + 6)
    return tones.map(x => this.deg(x, octave))
  }

  private render(step: number, when: number) {
    const st = this.style
    const bar = Math.floor(step / 16)
    const s16 = ((step % 16) + 16) % 16
    const chord = this.chordAt(bar)
    const swing = st.drums?.swing && s16 % 4 === 2 ? st.drums.swing * this.step : 0

    if (st.pad && s16 === 0 && bar % st.barsPerChord === 0) {
      const dur = st.barsPerChord * 16 * this.step
      this.chordTones(chord, 1).forEach((m, i) => this.note(st.pad!, m, when, dur, 1, i % 2 ? 0.35 : -0.35))
    }
    if (st.bass) {
      const ch = st.bass.pattern[s16]
      if (ch && ch !== '.') {
        const m = ch === 'F' ? this.deg(chord + 4, 0) : this.deg(chord, 0) + (ch === 'O' ? 12 : 0)
        this.note(st.bass.inst, m, when, this.step * 2.5, 1, 0)
      }
    }
    if (st.arp && s16 % st.arp.every === 0) {
      const tones = this.chordTones(chord, st.arp.octave + 1)
      const i = Math.floor(s16 / st.arp.every)
      const order = st.arp.pattern ?? [0, 1, 2, 1]
      const m = tones[order[i % order.length] % tones.length]
      this.note(st.arp.inst, m, when, this.step * st.arp.every * 1.5, 0.9, i % 2 ? 0.3 : -0.3)
    }
    if (st.melody && s16 % 2 === 0) {
      // a 4-bar motif (varied every 16 bars), seeded by the channel
      const motif = rng(this.seed * 977 + (bar % 4) * 31 + (Math.floor(bar / 16) % 2) * 7)
      let pos = 0
      let d = chord + 2
      for (let k = 0; k <= s16 / 2; k++) {
        const on = motif() < st.melody.density || k === 0
        const walk = Math.floor(motif() * 5) - 2
        if (on) {
          d = k % 4 === 0 ? chord + [0, 2, 4][Math.floor(motif() * 3)] : Math.max(chord - 3, Math.min(chord + 9, d + walk))
          pos = k
        }
        if (k === s16 / 2 && on && pos === k) {
          this.note(st.melody.inst, this.deg(d, st.melody.octave + 1), when, this.step * 3, 0.8, 0.15)
        }
      }
    }
    if (st.drums) {
      const hit = (p: string | undefined) => (p ? p[s16] : '.')
      const k = hit(st.drums.kick)
      if (k !== '.') this.kick(when, k === 'x' ? 1 : 0.6)
      const sn = hit(st.drums.snare)
      if (sn !== '.') this.snare(when, sn === 'x' ? 1 : 0.6)
      const h = hit(st.drums.hat)
      if (h !== '.') this.hat(when + swing, h === 'x' ? 1 : 0.6)
    }
    if (st.noise === 'crowd' && this.bedGain && s16 === 0 && bar % 4 === 0) {
      // the crowd rises now and then
      const r = rng(this.seed * 131 + bar)()
      if (r > 0.6) {
        const g = this.bedGain.gain
        g.setTargetAtTime(0.11, when, 0.4)
        g.setTargetAtTime(0.05, when + 2.5, 1)
      }
    }
  }

  // ---- instruments ----

  private env(when: number, attack: number, peak: number, decayTo: number, decay: number, end: number) {
    const g = this.c.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + attack)
    g.gain.setTargetAtTime(decayTo, when + attack, decay / 3)
    g.gain.setTargetAtTime(0, end, 0.08)
    return g
  }

  private osc(type: OscillatorType, f: number, when: number, end: number, dest: AudioNode, detune = 0) {
    const o = this.c.createOscillator()
    o.type = type
    o.frequency.value = f
    o.detune.value = detune
    o.connect(dest)
    o.start(when)
    o.stop(end + 0.5)
    return o
  }

  private note(inst: Inst, midi: number, when: number, dur: number, vel: number, pan: number) {
    const c = this.c
    const f = hz(midi)
    const end = when + dur
    const p = c.createStereoPanner()
    p.pan.value = pan
    p.connect(this.out)
    switch (inst) {
      case 'pad':
      case 'strings': {
        const strings = inst === 'strings'
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = strings ? 1500 : 900
        lp.Q.value = 0.4
        const g = this.env(when, strings ? 1.2 : 0.8, 0.045 * vel, 0.035 * vel, 2, end)
        lp.connect(g).connect(p)
        this.osc('sawtooth', f, when, end, lp, -7)
        this.osc('sawtooth', f, when, end, lp, 7)
        if (strings) this.osc('triangle', f / 2, when, end, lp)
        break
      }
      case 'organ': {
        const g = this.env(when, 0.05, 0.03 * vel, 0.025 * vel, 1, end)
        g.connect(p)
        this.osc('sine', f, when, end, g)
        this.osc('sine', f * 2, when, end, g)
        this.osc('sine', f * 3, when, end, g)
        break
      }
      case 'epiano': {
        const g = this.env(when, 0.005, 0.11 * vel, 0, 1.6, end + 0.6)
        const h = c.createGain()
        h.gain.value = 0.25
        h.connect(g)
        g.connect(p)
        this.osc('sine', f, when, end + 0.6, g)
        this.osc('sine', f * 2, when, end + 0.6, h)
        break
      }
      case 'bass': {
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 600
        const g = this.env(when, 0.01, 0.2 * vel, 0.08 * vel, 0.5, end)
        lp.connect(g).connect(p)
        this.osc('triangle', f, when, end, lp)
        this.osc('sine', f / 2, when, end, lp)
        break
      }
      case 'pluck': {
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(3000, when)
        lp.frequency.setTargetAtTime(700, when, 0.12)
        const g = this.env(when, 0.004, 0.09 * vel, 0, 0.45, end)
        lp.connect(g).connect(p)
        this.osc('triangle', f, when, end, lp)
        this.osc('sawtooth', f, when, end, lp, 4)
        break
      }
      case 'bell': {
        const g = this.env(when, 0.003, 0.06 * vel, 0, 2.2, end + 1.5)
        const h = c.createGain()
        h.gain.setValueAtTime(0.35, when)
        h.gain.setTargetAtTime(0, when, 0.15)
        h.connect(g)
        g.connect(p)
        this.osc('sine', f, when, end + 1.5, g)
        this.osc('sine', f * 2.76, when, end + 1.5, h)
        break
      }
      case 'chip': {
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 2400
        const g = this.env(when, 0.003, 0.035 * vel, 0.02 * vel, 0.2, end)
        lp.connect(g).connect(p)
        this.osc('square', f, when, end, lp)
        break
      }
    }
  }

  private kick(when: number, vel: number) {
    const o = this.c.createOscillator()
    o.frequency.setValueAtTime(110, when)
    o.frequency.exponentialRampToValueAtTime(45, when + 0.12)
    const g = this.c.createGain()
    g.gain.setValueAtTime(0.22 * vel, when)
    g.gain.setTargetAtTime(0, when + 0.02, 0.07)
    o.connect(g).connect(this.out)
    o.start(when)
    o.stop(when + 0.5)
  }

  private burst(when: number, type: BiquadFilterType, f: number, gain: number, decay: number, pan: number) {
    const src = this.c.createBufferSource()
    src.buffer = noise(this.c)
    const bp = this.c.createBiquadFilter()
    bp.type = type
    bp.frequency.value = f
    const g = this.c.createGain()
    g.gain.setValueAtTime(gain, when)
    g.gain.setTargetAtTime(0, when + 0.005, decay / 3)
    const p = this.c.createStereoPanner()
    p.pan.value = pan
    src.connect(bp).connect(g).connect(p).connect(this.out)
    src.start(when, Math.random() * 1.5)
    src.stop(when + decay + 0.3)
  }

  private snare(when: number, vel: number) {
    this.burst(when, 'bandpass', 1800, 0.09 * vel, 0.16, 0)
  }

  private hat(when: number, vel: number) {
    this.burst(when, 'highpass', 7000, 0.035 * vel, 0.05, 0.25)
  }

  private startBed(kind: 'wind' | 'water' | 'crowd') {
    const c = this.c
    const src = c.createBufferSource()
    src.buffer = noise(c)
    src.loop = true
    const f = c.createBiquadFilter()
    const g = c.createGain()
    const lfo = c.createOscillator()
    const depth = c.createGain()
    if (kind === 'wind') {
      f.type = 'bandpass'
      f.frequency.value = 450
      f.Q.value = 0.9
      g.gain.value = 0.05
      lfo.frequency.value = 0.07
      depth.gain.value = 250
      lfo.connect(depth).connect(f.frequency)
    } else if (kind === 'water') {
      f.type = 'lowpass'
      f.frequency.value = 900
      g.gain.value = 0.035
      lfo.frequency.value = 0.12
      depth.gain.value = 0.02
      lfo.connect(depth).connect(g.gain)
    } else {
      f.type = 'bandpass'
      f.frequency.value = 1000
      f.Q.value = 0.6
      g.gain.value = 0.05
      lfo.frequency.value = 0.05
      depth.gain.value = 0.015
      lfo.connect(depth).connect(g.gain)
    }
    // beds keep their own level whatever the style's trim
    const trim = c.createGain()
    trim.gain.value = 1 / this.style.level
    src.connect(f).connect(g).connect(trim).connect(this.out)
    src.start()
    lfo.start()
    this.beds.push(src, lfo)
    return g
  }
}

// ---- the programme playing now ----

let current: Programme | null = null
let wanted: { id: string | null; style: Style | null; seed: number } | null = null
let timer: ReturnType<typeof setInterval> | null = null

function tick() {
  if (!current || !ctx || ctx.state !== 'running') return
  // hidden tabs run timers once a second: schedule further ahead then
  current.schedule(ctx.currentTime + (document.hidden ? 1.6 : 0.3))
}

// Start the programme for `id` (null = silence). The same id keeps playing.
export function playProgramme(id: string | null, style: Style | null, seed: number) {
  wanted = { id, style, seed }
  if (current?.id === id) return
  current?.stop()
  current = null
  const ch = getChain()
  if (!id || !style || !ch || !ctx) return
  current = new Programme(ctx, ch.input, style, seed, id)
  if (!timer) timer = setInterval(tick, 50)
  tick()
}

export function stopAll() {
  wanted = null
  current?.stop()
  current = null
  if (timer) clearInterval(timer)
  timer = null
}

// Debug and test hook: window.__tvAudio.level() is the output RMS (0..1).
if (typeof window !== 'undefined') {
  ;(window as unknown as { __tvAudio: object }).__tvAudio = {
    state: () => ctx?.state ?? 'none',
    programme: () => current?.id ?? null,
    level: () => {
      if (!chain) return 0
      const d = new Float32Array(chain.analyser.fftSize)
      chain.analyser.getFloatTimeDomainData(d)
      return Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length)
    },
  }
}
