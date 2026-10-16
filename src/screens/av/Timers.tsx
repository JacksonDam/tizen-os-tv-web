import { useCallback, useEffect, useRef, useState } from 'react'
import { onAnyKey, useRemote } from '../../input/remote'
import { currentChannel, getSetting, getTv, setSetting, useTv } from '../../tv/store'
import { shell, useShellView } from '../../tv/shell'
import { startSleep, sleepLeftMs, TIMER_SPEED } from './sleepTimer'
import { AvPopup } from './AvPopup'

// tv-viewer's power timers and picture-off (CAppControlShowHandleProcessor m_ProcessShowSleepTimer,
// m_ProcessShowAutoPowerOff, m_ProcessShowAutoPictureOffTimer; texts from
// CPopupBannerViewCommonUtil::GetPopupContent, tv-viewer.mo):
// - Sleep Timer: one minute before the end, "Your TV will turn off automatically. Continue using this
//   sleep timer?" with a seconds countdown; OK keeps it, Cancel turns the timer off.
// - Auto Power Off (4/6/8 h without a key): "This is the set auto power off time." with a 60 s countdown
//   and OK to cancel.
// - Off Timer: turns the TV off at the set time on the set days.
// - Auto Picture Off: an audio-only channel turns the screen off after a countdown; "Picture Off Now" or
//   "Don't use". The 10 s countdown and the 5 s delay before it are (inferred).

type Popup = { kind: 'sleep' | 'apo' | 'apic'; left: number }

const SLEEP_TEXT = 'Your TV will turn off automatically. Continue using this sleep timer?\nRemaining Time: <<A>> second(s)'
const APO_TEXT = 'This is the set auto power off time.\nRemaining Time : <<A>>second(s)\nDo you want to cancel the auto power off?'
const APIC_TEXT =
  "The screen will turn off in <<A>> second(s) as Auto Picture Off is active.\nIf you no longer want to use it, select the 'Don't Use' button."

const DAYS: Record<string, number[]> = {
  SID_ONCE: [0, 1, 2, 3, 4, 5, 6],
  SID_EVERYDAY: [0, 1, 2, 3, 4, 5, 6],
  SID_MON_FRI: [1, 2, 3, 4, 5],
  SID_MON_SAT: [1, 2, 3, 4, 5, 6],
  SID_SAT_SUN: [0, 6],
  SID_MANUAL: [0, 1, 2, 3, 4, 5, 6],
}

const APIC_DELAY = 5 // s of audio-only before the countdown (inferred)
const APIC_COUNT = 10

