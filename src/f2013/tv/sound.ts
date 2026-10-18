import { useEffect, useRef } from 'react'
import { F13 } from '../assets'
import { getTv } from './store'

// 2013 UI sounds (exeDSP CAudioUIUtil): raw PCM in /mtd_rocommon/PCM (48 kHz, 16-bit, stereo, per
// t_PlayAudio's renderer setup), converted to MP3 in public/f13/sounds. The firmware addresses them
// by a sound id (t_CreateAudio's switch); ids 0 and 10 have no file. One sound plays at a time: a new
// PlayAudio stops the one playing (t_PlayAudio state 1 -> 2). No sound plays while the UI sound
// volume (CAudioUIUtil +0x4918, GetCurrentAudioVolume) is 0.
export const UI_SOUND = {
  MOVE: 1,             // ids 1-6, 14, 16 all use 1_move
  BACK: 7,
  SELECT: 8,           // also 15
  CANCEL: 9,
  OSK_KEYPAD: 11,      // also 23
  OSK_ENTER: 12,       // also 22
  OSK_BACKSPACE: 13,   // also 21
  PREPARING: 17,
  VOLCH: 18,
  SHUTTER_PHOTO: 19,
  SHUTTER_VIDEO: 20,
  OSK_SPACE: 24,
  POPUP: 25,
  MOVE_PANEL: 26,
  NOKEY: 27,
} as const

const FILE_BY_ID: Record<number, string> = {
  1: '1_move', 2: '1_move', 3: '1_move', 4: '1_move', 5: '1_move', 6: '1_move', 14: '1_move', 16: '1_move',
  7: '2_back',
  8: '3_select', 15: '3_select',
  9: '4_cancel',
  11: '8_osk_keypad', 23: '8_osk_keypad',
  12: '7_osk_enter', 22: '7_osk_enter',
  13: '6_osk_backspace', 21: '6_osk_backspace',
  17: '4_preparing',
  18: '5_volch',
  19: '6_shutter_p',
  20: '7_shutter_v',
  24: '9_osk_spacebar',
  25: '5_popup',
  26: 'move_panel',
  27: 'nokey',
}

let ctx: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
let playing: AudioBufferSourceNode | null = null

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

// Browsers start audio only after a user gesture: create or resume the context on the first input.
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
      ? fetch(`${F13}/sounds/${file}.mp3`)
          .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
          .then(b => c.decodeAudioData(b))
          .catch(() => null)
      : Promise.resolve(null)
    buffers.set(file, p)
  }
  return p
}

// The UI sound level 0..1 (0 = off). The Menu wires its setting in with setUiSoundLevel.
let level = 1
export function setUiSoundLevel(v: number) {
  level = v
}

export function playUi(id: number) {
  const file = FILE_BY_ID[id]
  const c = audio()
  if (!file || !c || level <= 0 || getTv().power !== 'on') return
  void load(file).then(buf => {
    if (!buf) return
    try {
      playing?.stop()
    } catch {
      /* already stopped */
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.value = level
    src.connect(g).connect(c.destination)
    src.start()
    playing = src
  })
}

// Plays the move sound whenever `focus` changes after mount.
export function useMoveSound(focus: unknown, enabled = true) {
  const prev = useRef(focus)
  useEffect(() => {
    if (prev.current !== focus && enabled) playUi(UI_SOUND.MOVE)
    prev.current = focus
  }, [focus, enabled])
}

// The TV's volume (0-100) as a playback gain for media the UI plays (welcome movie, setup music). A
// linear volume/100 makes the default 10 almost silent; TV volume steps are closer to decibels: 20 and
// above plays at full level, each step below 0.5 dB quieter, 0 silent (inferred).
export function tvGain(volume: number, muted: boolean) {
  if (muted || volume <= 0) return 0
  return Math.min(1, Math.pow(10, (volume - 20) / 40))
}
