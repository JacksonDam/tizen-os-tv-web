import { useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { useTv } from '../../tv/store'
import { TV } from '../../assets'
import type { GadgetProps } from '../allsettings/extensions'
import { PanelPopup } from './PanelPopup'
import { showPanelToast } from './toast'
import { EQ_KEYS, setSettings } from './sound'

// page.balance and page.equalizer (org.tizen.menu BalanceView, EqualizerView, EqualizerBridge):
// pages of the All Settings card drawn by the menu itself. Geometry in FLUX units from the views
// (1 u = 8 px); texts from en_US-settings-datafw.mo.

const SOUND_RES = `${TV}/menu/${encodeURIComponent('Sound Resource')}`
const VD = `${TV}/VD_ICONS`

function Top({ title, focused, width = 520 }: { title: string; focused: boolean; width?: number }) {
  return (
    <div className="as__top" style={{ width }}>
      <div className={`as__back ${focused ? 'is-focused' : ''}`}>
        <span className="as__back-icon" />
      </div>
      <div className="as__title">{title}</div>
    </div>
  )
}

// FLUX Slider: 4 px track (CC_Basic120), CP_Point3100 current bar, 16 px handle growing to 32 px with
// a blue rim when focused, value tooltip (C_TooltipSingleLine_01, #0099FF) on the focused slider.
function Track({ value, min, max, focused, vertical }: { value: number; min: number; max: number; focused: boolean; vertical?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100
  const pos = vertical ? { bottom: `${pct}%` } : { left: `${pct}%` }
  return (
    <div className={`avs-track ${vertical ? 'avs-track--v' : ''} ${focused ? 'is-focused' : ''}`}>
      <span className="avs-track__fill" style={vertical ? { height: `${pct}%` } : { width: `${pct}%` }} />
      <span className="avs-track__handle" style={pos} />
      {focused && (
        <span className={`avs-tip ${vertical ? 'avs-tip--right' : ''}`} style={pos}>
          {value}
        </span>
      )}
    </div>
  )
}

// ---- Balance: -10 (L) .. 10 (R), Reset ----

export function BalancePage({ item, active, onClose }: GadgetProps) {
  const value = useTv(s => Number(s.settings.balance ?? 0))
  const [focus, setFocus] = useState<'back' | 'slider' | 'reset'>('slider')
  const [popup, setPopup] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  useMoveSound(focus, active)

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false
    if (key === 'Back') {
      playFeedback('back')
      onClose()
      return true
    }
    if (focus === 'back') {
      if (key === 'Down') setFocus('slider')
      else if (key === 'Enter') onClose()
    } else if (focus === 'slider') {
      if (key === 'Up') setFocus('back')
      else if (key === 'Down') setFocus('reset')
      else if (key === 'Left' || key === 'Right') {
        const v = Math.max(-10, Math.min(10, value + (key === 'Left' ? -1 : 1)))
        if (v !== value) {
          setSettings({ balance: v })
          playFeedback('move')
        }
      }
    } else if (key === 'Up') setFocus('slider')
    else if (key === 'Enter') setPopup(true)
    return true
  }, active && !popup)

  return (
    <div ref={anchor} className="avpage">
      <Top title={item.title} focused={focus === 'back'} />
      <div className="avbal__image">
        <img src={`${SOUND_RES}/i_core_setting_ris_sound_balance.svg`} alt="" />
      </div>
      <div className="avbal__center">
        <div className="avpage__desc">{item.help}</div>
        <div className="avbal__slider">
          <span className="avbal__lr">L</span>
          <Track value={value} min={-10} max={10} focused={focus === 'slider'} />
          <span className="avbal__lr">R</span>
        </div>
      </div>
      <div className="avpage__reset">
        <div className={`flux-btn avpage__button ${focus === 'reset' ? 'is-focused' : ''}`}>Reset</div>
      </div>
      {popup && <div className="avpage__dim" />}
      {popup && (
        <PanelPopup
          anchor={anchor.current}
          panelWidth={520}
          message="Reset volume balance?"
          buttons={['Yes', 'No']}
          focus={1}
          onClose={b => {
            setPopup(false)
            if (b === 0) {
              setSettings({ balance: 0 })
              showPanelToast('Reset complete.')
            }
          }}
        />
      )}
    </div>
  )
}

// ---- Equalizer: 7 vertical sliders -10..10 (100 Hz .. 10 kHz) and a Reset icon button ----

const BANDS = ['100', '200', '500', '1k', '2k', '5k', '10k']

export function EqualizerPage({ item, active, onClose }: GadgetProps) {
  const settings = useTv(s => s.settings)
  const values = EQ_KEYS.map(k => Number(settings[k] ?? 0))
  const [focus, setFocus] = useState<number | 'reset'>(0)
  const lastSlider = useRef(0)
  const [popup, setPopup] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  useMoveSound(focus, active)

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false
    if (key === 'Back') {
      playFeedback('back')
      onClose()
      return true
    }
    if (focus === 'reset') {
      if (key === 'Left') setFocus(lastSlider.current)
      else if (key === 'Enter') setPopup(true)
      return true // Up is swallowed (ResetSliderValueKeyEvent)
    }
    if (key === 'Left' && focus > 0) setFocus(focus - 1)
    else if (key === 'Right') setFocus(focus < 6 ? focus + 1 : 'reset')
    else if (key === 'Up' || key === 'Down') {
      const v = Math.max(-10, Math.min(10, values[focus] + (key === 'Up' ? 1 : -1)))
      if (v !== values[focus]) {
        setSettings({ [EQ_KEYS[focus]]: v })
        playFeedback('move')
      }
    }
    if (typeof focus === 'number') lastSlider.current = focus
    return true
  }, active && !popup)

  return (
    <div ref={anchor} className="avpage aveq">
      <Top title={item.title} focused={false} width={744} />
      <div className="aveq__group">
        <div className="aveq__sliders">
          {values.map((v, i) => (
            <div key={i} className={`aveq__slider ${focus === i ? 'is-focused' : ''}`}>
              <span className="aveq__pm">+</span>
              <Track value={v} min={-10} max={10} focused={focus === i} vertical />
              <span className="aveq__pm">-</span>
            </div>
          ))}
        </div>
        <div className="aveq__bands">
          {BANDS.map(b => (
            <span key={b}>{b}</span>
          ))}
        </div>
      </div>
      <div className="aveq__icon-area">
        <div className={`aveq__reset ${focus === 'reset' ? 'is-focused' : ''}`}>
          <span className="aveq__reset-icon" style={{ maskImage: `url(${VD}/i_icon_info_update.svg)`, WebkitMaskImage: `url(${VD}/i_icon_info_update.svg)` }} />
          {focus === 'reset' && <span className="avs-tip avs-tip--above">Reset</span>}
        </div>
      </div>
      <div className="aveq__bottom">
        <span>Bass</span>
        <span>Treble</span>
      </div>
      {popup && <div className="avpage__dim" />}
      {popup && (
        <PanelPopup
          anchor={anchor.current}
          panelWidth={744}
          message="Do you want to reset the Equalizer settings?"
          buttons={['Yes', 'No']}
          focus={1}
          onClose={b => {
            setPopup(false)
            if (b === 0) setSettings(Object.fromEntries(EQ_KEYS.map(k => [k, 0])))
          }}
        />
      )}
    </div>
  )
}
