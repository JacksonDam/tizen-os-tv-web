import { useState } from 'react'
import { playPauseDown, playPauseUp, pressKey, type RemoteKey } from '../input/remote'
import './remote.css'

// On-screen remote docked beside the TV: every button sends the same key as its keyboard shortcut
// (shown in the button's tooltip).

type B = { key: RemoteKey; label: string; kbd: string; cls?: string }

const TOP: B[] = [
  { key: 'Power', label: 'Power', kbd: 'P', cls: 'rc-btn--power' },
  { key: 'Source', label: 'Source', kbd: 'S' },
  { key: 'Settings', label: 'Settings', kbd: 'Q' },
]
const DIGITS: B[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => ({ key: `Digit${d}` as RemoteKey, label: String(d), kbd: String(d) }))
const ROW: B[] = [
  { key: 'Back', label: 'Back', kbd: 'Esc' },
  { key: 'Home', label: 'Home', kbd: 'H' },
  { key: 'Info', label: 'Info', kbd: 'I' },
]
const ROW2: B[] = [
  { key: 'Mute', label: 'Mute', kbd: 'M' },
  { key: 'ChannelList', label: 'Ch. List', kbd: 'L' },
  { key: 'Exit', label: 'Exit', kbd: 'X' },
]
const ROW3: B[] = [
  { key: 'Guide', label: 'Guide', kbd: 'G' },
  { key: 'More', label: '123', kbd: 'N' },
]
const COLOURS: B[] = [
  { key: 'Red', label: 'Red', kbd: 'F1', cls: 'rc-btn--red' },
  { key: 'Green', label: 'Green', kbd: 'F2', cls: 'rc-btn--green' },
  { key: 'Yellow', label: 'Yellow', kbd: 'F3', cls: 'rc-btn--yellow' },
  { key: 'Blue', label: 'Blue', kbd: 'F4', cls: 'rc-btn--blue' },
]

function Btn({ b }: { b: B }) {
  return (
    <button className={`rc-btn ${b.cls ?? ''}`} title={`${b.label} (${b.kbd})`} onClick={() => pressKey(b.key)}>
      {b.label}
    </button>
  )
}

// ?remote=0 hides the panel (automated captures need the stage at exactly 1920x1080).
const HIDDEN = typeof location !== 'undefined' && new URLSearchParams(location.search).get('remote') === '0'

export function RemotePanel() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('tizen-os-tv-web.remote') !== 'closed'
    } catch {
      return true
    }
  })
  const toggle = () => {
    setOpen(o => {
      try {
        localStorage.setItem('tizen-os-tv-web.remote', o ? 'closed' : 'open')
      } catch {
        /* ignore */
      }
      return !o
    })
  }

  if (HIDDEN) return null
  if (!open) {
    return (
      <button className="rc-show" onClick={toggle}>
        Show remote
      </button>
    )
  }
  return (
    <aside className="rc">
      <button className="rc-hide" onClick={toggle}>
        Hide remote
      </button>
      <div className="rc-body">
        <div className="rc-row">{TOP.map(b => <Btn key={b.key} b={b} />)}</div>
        <div className="rc-digits">{DIGITS.map(b => <Btn key={b.key} b={b} />)}</div>
        <div className="rc-dpad">
          <button className="rc-dpad__up" title="Up (Arrow)" onClick={() => pressKey('Up')} aria-label="Up" />
          <button className="rc-dpad__left" title="Left (Arrow)" onClick={() => pressKey('Left')} aria-label="Left" />
          <button className="rc-dpad__ok" title="OK (Enter)" onClick={() => pressKey('Enter')}>OK</button>
          <button className="rc-dpad__right" title="Right (Arrow)" onClick={() => pressKey('Right')} aria-label="Right" />
          <button className="rc-dpad__down" title="Down (Arrow)" onClick={() => pressKey('Down')} aria-label="Down" />
        </div>
        <div className="rc-row">{ROW.map(b => <Btn key={b.key} b={b} />)}</div>
        <div className="rc-rockers">
          <div className="rc-rocker">
            <button title="Volume up (+)" onClick={() => pressKey('VolumeUp')}>+</button>
            <span>VOL</span>
            <button title="Volume down (-)" onClick={() => pressKey('VolumeDown')}>−</button>
          </div>
          <div className="rc-rocker">
            <button title="Channel up (Page Up)" onClick={() => pressKey('ChannelUp')}>⌃</button>
            <span>CH</span>
            <button title="Channel down (Page Down)" onClick={() => pressKey('ChannelDown')}>⌄</button>
          </div>
        </div>
        <div className="rc-row">{ROW2.map(b => <Btn key={b.key} b={b} />)}</div>
        <div className="rc-row">{ROW3.map(b => <Btn key={b.key} b={b} />)}</div>
        <div className="rc-row">
          {/* hold for the Game Bar (XF86PlayBackGame), like the TV remote's Play/Pause */}
          <button
            className="rc-btn"
            title="Play/Pause, hold for the Game Bar (K)"
            onPointerDown={playPauseDown}
            onPointerUp={playPauseUp}
            onPointerLeave={e => e.buttons && playPauseUp()}
          >
            Play/Pause
          </button>
        </div>
        <div className="rc-row rc-colours">
          {COLOURS.map(b => (
            <button key={b.key} className={`rc-colour ${b.cls}`} title={`${b.label} (${b.kbd})`} aria-label={b.label} onClick={() => pressKey(b.key)} />
          ))}
        </div>
      </div>
    </aside>
  )
}
