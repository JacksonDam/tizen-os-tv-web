import { useRef, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { useTv } from '../../tv/store'
import { TV } from '../../assets'
import type { GadgetProps, PopupProps } from '../allsettings/extensions'
import { PanelPopup, SmallBottom } from './PanelPopup'
import { showPanelToast } from './toast'
import { resetPicture } from './picture'
import { resetSound, setSettings } from './sound'

// page.zoomposition (menu ZoomandPositionView) and the popup.reset rows (SettingViewPluginTileBase
// ShowResetPopup: content, Reset/Cancel with Reset focused, then the confirmation toast).

const ZP = `${TV}/menu/${encodeURIComponent('Picture Resource')}/${encodeURIComponent('zoom and position')}`
const img = (name: string) => `${ZP}/${encodeURIComponent(name)}`

// buttons ZOOM_0..7 in the view's order: icon file and what OK does
const BUTTONS: { icon: string; key: 'av.zoom-h' | 'av.zoom-v' | 'av.pos-x' | 'av.pos-y'; step: number }[] = [
  { icon: 'picture size_zoom_icon_02', key: 'av.zoom-h', step: 5 },     // Horizontal Zoom In
  { icon: 'picture size_zoom_icon_01', key: 'av.zoom-v', step: 5 },     // Vertical Zoom In
  { icon: 'picture size_zoom_icon_04', key: 'av.zoom-h', step: -5 },    // Horizontal Zoom Out
  { icon: 'picture size_zoom_icon_03', key: 'av.zoom-v', step: -5 },    // Vertical Zoom Out
  { icon: 'picture size_position_icon_01', key: 'av.pos-y', step: -1 }, // Up
  { icon: 'picture size_position_icon_03', key: 'av.pos-x', step: -1 }, // Left
  { icon: 'picture size_position_icon_04', key: 'av.pos-x', step: 1 },  // Right
  { icon: 'picture size_position_icon_02', key: 'av.pos-y', step: 1 },  // Down
]
// Ranges and steps are computed by the native handler (CSharpAdjustPositionAndZoomHandle): (inferred)
const RANGE: Record<string, [number, number]> = { 'av.zoom-h': [80, 150], 'av.zoom-v': [80, 150], 'av.pos-x': [-10, 10], 'av.pos-y': [-10, 10] }

type F = number | 'back' | 'reset'
// setFocusButton() plus the FLUX default (spatial) moves
const NAV: Record<string, Partial<Record<'Up' | 'Down' | 'Left' | 'Right', F>>> = {
  back: { Down: 0 },
  0: { Left: 1, Right: 1, Down: 2, Up: 'back' },
  1: { Left: 0, Right: 0, Down: 3, Up: 'back' },
  2: { Left: 3, Right: 3, Up: 0, Down: 4 },
  3: { Left: 2, Right: 2, Up: 1, Down: 4 },
  4: { Up: 2, Down: 7, Left: 5, Right: 6 },
  5: { Left: 6, Right: 6, Up: 4, Down: 7 },
  6: { Left: 5, Right: 5, Up: 4, Down: 7 },
  7: { Up: 4, Left: 5, Right: 6, Down: 'reset' },
  reset: { Up: 7, Down: 0 },
}

export function ZoomPositionPage({ item, active, onClose }: GadgetProps) {
  const settings = useTv(s => s.settings)
  const val = (k: string, d: number) => Number(settings[k] ?? d)
  const [focus, setFocus] = useState<F>(0)
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
    if (key === 'Enter') {
      if (focus === 'back') onClose()
      else if (focus === 'reset') setPopup(true)
      else {
        const b = BUTTONS[focus]
        const [lo, hi] = RANGE[b.key]
        const d = b.key.startsWith('av.zoom') ? 100 : 0
        setSettings({ [b.key]: Math.max(lo, Math.min(hi, val(b.key, d) + b.step)) })
      }
      return true
    }
    const next = NAV[String(focus)]?.[key as 'Up']
    if (next !== undefined) setFocus(next)
    return true
  }, active && !popup)

  const tile = (i: number) => (
    <div key={i} className={`avzp__btn ${focus === i ? 'is-focused' : ''}`}>
      <img className="avzp__bg" src={img(`picture size_zoom and position_bg_${focus === i ? 'f' : 'n'}.svg`)} alt="" />
      <img className="avzp__icon" src={img(`${BUTTONS[i].icon}_${focus === i ? 'f' : 'n'}.svg`)} alt="" />
    </div>
  )

  return (
    <div ref={anchor} className="avpage">
      <div className="as__top">
        <div className={`as__back ${focus === 'back' ? 'is-focused' : ''}`}>
          <span className="as__back-icon" />
        </div>
        <div className="as__title">{item.title}</div>
      </div>
      <div className="avzp">
        <div className="avzp__group avzp__group--zoom">
          <div className="avzp__head">
            <span>Zoom :</span>
            <span className="avzp__value">{`${val('av.zoom-h', 100)}%, ${val('av.zoom-v', 100)}%`}</span>
          </div>
          <div className="avzp__row">{[0, 1].map(tile)}</div>
          <div className="avzp__row">{[2, 3].map(tile)}</div>
        </div>
        <div className="avzp__group avzp__group--pos">
          <div className="avzp__head">
            <span>Position :</span>
            <span className="avzp__value">{`${val('av.pos-x', 0)}%,${val('av.pos-y', 0)}%`}</span>
          </div>
          <div className="avzp__pad">
            <div className="avzp__col avzp__col--side">{tile(5)}</div>
            <div className="avzp__col avzp__col--mid">
              {tile(4)}
              {tile(7)}
            </div>
            <div className="avzp__col avzp__col--side">{tile(6)}</div>
          </div>
        </div>
        <div className="avpage__reset avzp__reset">
          <div className={`flux-btn avpage__button ${focus === 'reset' ? 'is-focused' : ''}`}>Reset</div>
        </div>
      </div>
      {popup && <div className="avpage__dim" />}
      {popup && (
        <PanelPopup
          anchor={anchor.current}
          panelWidth={520}
          message="Reset Zoom/Position?"
          buttons={['Yes', 'No']}
          focus={1}
          onClose={b => {
            setPopup(false)
            if (b === 0) {
              setSettings({ 'av.zoom-h': 100, 'av.zoom-v': 100, 'av.pos-x': 0, 'av.pos-y': 0 })
              showPanelToast('Zoom/Position reset to default levels.')
            }
          }}
        />
      )}
    </div>
  )
}

// ---- popup.reset rows (menu-tv.json setting-ui args content / confirmation-content) ----

const RESETS: Record<string, { content: string; done?: string; run: () => void }> = {
  resetpicture: { content: 'Reset the picture settings?', done: 'The picture settings have been reset.', run: resetPicture },
  resetsound: { content: 'Reset sound settings?', done: 'The sound settings have been reset.', run: resetSound },
  'whitebalance-reset': {
    content: 'Reset the 2 point white balance?',
    run: () => setSettings({ 'r-gain': 0, 'g-gain': 0, 'b-gain': 0, 'r-offset': 0, 'g-offset': 0, 'b-offset': 0 }),
  },
}

export function ResetPopup({ item, onClose }: PopupProps) {
  const r = RESETS[item.id]
  return (
    <SmallBottom
      panelWidth={520}
      message={r?.content ?? ''}
      buttons={['Reset', 'Cancel']}
      focus={0}
      onClose={b => {
        if (b === 0 && r) {
          r.run()
          if (r.done) showPanelToast(r.done)
        }
        onClose()
      }}
    />
  )
}
