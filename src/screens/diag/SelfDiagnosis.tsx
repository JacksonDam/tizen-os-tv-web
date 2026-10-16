import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import {
  SD, SD_ITEMS, getLastClicked, getResult, resetResults, setLastClicked, setResult, subscribeResults, type SDItem,
} from './sdData'
import { FluxPopup, OptionRow, Ring } from './ui'

// Self Diagnosis (SDSelfDiagnosisView, spec3/diag.md 2.3): StackUp1 with the NECK shown (title T60 700 and
// the subtitle), BODY = summary ring + legend | divider | NGridH of 22 x 20 u ImageTileBottom_06 tiles
// (2 rows, scrolls sideways), BUTTONS = "Test All". OK on a tile runs its test: Manual tests are separate
// apps, Automatic ones open the SelfDiagnosisAll view for that item.

const RES = `${TV}/support/self_diagnosis`
const ROWS = 2
const COL_W = 224        // 22 u tile + 6 u gap
const VISIBLE_COLS = 5   // columns that fit in the 160 u grid before it scrolls (inferred)

export type SDActions = {
  onBack: () => void
  onRunItem: (item: SDItem) => void      // Automatic item: SelfDiagnosisAll (individual)
  onLaunch: (item: SDItem) => void       // Manual item: its app
  onTestAll: () => void                  // SelfDiagnosisAll (all)
  focusName?: string                     // tile to focus on entry (returning from a test app)
}

function useResultsVersion() {
  return useSyncExternalStore(subscribeResults, () => SD_ITEMS.map(i => getResult(i.name) ?? '-').join(','))
}

export function SelfDiagnosis({ onBack, onRunItem, onLaunch, onTestAll, focusName }: SDActions) {
  useResultsVersion()
  const n = SD_ITEMS.length
  const initial = (() => {
    const byName = focusName ? SD_ITEMS.findIndex(i => i.name === focusName) : -1
    if (byName >= 0) return byName
    const last = getLastClicked()
    return last >= 0 && last < n ? last : -1 // -1 = the Test All button
  })()
  const [focus, setFocus] = useState(initial)
  const [lastTile, setLastTile] = useState(Math.max(0, initial))
  const [scrollCol, setScrollCol] = useState(() => Math.max(0, Math.floor(Math.max(0, initial) / ROWS) - (VISIBLE_COLS - 1)))
  const [popup, setPopup] = useState(false)
  useMoveSound(focus)

  const passed = SD_ITEMS.filter(i => getResult(i.name) === 'pass').length
  const failed = SD_ITEMS.filter(i => getResult(i.name) === 'fail').length
  const tested = passed + failed

  // keep the focused column on screen (NGridH scrolls by whole columns)
  useEffect(() => {
    if (focus < 0) return
    const col = Math.floor(focus / ROWS)
    setScrollCol(s => (col < s ? col : col > s + VISIBLE_COLS - 1 ? col - VISIBLE_COLS + 1 : s))
  }, [focus])

  const run = (i: number) => {
    const item = SD_ITEMS[i]
    setLastClicked(i)
    setResult(item.name, undefined) // ResetDiagnosisResultIndividual
    // HDMI Test without a CEC line test goes straight to the HDMI troubleshooting app (GridHBridge)
    if (item.type === 'Manual' || item.app) onLaunch(item)
    else onRunItem(item)
  }

  const testAll = () => {
    setLastClicked(-1)
    // SelectTestAllButton: start over when nothing or everything was tested, else ask
    if (tested === 0 || tested === n) {
      resetResults()
      onTestAll()
    } else setPopup(true)
  }

  useRemote(key => {
    if (key === 'Home') return false
    if (key === 'Back') {
      setLastClicked(-1)
      onBack()
    } else if (focus === -1) {
      if (key === 'Up') setFocus(lastTile)
      else if (key === 'Enter') testAll()
    } else {
      const row = focus % ROWS
      if (key === 'Up' && row > 0) setFocus(focus - 1)
      else if (key === 'Down') {
        if (row < ROWS - 1 && focus + 1 < n) setFocus(focus + 1)
        else {
          setLastTile(focus)
          setFocus(-1)
        }
      } else if (key === 'Left' && focus - ROWS >= 0) setFocus(focus - ROWS)
      else if (key === 'Right' && focus + ROWS < n) setFocus(focus + ROWS)
      else if (key === 'Right' && Math.floor(focus / ROWS) < Math.floor((n - 1) / ROWS)) setFocus(n - 1)
      else if (key === 'Enter') run(focus)
    }
    return true
  }, !popup)

  return (
    <div className="sd">
      <div className="sd__title">{SD.title}</div>
      <div className="sd__subtitle">{SD.subtitle}</div>

      <div className="sd__summary">
        <div className="sd__ring">
          <Ring size={304} value={Math.floor((tested * 100) / n)} kind="bold" />
          <div className="sd__ring-text">
            <div className="sd__ring-done">{tested}</div>
            <div className="sd__ring-total">{`/${n}`}</div>
          </div>
        </div>
        <div className="sd__legend">
          <div className="sd__legend-row">
            <span className="sd__legend-label">{SD.normal}</span>
            <span className="sd__legend-num sd__legend-num--normal">{passed}</span>
          </div>
          <div className="sd__legend-row">
            <span className="sd__legend-label">{SD.actionRequired}</span>
            <span className="sd__legend-num sd__legend-num--action">{failed}</span>
          </div>
          <div className="sd__legend-left">{SD.leftToTest(n - tested)}</div>
        </div>
      </div>
      <div className="sd__divider" />

      <div className="sd__grid">
        <div className="sd__grid-track" style={{ transform: `translateX(${-scrollCol * COL_W}px)` }}>
          {SD_ITEMS.map((it, i) => {
            const r = getResult(it.name)
            return (
              <div
                key={it.name}
                className={`sd-tile ${focus === i ? 'is-focused' : ''}`}
                style={{ left: Math.floor(i / ROWS) * COL_W, top: (i % ROWS) * 208 }}
              >
                <div className="sd-tile__plate">
                  <span className="sd-tile__icon" style={{ maskImage: `url(${RES}/${it.icon})`, WebkitMaskImage: `url(${RES}/${it.icon})` }} />
                  {r && <img className="sd-tile__badge" src={`${RES}/${r === 'pass' ? 'icon_sd_success.svg' : 'icon_sd_fail.svg'}`} alt="" />}
                </div>
                <div className="sd-tile__label">{it.label}</div>
              </div>
            )
          })}
        </div>
        <div className="sd__scrollbar">
          <span
            className="sd__scrollbar-thumb"
            style={{
              width: `${(VISIBLE_COLS / Math.ceil(n / ROWS)) * 100}%`,
              left: `${(scrollCol / Math.ceil(n / ROWS)) * 100}%`,
            }}
          />
        </div>
      </div>

      <OptionRow labels={[SD.testAll]} focus={focus === -1 && !popup ? 0 : null} />

      {popup && (
        <FluxPopup
          message={SD.continueMsg}
          buttons={[SD.continue, SD.restart, SD.cancel]}
          onBack={() => setPopup(false)}
          onSelect={b => {
            setPopup(false)
            if (b === 0) onTestAll()
            else if (b === 1) {
              resetResults()
              onTestAll()
            }
          }}
        />
      )}
    </div>
  )
}
