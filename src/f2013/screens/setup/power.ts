import { useSyncExternalStore } from 'react'
import { closeApp, openApp } from '../../shell'
import { getSetting, getTv, setTv } from '../../tv/store'

// Power on/off and the boot sequence (spec/setup.md "Power").
//
// Every power-on of the X12 set is a cold boot: the micom powers the SoC, the boot loader shows the
// FastLogo images (/mtd_exe/FastLogo/FastLogoA_1280x720.bmp "SMART TV", then five hexagons cut from
// FastLogoB_1280x720.bmp) while Linux and exeDSP start, then exeDSP takes over the screen. The logo
// is drawn outside exeDSP (exeTV: "Set Fast Logo On/Off", "EndFastLogo", /mtd_rwarea/FastLogoOff), so
// its timing comes from the reference footage of two first boots (sAmJMgr1va0, HvCFIqTwsGQ):
//   logo A 0.80-0.86 s, black 0.17-0.23 s, hexagons 1.13-1.6 s (until the loader hands over).
// The Menu's "Boot Logo" (System > General, CFastLogoSublistDataItem -> TV option 0x47) turns the logo
// off; its setting id here is 'bootLogo' (1 = On, the default: the first boots in the footage show it).
//
// After the hand-over the screen stays black while exeDSP starts (the volume OSD already works then:
// HvCFIqTwsGQ t=13 s). On a first boot the welcome movie starts 12.4 s (HvCFIqTwsGQ) to 16 s
// (sAmJMgr1va0) after the hexagons go. On a normal power-on the TV picture comes back after
// BOOT.normalReadyMs (inferred: no footage of a normal power-on; exeDSP's viewer starts sooner than the
// home/PnP stack that delays the movie).
//
// Power off: exeDSP draws nothing (no power-off window or animation in exeDSP: the micom switches the
// panel off), so picture and OSD go black at once.

export const BOOT = {
  logoDelayMs: 1500,   // power key -> logo A (inferred: HvCFIqTwsGQ shows it 1.6 s into the clip)
  logoMs: 800,         // FastLogoA on screen (sAmJMgr1va0 2.53-3.33 s)
  gapMs: 200,          // black between the two (0.17-0.23 s)
  hexMs: 1200,         // FastLogoB hexagons (1.13 s HvCFIqTwsGQ, 1.6 s sAmJMgr1va0)
  hexFadeMs: 150,      // the hexagons ramp up/down over ~5 frames in sAmJMgr1va0
  firstBootReadyMs: 12400, // hexagons gone -> welcome movie (HvCFIqTwsGQ 3.8 s -> 16.2 s)
  normalReadyMs: 2500, // hexagons gone -> TV picture (inferred)
}

export type BootPhase = 'off' | 'wait' | 'logo' | 'gap' | 'hex' | 'loading' | 'ready'

let phase: BootPhase = 'ready'
let timers: ReturnType<typeof setTimeout>[] = []
const subs = new Set<() => void>()

function set(p: BootPhase) {
  phase = p
  subs.forEach(f => f())
}

export function getBootPhase() {
  return phase
}

export function useBootPhase(): BootPhase {
  return useSyncExternalStore(
    f => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => phase,
  )
}

function clear() {
  timers.forEach(clearTimeout)
  timers = []
}

function at(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms))
}

// What exeDSP shows once it is up: Plug & Play while setup is pending, otherwise the TV picture.
function handOver() {
  set('ready')
  if (!getTv().setupDone) openApp('pnp')
}

// Power on (cold boot). `logo` false skips the boot loader's logo (Boot Logo off, or ?boot=0).
export function powerOn(logo = getSetting<number>('bootLogo', 1) !== 0) {
  clear()
  setTv({ power: 'on' })
  const ready = getTv().setupDone ? BOOT.normalReadyMs : BOOT.firstBootReadyMs
  if (!logo) {
    set('loading')
    at(ready, handOver)
    return
  }
  let t = 0
  set('wait')
  at((t += BOOT.logoDelayMs), () => set('logo'))
  at((t += BOOT.logoMs), () => set('gap'))
  at((t += BOOT.gapMs), () => set('hex'))
  at((t += BOOT.hexMs), () => set('loading'))
  at(t + ready, handOver)
}

export function powerOff() {
  clear()
  closeApp()
  set('off')
  setTv({ power: 'standby' })
}

// The page load is a cold boot; ?boot=0 skips the logo and the start-up wait.
export function bootOnLoad() {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('boot')
  if (q === '0') handOver()
  else powerOn()
}
