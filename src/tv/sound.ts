import { useEffect, useRef } from 'react'
import { getTv } from './store'

// UI sounds, played with Web Audio from public/sounds. Browsers only start audio after a user gesture,
// so the context is created or resumed on the first key press or click.

export type SoundName =
  | 'move' | 'select' | 'back' | 'home_open' | 'home_close' | 'category_changed'
  | 'normal_noti' | 'power_on' | 'power_off' | 'luxo_power_on' | 'ime_select' | 'ime_backspace' | 'vi_fail'

// Files from /usr/share/feedback/sound/operation (sound.conf patterns), converted to MP3.
const FILES: Partial<Record<SoundName, string>> = {
  move: 'move.mp3',
  select: 'select.mp3',
  back: 'back.mp3',
  home_open: 'home_open.mp3',
  normal_noti: 'normal_noti.mp3',
  luxo_power_on: 'luxo_power_on.m4a',
}

let ctx: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function audio() {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

if (typeof window !== 'undefined') {
  const unlock = () => audio()
  window.addEventListener('keydown', unlock)
  window.addEventListener('pointerdown', unlock)
}

function load(file: string) {
  let p = buffers.get(file)
  if (!p) {
    const c = audio()
    p = c
      ? fetch(`${import.meta.env.BASE_URL}sounds/${file}`)
          .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
          .then(b => c.decodeAudioData(b))
          .catch(() => null)
      : Promise.resolve(null)
    buffers.set(file, p)
  }
  return p
}

// Registers the files the UI uses (filled in from the firmware's feedback sounds).
export function registerSounds(files: Partial<Record<SoundName, string>>) {
  Object.assign(FILES, files)
}

// gain: 0..1 relative level; UI feedback sounds are additionally scaled by the Sound Feedback setting.
export function playSound(name: SoundName, gain = 1) {
  const file = FILES[name]
  const c = audio()
  if (!file || !c) return
  const tv = getTv()
  if (tv.power !== 'on' && name !== 'power_off') return
  void load(file).then(buf => {
    if (!buf) return
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.value = gain
    src.connect(g).connect(c.destination)
    src.start()
  })
}

// Feedback sounds follow General & Privacy > Sound Feedback: Off / Low (default) / Medium / High =
// mute / -8 dB / -4 dB / 0 dB.
const FEEDBACK_GAIN = [0, 0.398, 0.631, 1]

export function playFeedback(name: SoundName) {
  const level = Number(getTv().settings['sound-feedback'] ?? 1)
  const gain = FEEDBACK_GAIN[level] ?? FEEDBACK_GAIN[1]
  if (gain > 0) playSound(name, gain)
}

// Plays the focus-move sound whenever `focus` changes after mount (no sound when focus cannot move).
export function useMoveSound(focus: unknown, enabled = true) {
  const prev = useRef(focus)
  useEffect(() => {
    if (prev.current !== focus && enabled) playFeedback('move')
    prev.current = focus
  }, [focus, enabled])
}
