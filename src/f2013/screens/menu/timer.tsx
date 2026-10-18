import { useState } from 'react'
import type { RemoteKey } from '../../../input/remote'
import { useRemote } from '../../../input/remote'
import { playUi, UI_SOUND } from '../../tv/sound'
import { getSetting, getTv, setSetting } from '../../tv/store'
import { ActionFrame, baseKeys, type AWProps } from './actionwin'
import { IMG } from './parts'
import type { MenuItem } from './types'
import { VALUE_TEXT } from './values'

// System > Time > On Timer 1-3 / Off Timer 1-3 (COnTimerActionWindow / COffTimerActionWindow on
// CTimerActionWindowBase, a list action window; MenuOSDInfo TIMER_*):
//  - window 602 x (48 x (visible - 2) + MENU_ACTION_WINDOW_1_ITEM_H 224 + TIMER_WINDOW_SEPARATOR_ITEM_H
//    152), visible 7 (On) / 3 (Off), centred; title = the item; one Close button
//  - list from MENU_ACTION_WINDOW_LIST_Y 56 + 24: Setup (COn/COffTimerRepeatSublistDataItem: Off, Once,
//    Everyday, Mon~Fri, Mon~Sat, Sat~Sun, Manual), the separator item holding the week grid (24,153)
//    7 columns 80 apart (Sun..Sat, row 45 + 56, 20 px check boxes, enabled for Manual), then Time, and for
//    the On Timer Volume (0..100), Source (TV / USB), Aerial, Channel, Music, Photo (USB only)
//  - the timer is written when the window closes (t_WriteTimer). The menu row shows "Off" or the time
//    (COnTimerDataItem::GetMenuItemDataText).
// Item rows: title at x 48, value right-aligned in x 328..554, size 24 (inferred renderer mapping); Time
// is "HH : MM" with Left/Right between the fields, Up/Down or the number keys to change (inferred).

const REPEATS = ['Off', 'Once', 'Everyday', 'Mon~Fri', 'Mon~Sat', 'Sat~Sun', 'Manual']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SOURCES = ['TV', 'USB']
const AERIALS = ['Air', 'Cable']

type Timer = { repeat: number; days: number; hour: number; minute: number; volume: number; source: number; aerial: number; channel: number }
const DEFAULT: Timer = { repeat: 0, days: 0, hour: 0, minute: 0, volume: 10, source: 0, aerial: 0, channel: 0 }

function load(id: number): Timer {
  try {
    return { ...DEFAULT, ...JSON.parse(String(getSetting<string>(`menu.timer.${id}`, '{}'))) }
  } catch {
    return { ...DEFAULT }
  }
}
function save(id: number, t: Timer) {
  setSetting(`menu.timer.${id}`, JSON.stringify(t))
}

const pad = (n: number) => String(n).padStart(2, '0')
export function timerText(id: number) {
  const t = load(id)
  return t.repeat === 0 ? 'Off' : `${pad(t.hour)}:${pad(t.minute)}`
}
for (const id of [0x3a2, 0x3a3, 0x3a4, 0x3aa, 0x3ab, 0x3ac]) VALUE_TEXT[id] = () => timerText(id)

type Row = 'setup' | 'week' | 'time' | 'volume' | 'source' | 'aerial' | 'channel'

