import { useEffect, useRef, useState } from 'react'
import { isNavKey, useRemote, type RemoteKey } from '../../../input/remote'
import { MessageBox } from '../../../components/MessageBox'
import { shell } from '../../../tv/shell'
import { playSound, useMoveSound } from '../../../tv/sound'
import { createValue } from '../state'
import {
  NOTI_RES, deleteAllNotifications, deleteNotification, getNotifications, onNotificationAdded, timestamp,
  useNotifications, type TvNotification,
} from './store'
import { NotificationSettings } from './NotificationSettings'
import './notifications.css'

// Notification center (com.samsung.tv.notification-app, view=center; NotificationCenter +
// NotificationCenterView2): a 52 u card at the top right with a header (new-notification title, Delete
// All and Settings icons) over the list of notifications, or "There are no notifications." and Close.
// Opened from Quick Settings' Notification button (CompHomeNotification.OnSelected launches it with
// __K_EX_ENABLE_HOME_RETURN, so Back returns to the Smart Hub). Spec: spec3/extras.md section 2.

const HIDE_MS = 60000 // NotificationCenter: base("NotiCenterHome", 60000)

type Open = { seq: number; fromHome: boolean }
const open = createValue<Open | null>(null)

export function openNotificationCenter(fromHome = true) {
  shell.toLive() // the launched app takes the screen; csfs hides behind it
  open.set({ seq: Date.now(), fromHome })
}
export function isNotificationCenterOpen() {
  return open.get() !== null
}

export function NotificationCenter() {
  const o = open.use()
  if (!o) return null
  return <CenterView key={o.seq} fromHome={o.fromHome} />
}

type Focus =
  | { at: 'item'; id: number; button: number }
  | { at: 'delete' }
  | { at: 'settings' }
  | { at: 'close' }

export function buttonsOf(n: TvNotification) {
  return n.buttons?.length ? n.buttons : ['Close'] // ButtonContent.CreateDefaultButton (COM_SID_CLOSE)
}

