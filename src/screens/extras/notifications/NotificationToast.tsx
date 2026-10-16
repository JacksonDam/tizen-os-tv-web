import { useEffect, useState } from 'react'
import { playSound } from '../../../tv/sound'
import { useTv } from '../../../tv/store'
import { getNotifications, greetOnce, NOTI_RES, onNotificationAdded, type TvNotification } from './store'
import { Banner, isNotificationCenterOpen } from './NotificationCenter'

// The banner a new notification raises (NotificationBanner / NotificationBannerView): the same banner
// layout at the top right (padding T 5 u, R 5 u), appearing with a 200 ms fade from 0.5 and a 500 ms
// elastic scale from 0.9, the notification sound after the show animation, hidden after 5 s
// (NotificationInfo.AssignHideTime: 5 s, 15 s with Voice Guide).

const HIDE_MS = 5000
const SHOW_MS = 500

export function NotificationToast() {
  const [toast, setToast] = useState<{ n: TvNotification; seq: number; leaving: boolean } | null>(null)

  useEffect(
    () =>
      onNotificationAdded(n => {
        if (isNotificationCenterOpen()) return // the center lists it instead
        setToast({ n, seq: Date.now(), leaving: false })
      }),
    [],
  )

  useEffect(() => {
    if (!toast || toast.leaving) return
    const s = setTimeout(() => {
      if (getNotifications().allowSound) playSound('normal_noti')
    }, SHOW_MS)
    const h = setTimeout(() => setToast(t => (t ? { ...t, leaving: true } : t)), HIDE_MS)
    return () => {
      clearTimeout(s)
      clearTimeout(h)
    }
  }, [toast])

  useEffect(() => {
    if (!toast?.leaving) return
    const t = setTimeout(() => setToast(null), 300)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null
  return (
    <div key={toast.seq} className={`ntoast ${toast.leaving ? 'is-leaving' : ''}`}>
      <Banner n={toast.n} />
    </div>
  )
}

// Device arrivals in this mock: the game console on HDMI 1 announces itself (over CEC) the first time it
// becomes the active source, as SmartThings' iot-hub-control does for a newly connected device
// (TV_SID_MIX_HAS_BEEN_CONNECTED_DEVICE "<<A>> has been connected."; trigger inferred).
export function NotificationTriggers() {
  const source = useTv(s => s.source)
  useEffect(() => {
    if (source !== 'HDMI1') return
    const t = setTimeout(
      () =>
        greetOnce('HDMI1', {
          title: 'SmartThings',
          description: 'Game Console has been connected.',
          icon: `${NOTI_RES}/st_ic_device_game_control.svg`,
        }),
      6000, // after the input switch screen and the 5 s source banner (inferred)
    )
    return () => clearTimeout(t)
  }, [source])
  return null
}