export function TimerWindow({ item, close, exitMenu }: AWProps & { item: MenuItem }) {
  const on = item.id >= 0x3a2 && item.id <= 0x3a4
  const [t, setT] = useState<Timer>(() => load(item.id))
  const [focus, setFocus] = useState<Row | 'close'>('setup')
  const [day, setDay] = useState(0)
  const [field, setField] = useState(0)          // Time: 0 hours, 1 minutes
  const [typed, setTyped] = useState('')
  const [popup, setPopup] = useState<{ row: 'setup' | 'source' | 'aerial'; focus: number } | null>(null)
  const manual = t.repeat === 6
  const active = t.repeat !== 0
  const rows: Row[] = on ? ['setup', 'week', 'time', 'volume', 'source', 'aerial', 'channel'] : ['setup', 'week', 'time']
  const enabled = (r: Row) => r === 'setup' || (r === 'week' ? manual : active && (r !== 'aerial' && r !== 'channel' ? true : t.source === 0))
  const order: (Row | 'close')[] = [...rows.filter(enabled), 'close']
  const upd = (p: Partial<Timer>) => setT(x => ({ ...x, ...p }))
  const finish = () => {
    save(item.id, t)
    close()
  }
  const channels = getTv().channels
  const popupItems = (r: 'setup' | 'source' | 'aerial') => (r === 'setup' ? REPEATS : r === 'source' ? SOURCES : AERIALS)

  useRemote((k: RemoteKey) => {
    if (popup) {
      const items = popupItems(popup.row)
      if (k === 'Up' || k === 'Down') {
        const f = popup.focus + (k === 'Up' ? -1 : 1)
        if (f >= 0 && f < items.length) {
          setPopup({ ...popup, focus: f })
          playUi(UI_SOUND.MOVE)
        }
      } else if (k === 'Enter') {
        playUi(UI_SOUND.SELECT)
        if (popup.row === 'setup') upd({ repeat: popup.focus })
        else if (popup.row === 'source') upd({ source: popup.focus })
        else upd({ aerial: popup.focus })
        setPopup(null)
      } else if (k === 'Back' || k === 'Left') setPopup(null)
      else if (k === 'Exit' || k === 'Settings') exitMenu()
      return true
    }
    if (k === 'Up' || k === 'Down') {
      const i = order.indexOf(focus)
      const n = i + (k === 'Up' ? -1 : 1)
      if (n >= 0 && n < order.length) {
        setFocus(order[n])
        setTyped('')
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k === 'Left' || k === 'Right') {
      const d = k === 'Left' ? -1 : 1
      if (focus === 'week') {
        const n = day + d
        if (n >= 0 && n < 7) {
          setDay(n)
          playUi(UI_SOUND.MOVE)
        }
      } else if (focus === 'time') {
        const n = field + d
        if (n >= 0 && n < 2) {
          setField(n)
          setTyped('')
          playUi(UI_SOUND.MOVE)
        } else if (n === 2) {
          // past the minutes: step the minute value (inferred)
          upd({ minute: (t.minute + 1) % 60 })
        }
      } else if (focus === 'volume') {
        const v = Math.max(0, Math.min(100, t.volume + d))
        if (v !== t.volume) {
          upd({ volume: v })
          playUi(UI_SOUND.MOVE)
        }
      } else if (focus === 'channel' && channels.length) {
        upd({ channel: (t.channel + d + channels.length) % channels.length })
        playUi(UI_SOUND.MOVE)
      }
      return true
    }
    if (k.startsWith('Digit') && focus === 'time') {
      const s = typed + k.slice(5)
      playUi(UI_SOUND.OSK_KEYPAD)
      if (s.length < 2) setTyped(s)
      else {
        const v = Number(s)
        if (field === 0) {
          upd({ hour: Math.min(23, v) })
          setField(1)
        } else upd({ minute: Math.min(59, v) })
        setTyped('')
      }
      return true
    }
    if (k === 'Enter') {
      playUi(UI_SOUND.SELECT)
      if (focus === 'close') finish()
      else if (focus === 'setup') setPopup({ row: 'setup', focus: t.repeat })
      else if (focus === 'source') setPopup({ row: 'source', focus: t.source })
      else if (focus === 'aerial') setPopup({ row: 'aerial', focus: t.aerial })
      else if (focus === 'week') upd({ days: t.days ^ (1 << day) })
      return true
    }
    if (k === 'Back') {
      finish()
      return true
    }
    if (baseKeys(k, { close: finish, exitMenu })) return true
    return k !== 'Home' && k !== 'VolumeUp' && k !== 'VolumeDown' && k !== 'Mute'
  })

  const W = 602
  const visible = on ? 7 : 3
  const H = 48 * (visible - 2) + 224 + 152
  const rowY: Record<Row, number> = { setup: 80, week: 128, time: 280, volume: 328, source: 376, aerial: 424, channel: 472 }
  const value: Record<Row, string> = {
    setup: REPEATS[t.repeat],
    week: '',
    time: '',
    volume: String(t.volume),
    source: SOURCES[t.source],
    aerial: AERIALS[t.aerial],
    channel: channels[t.channel] ? `${channels[t.channel].number} ${channels[t.channel].name}` : '',
  }
  const title: Record<Row, string> = { setup: 'Setup', week: '', time: 'Time', volume: 'Volume', source: 'Source', aerial: 'Aerial', channel: 'Channel' }
  return (
    <ActionFrame x={(1280 - W) / 2} y={(720 - H) / 2} w={W} h={H} title={item.t} buttons={['Close']} focus={focus === 'close' ? 0 : -1}>
      {rows.filter(r => r !== 'week').map(r => {
        const f = focus === r && !popup
        const en = enabled(r)
        return (
          <div key={r} className="m13-tm-row" style={{ top: rowY[r], opacity: en ? 1 : 0.4 }}>
            {f && <div className="m13-eq-focus" />}
            <span className="m13-tm-title" style={{ color: f ? '#fdd911' : '#fff' }}>{title[r]}</span>
            {r === 'time' ? (
              <span className="m13-tm-value">
                <b className={f && field === 0 ? 'm13-tm-field--on' : ''}>{f && field === 0 && typed ? typed : pad(t.hour)}</b>
                {' : '}
                <b className={f && field === 1 ? 'm13-tm-field--on' : ''}>{f && field === 1 && typed ? typed : pad(t.minute)}</b>
              </span>
            ) : (
              <span className="m13-tm-value" style={{ color: f ? '#fdd911' : '#fff' }}>{value[r]}</span>
            )}
          </div>
        )
      })}
      {DAYS.map((d, i) => {
        const f = focus === 'week' && day === i && !popup
        return (
          <div key={d} className="m13-tm-day" style={{ left: 24 + i * 80, top: 153, opacity: manual ? 1 : 0.4 }}>
            {f && <div className="m13-tm-day-focus" />}
            <span>{d}</span>
            <i className={t.days & (1 << i) ? 'm13-tm-check--on' : ''} />
          </div>
        )
      })}
      {popup && (
        <div className="m13-tm-popup" style={{ left: 602 - 325, top: rowY[popup.row] + 48 }}>
          <TimerPopup items={popupItems(popup.row)} focus={popup.focus} current={popup.row === 'setup' ? t.repeat : popup.row === 'source' ? t.source : t.aerial} />
        </div>
      )}
    </ActionFrame>
  )
}

function TimerPopup({ items, focus, current }: { items: string[]; focus: number; current: number }) {
  const W = 325
  const H = [0, 128, 162, 210, 258, 306, 354, 402][Math.min(7, items.length)]
  return (
    <div className="m13-popup" style={{ left: 0, top: 0, width: W, height: H }}>
      <div className="m13-popup-shadow" style={{ width: W, height: H }} />
      <div className="m13-popup-fill" style={{ left: 10, top: 10, width: W - 21, height: H - 21 }} />
      <div className="m13-popup-bg" style={{ left: 10, top: 10, width: W - 21, height: H - 21 }} />
      <div className="m13-popup-list" style={{ left: 10, top: 10, width: W - 21, height: H - 21 }}>
        {items.map((s, i) => (
          <div key={s} className="m13-popup-item" style={{ top: 22 + i * 48 }}>
            {i === focus && <div className="m13-popup-focus" style={{ top: (48 - 85) / 2, width: 320 - 21 + 16 }} />}
            {i === current && <img className="m13-popup-check" src={`${IMG}/list_check_icon.png`} alt="" />}
            <div className="m13-popup-text" style={{ color: i === focus ? '#fdd911' : '#fff' }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