function CenterView({ fromHome }: { fromHome: boolean }) {
  const list = useNotifications(s => s.list)
  const [focus, setFocus] = useState<Focus>(() => {
    const first = getNotifications().list[0]
    return first ? { at: 'item', id: first.id, button: 0 } : { at: 'close' }
  })
  const [leaving, setLeaving] = useState(false)
  const [popup, setPopup] = useState<null | 'deleteAll' | 'settings'>(null)
  // the header title appears when a notification arrives while the center is open (NotificationCount)
  const [arrived, setArrived] = useState(false)
  useMoveSound(JSON.stringify(focus), !popup)

  // auto close after 60 s without keys (OnTimeOut)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const close = (toHome: boolean) => {
    if (leaving) return
    setLeaving(true)
    // Disappear: 200 ms fade, 500 ms scale to 0.95
    setTimeout(() => {
      open.set(null)
      if (toHome) shell.showHub('settings')
    }, 200)
  }
  const resetHide = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => close(false), HIDE_MS)
  }
  useEffect(() => {
    resetHide()
    return () => clearTimeout(hideTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a notification added while the center is open joins the list (no banner) with the noti sound
  useEffect(
    () =>
      onNotificationAdded(() => {
        setArrived(true)
        if (getNotifications().allowSound) playSound('normal_noti')
        resetHide()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // keep the focus valid when items go away (Close on an item deletes it)
  useEffect(() => {
    if (focus.at === 'item' && !list.some(n => n.id === focus.id)) {
      setFocus(list[0] ? { at: 'item', id: list[0].id, button: 0 } : { at: 'close' })
    }
    if (focus.at === 'delete' && !list.length) setFocus({ at: 'settings' })
  }, [list, focus])

  useRemote((key: RemoteKey) => {
    if (leaving || popup) return true
    resetHide()
    if (key === 'Home') {
      close(false)
      return false
    }
    if (!isNavKey(key)) return false
    if (key === 'Back') {
      close(fromHome)
      return true
    }
    if (key === 'Exit') {
      close(false)
      return true
    }
    const idx = focus.at === 'item' ? list.findIndex(n => n.id === focus.id) : -1
    switch (focus.at) {
      case 'item': {
        const n = list[idx]
        const buttons = buttonsOf(n)
        if (key === 'Up') {
          if (focus.button > 0) setFocus({ ...focus, button: focus.button - 1 })
          else if (idx > 0) {
            const p = list[idx - 1]
            setFocus({ at: 'item', id: p.id, button: buttonsOf(p).length - 1 }) // from below: last button
          } else setFocus({ at: 'settings' })
        } else if (key === 'Down') {
          if (focus.button < buttons.length - 1) setFocus({ ...focus, button: focus.button + 1 })
          else if (idx < list.length - 1) setFocus({ at: 'item', id: list[idx + 1].id, button: 0 })
        } else if (key === 'Enter') {
          // NotiCenterItem.OnComponentClicked: run the button's action, then the notification is deleted
          const next = list[idx + 1] ?? list[idx - 1]
          deleteNotification(n.id)
          setFocus(next ? { at: 'item', id: next.id, button: 0 } : { at: 'close' })
        }
        break
      }
      case 'delete':
        if (key === 'Right') setFocus({ at: 'settings' })
        else if (key === 'Down' && list[0]) setFocus({ at: 'item', id: list[0].id, button: 0 })
        else if (key === 'Enter') setPopup('deleteAll')
        break
      case 'settings':
        if (key === 'Left' && list.length) setFocus({ at: 'delete' })
        else if (key === 'Down') setFocus(list[0] ? { at: 'item', id: list[0].id, button: 0 } : { at: 'close' })
        else if (key === 'Enter') setPopup('settings')
        break
      case 'close':
        if (key === 'Up') setFocus({ at: 'settings' })
        else if (key === 'Enter') close(fromHome) // OnReturnButtonClicked
        break
    }
    return true
  })

  return (
    <>
    <div className={`nc ${leaving ? 'is-leaving' : ''}`}>
      <div className="nc__header">
        <div className={`nc__title ${arrived && list.length ? '' : 'is-hidden'}`}>
          You've received a new notification.
        </div>
        <div className="nc__icons">
          {list.length > 0 && (
            <IconButton icon="noti_icon_delete.svg" label="Delete All" focused={focus.at === 'delete' && !popup} />
          )}
          <IconButton icon="noti_icon_settings.svg" label="Settings" focused={focus.at === 'settings' && !popup} />
        </div>
      </div>
      <div className="nc__body">
        {list.length ? (
          <div className="nc__list">
            {list.map(n => (
              <Banner
                key={n.id}
                n={n}
                center
                focusedButton={focus.at === 'item' && focus.id === n.id && !popup ? focus.button : -1}
              />
            ))}
          </div>
        ) : (
          <div className="nc__empty">
            <div className="nc__empty-text">There are no notifications.</div>
            <div className={`nc-btn nc-btn--wide ${focus.at === 'close' && !popup ? 'is-focused' : ''}`}>Close</div>
          </div>
        )}
      </div>
    </div>
      {popup === 'deleteAll' &&
        (list.length ? (
          <MessageBox
            title="Delete All"
            message="Do you want to delete all notifications?"
            buttons={['Delete', 'Cancel']}
            onClose={b => {
              setPopup(null)
              if (b === 0) {
                deleteAllNotifications()
                setFocus({ at: 'close' })
              }
            }}
          />
        ) : (
          <MessageBox title="Delete All" message="There are no notifications." buttons={['OK']} onClose={() => setPopup(null)} />
        ))}
      {popup === 'settings' && <NotificationSettings onClose={() => setPopup(null)} />}
    </>
  )
}

function IconButton({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <div className={`nc-icon ${focused ? 'is-focused' : ''}`}>
      <span className="nc-icon__glyph" style={{ maskImage: `url(${NOTI_RES}/${icon})`, WebkitMaskImage: `url(${NOTI_RES}/${icon})` }} />
      {focused && <div className="nc-tip">{label}</div>}
    </div>
  )
}

// BannerGUI: padding 3 u; [icon area 6 u | text 38 u: title T24 600, description T20 400, timestamp
// T24 600 CP_Point3100]; buttons 44 u wide below (padding top 3 u). The banner (toast) shows no
// timestamp and no default button.
export function Banner({ n, center, focusedButton = -1 }: { n: TvNotification; center?: boolean; focusedButton?: number }) {
  const buttons = center ? buttonsOf(n) : n.buttons ?? []
  const two = buttons.length === 2
  return (
    <div className="nb">
      <div className="nb__row">
        <div className="nb__icon-area">
          <img className="nb__icon" src={n.icon || `${NOTI_RES}/noti_icon_default.svg`} alt="" />
        </div>
        <div className="nb__text">
          <div className="nb__title">{n.title}</div>
          {n.description && <div className="nb__desc">{n.description}</div>}
          {center && <div className="nb__time">{timestamp(n.time)}</div>}
        </div>
      </div>
      {buttons.length > 0 && (
        <div className={`nb__buttons ${two ? 'nb__buttons--row' : ''}`}>
          {buttons.map((b, i) => (
            <div key={b} className={`nc-btn ${two ? '' : 'nc-btn--wide'} ${focusedButton === i ? 'is-focused' : ''}`}>{b}</div>
          ))}
        </div>
      )}
    </div>
  )
}
