import { useEffect, useLayoutEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { getSetting, setSetting } from '../../tv/store'
import type { PopupProps } from '../allsettings/extensions'

// spin.time (menu SpinTime): a 33 x 15 u CC_BG14100 box at the right end of the row, with hour and
// minute SpinControlV_01 (12 x 9 u, "D2", looping) and a ":" delimiter. Up/Down change the focused
// spin, Left/Right move between them, OK stores the time, Back leaves it unchanged. 24-hour clock
// (the 12-hour AM/PM variant is for US models).

export function SpinTimePopup({ item, onClose }: PopupProps) {
  const [h0, m0] = String(getSetting<string>(item.id, '00:00')).split(':').map(Number)
  const [h, setH] = useState(h0 || 0)
  const [m, setM] = useState(m0 || 0)
  const [focus, setFocus] = useState<0 | 1>(0)
  const [top, setTop] = useState<number | null>(null)
  useMoveSound(focus)
  useMoveSound(`${h}:${m}`)

  // sits on the focused row (the settings list scrolls, so take it from the page)
  useLayoutEffect(() => {
    const row = document.querySelector<HTMLElement>('.as-row.is-focused')
    const stage = row?.closest<HTMLElement>('.stage')
    if (!row || !stage) return
    const scale = stage.getBoundingClientRect().width / 1920
    const r = row.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    setTop((r.top - s.top) / scale + r.height / scale / 2 - 60)
  }, [])

  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onClose, 150)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false
    if (leaving) return true
    if (key === 'Left' || key === 'Right') setFocus(key === 'Left' ? 0 : 1)
    else if (key === 'Up' || key === 'Down') {
      const d = key === 'Up' ? 1 : -1
      if (focus === 0) setH(x => (x + d + 24) % 24)
      else setM(x => (x + d + 60) % 60)
    } else if (key === 'Enter') {
      setSetting(item.id, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      setLeaving(true)
    } else if (key === 'Back') {
      playFeedback('back')
      setLeaving(true)
    }
    return true
  })

  if (top === null) return null
  return (
    <div className={`avspin ${leaving ? 'avspin--leaving' : ''}`} style={{ top }}>
      {[h, m].map((v, i) => (
        <div key={i} className="avspin__group">
          {i === 1 && <span className="avspin__colon">:</span>}
          <div className={`avspin__spin ${focus === i ? 'is-focused' : ''}`}>
            <span className="avspin__arrow avspin__arrow--up" />
            <span className="avspin__value">{String(v).padStart(2, '0')}</span>
            <span className="avspin__arrow avspin__arrow--down" />
          </div>
        </div>
      ))}
    </div>
  )
}
