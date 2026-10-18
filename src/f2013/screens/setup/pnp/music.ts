import { F13 } from '../../../assets'
import { tvGain } from '../../../tv/sound'
import { getTv } from '../../../tv/store'

// Plug & Play background music: /mtd_rocommon/PCM/nature1.mp3 (42.3 s), opened as PIP media when PnP
// starts from the power-on path (CPlugPlayUtilTV::InitializePlugPlayBackgroundMusic @023b452c,
// m_IsAvailablePlugPlayBackgroundMusic = PnP after a factory reset), started when the welcome movie ends,
// replayed from the start at its end (loops), stopped with the PnP state (SetPlugPlayState(false)).
// It plays through the TV speakers, so it follows the TV volume and mute. Browsers only start audio
// after a user gesture: until then it waits and starts on the first key.

let audio: HTMLAudioElement | null = null
let sync: ReturnType<typeof setInterval> | undefined

function level() {
  const s = getTv()
  return s.power !== 'on' ? 0 : tvGain(s.volume, s.muted)
}

function retryOnGesture() {
  const go = () => {
    window.removeEventListener('keydown', go)
    window.removeEventListener('pointerdown', go)
    if (audio) void audio.play().catch(() => {})
  }
  window.addEventListener('keydown', go)
  window.addEventListener('pointerdown', go)
}

export function startMusic() {
  if (audio || typeof Audio === 'undefined') return
  audio = new Audio(`${F13}/setup/pnp/nature1.mp3`)
  audio.loop = true
  audio.volume = level()
  audio.play().catch(retryOnGesture)
  sync = setInterval(() => {
    if (audio) audio.volume = level()
  }, 200)
}

export function stopMusic() {
  clearInterval(sync)
  if (!audio) return
  audio.pause()
  audio.src = ''
  audio = null
}