export function AvTimers() {
  const sleep = useTv(s => Number(s.settings.sleeptimer ?? 0))
  const pictureOffOn = useTv(s => Number(s.settings['picture-off'] ?? 0) === 1)
  const audioOnly = useTv(s => s.source === 'TV' && currentChannel(s)?.kind === 'radio')
  const view = useShellView()
  const [popup, setPopup] = useState<Popup | null>(null)
  const [screenOff, setScreenOff] = useState(false)
  const popupRef = useRef(popup)
  popupRef.current = popup

  // the TV forgets the sleep timer when it turns off
  useEffect(() => {
    if (getSetting('sleeptimer', 0)) setSetting('sleeptimer', 0)
    startSleep(0)
  }, [])
  const prevSleep = useRef(sleep)
  useEffect(() => {
    if (prevSleep.current === sleep) return
    prevSleep.current = sleep
    startSleep(sleep)
    if (!sleep) setPopup(p => (p?.kind === 'sleep' ? null : p))
  }, [sleep])

  // Auto Picture Off has exitmenu=1: switching it on closes the menu (menu-tv.json picture-off)
  const prevApic = useRef(pictureOffOn)
  useEffect(() => {
    if (pictureOffOn && !prevApic.current) shell.toLive()
    prevApic.current = pictureOffOn
  }, [pictureOffOn])

  // user activity for Auto Power Off
  const lastKey = useRef(Date.now())
  useEffect(() => onAnyKey(() => (lastKey.current = Date.now())), [])

  // audio-only time for Auto Picture Off
  const audioSince = useRef(0)
  useEffect(() => {
    audioSince.current = audioOnly ? Date.now() : 0
    if (!audioOnly) {
      setScreenOff(false)
      setPopup(p => (p?.kind === 'apic' ? null : p))
    }
  }, [audioOnly])

  const lastOffMinute = useRef('')
  useEffect(() => {
    const t = setInterval(() => {
      const tv = getTv()
      const p = popupRef.current
      // Sleep Timer
      const left = sleepLeftMs()
      if (Number(tv.settings.sleeptimer ?? 0) > 0 && left >= 0) {
        if (left <= 0) {
          setPopup(null)
          setSetting('sleeptimer', 0)
          shell.standby()
          return
        }
        if (left <= 60_000 && (!p || p.kind === 'sleep')) setPopup({ kind: 'sleep', left: Math.ceil(left / 1000) })
      }
      // Auto Power Off
      const hours = Number(tv.settings['auto-power-off'] ?? 0)
      if (hours > 0) {
        const idle = (Date.now() - lastKey.current) * TIMER_SPEED
        const remain = Math.ceil((hours * 3_600_000 - idle) / 1000)
        if (remain <= 0) {
          setPopup(null)
          shell.standby()
          return
        }
        if (remain <= 60 && (!p || p.kind === 'apo')) setPopup({ kind: 'apo', left: remain })
      } else if (p?.kind === 'apo') setPopup(null)
      // Off Timer
      const setup = String(tv.settings['offtimer1-setup'] ?? 'SID_OFF')
      const at = String(tv.settings['offtimer1-timer'] ?? '')
      const now = new Date()
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (setup !== 'SID_OFF' && at && hm === at && lastOffMinute.current !== hm && DAYS[setup]?.includes(now.getDay())) {
        lastOffMinute.current = hm
        if (setup === 'SID_ONCE') setSetting('offtimer1-setup', 'SID_OFF')
        shell.standby()
        return
      }
      // Auto Picture Off
      if (Number(tv.settings['picture-off'] ?? 0) === 1 && audioSince.current) {
        const s = ((Date.now() - audioSince.current) * TIMER_SPEED) / 1000
        const remain = Math.ceil(APIC_DELAY + APIC_COUNT - s)
        if (remain <= 0) {
          audioSince.current = 0
          setPopup(q => (q?.kind === 'apic' ? null : q))
          setScreenOff(true)
        } else if (remain <= APIC_COUNT && (!p || p.kind === 'apic')) setPopup({ kind: 'apic', left: remain })
      }
    }, 1000 / Math.min(TIMER_SPEED, 10))
    return () => clearInterval(t)
  }, [])

  const close = useCallback((button: number | null) => {
    const p = popupRef.current
    setPopup(null)
    if (!p) return
    if (p.kind === 'sleep' && button === 1) setSetting('sleeptimer', 0)
    if (p.kind === 'apo') lastKey.current = Date.now()
    if (p.kind === 'apic') {
      if (button === 0) {
        audioSince.current = 0
        setScreenOff(true)
      } else if (button === 1) setSetting('picture-off', 0)
      else audioSince.current = Date.now()
    }
  }, [])

  return (
    <>
      {screenOff && <ScreenOff onWake={() => setScreenOff(false)} />}
      {popup?.kind === 'sleep' && (
        <AvPopup title="Sleep Timer" message={SLEEP_TEXT.replace('<<A>>', String(popup.left))} buttons={['OK', 'Cancel']} onClose={close} />
      )}
      {popup?.kind === 'apo' && (
        <AvPopup title="Auto Power Off" message={APO_TEXT.replace('<<A>>', String(popup.left))} buttons={['OK']} onClose={close} />
      )}
      {popup?.kind === 'apic' && view.app !== 'channel-search' && (
        <AvPopup message={APIC_TEXT.replace('<<A>>', String(popup.left))} buttons={['Picture Off Now', "Don't use"]} onClose={close} />
      )}
    </>
  )
}

// Picture off: the panel goes dark while the sound plays on; any key (other than volume) turns it back on.
function ScreenOff({ onWake }: { onWake: () => void }) {
  useRemote(() => {
    onWake()
    return true
  })
  return <div className="av-screen-off" />
}
