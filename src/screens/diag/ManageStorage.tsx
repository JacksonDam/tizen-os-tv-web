import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import { FluxPopup, Ring } from './ui'
import { useToast } from './toast'

// Device Care > Manage Storage (SDManageStorageView, spec3/diag.md 3): C_Header_02 with the Used /
// Available ProgressBarStack and the Deselect All / Delete function buttons, a horizontal list of
// 38 x 50 u ImageTileBottom_05 app cards with check boxes, a View Details button that follows the
// focused card, and the OS disclaimer. Apps and sizes are mock values (16 GB eMMC, featureconf flash_size 2).

const RES = `${TV}/support`
const GB = 1024 ** 3
const MB = 1024 ** 2

type App = { id: string; title: string; icon: string; app: number; data: number; cache: number; removable: boolean }

// WAS downloadable-app list on a TV without Smart Hub terms (mock). e-Manual / "User Guide" never gets a
// check box (SDManageStorageView.ShowCheckBox). Icons: the e-Manual package icon and the Tizen default
// app icon (the firmware's own package icons; downloaded apps would bring theirs).
const APPS: App[] = [
  { id: 'emanual', title: 'User Guide', icon: 'app_user_guide.png', app: 41.2 * MB, data: 9.95 * MB, cache: 1.25 * MB, removable: false },
  { id: 'gallery', title: 'Gallery', icon: 'app_default.png', app: 14.6 * MB, data: 3.05 * MB, cache: 1.1 * MB, removable: true },
  { id: 'smartthings', title: 'SmartThings', icon: 'app_default.png', app: 48.75 * MB, data: 12.3 * MB, cache: 3.16 * MB, removable: true },
]
let installed = APPS.map(a => a.id) // survives leaving the view (mock uninstall)

const SYSTEM = 4.12 * GB
const TOTAL = 7.83 * GB   // user partition (Used + Available)
const ROM = 16 * GB

// SDStorageControl.ByteToHuman: "{x:F2} KB/MB/GB"
function human(b: number) {
  if (b >= GB) return `${(b / GB).toFixed(2)} GB`
  if (b >= MB) return `${(b / MB).toFixed(2)} MB`
  return `${(b / 1024).toFixed(2)} KB`
}
const total = (a: App) => a.app + a.data + a.cache

const S = {
  title: 'Manage Storage',
  selected: (n: number) => `${n} item(s) selected`,
  deselectAll: 'Deselect All',
  delete: 'Delete',
  used: 'Used',
  available: 'Available',
  system: 'System',
  viewDetails: 'View Details',
  disclaimer: 'With the OS and applications required for operating the TV installed, the actual available memory may be less than the indicated capacity.',
  confirm: 'Do you want to delete the selected item(s)?',
  cancel: 'Cancel',
  deleting: 'Deleting…',
  deleted: 'Deleted successfully.',
  app: 'App',
  data: 'Data',
  cacheL: 'Cache',
  totalL: 'Total',
  clearData: 'Clear Data',
  clearCache: 'Clear Cache',
  close: 'Close',
}

type Focus = { area: 'header'; i: 0 | 1 } | { area: 'list'; i: number } | { area: 'details' }

export function ManageStorage({ onBack }: { onBack: () => void }) {
  const [apps, setApps] = useState(() => APPS.filter(a => installed.includes(a.id)))
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<Focus>(apps.length ? { area: 'list', i: 0 } : { area: 'header', i: 0 })
  const [popup, setPopup] = useState<null | 'confirm' | 'deleting' | { details: App }>(null)
  const [progress, setProgress] = useState(0)
  const [toast, showToast] = useToast()
  useMoveSound(JSON.stringify(focus))

  const usedApps = apps.reduce((s, a) => s + total(a), 0)
  const used = 1.2 * GB + usedApps // OS-side usage + apps (mock)
  const avail = TOTAL - used

  // "Deleting…" progress, then the toast (DeleteProgressPopup)
  useEffect(() => {
    if (popup !== 'deleting') return
    if (progress >= 100) {
      installed = installed.filter(id => !checked.has(id))
      setApps(a => a.filter(x => !checked.has(x.id)))
      setChecked(new Set())
      setPopup(null)
      setFocus({ area: 'list', i: 0 })
      showToast(S.deleted)
      return
    }
    const t = setTimeout(() => setProgress(p => p + 4), 40)
    return () => clearTimeout(t)
  }, [popup, progress, checked, showToast])

  useRemote(key => {
    if (key === 'Home') return false
    if (key === 'Back') return onBack(), true
    if (focus.area === 'header') {
      if (key === 'Left' && focus.i === 1) setFocus({ area: 'header', i: 0 })
      else if (key === 'Right' && focus.i === 0) setFocus({ area: 'header', i: 1 })
      else if (key === 'Down' && apps.length) setFocus({ area: 'list', i: 0 })
      else if (key === 'Enter' && checked.size) {
        if (focus.i === 0) setChecked(new Set())
        else {
          setProgress(0)
          setPopup('confirm')
        }
      }
    } else if (focus.area === 'list') {
      if (key === 'Left' && focus.i > 0) setFocus({ area: 'list', i: focus.i - 1 })
      else if (key === 'Right' && focus.i < apps.length - 1) setFocus({ area: 'list', i: focus.i + 1 })
      else if (key === 'Up') setFocus({ area: 'header', i: 0 })
      else if (key === 'Down') setFocus({ area: 'details' })
      else if (key === 'Enter') {
        const a = apps[focus.i]
        if (a.removable)
          setChecked(c => {
            const n = new Set(c)
            if (n.has(a.id)) n.delete(a.id)
            else n.add(a.id)
            return n
          })
      }
    } else {
      const i = lastList(focus)
      if (key === 'Up') setFocus({ area: 'list', i })
      else if (key === 'Enter') setPopup({ details: apps[i] })
    }
    return true
  }, !popup)

  // the card the View Details button hangs under
  const [cardIndex, setCardIndex] = useState(0)
  const lastList = (f: Focus) => (f.area === 'list' ? f.i : cardIndex)
  useEffect(() => {
    if (focus.area === 'list') setCardIndex(focus.i)
  }, [focus])

  const disabled = checked.size === 0
  const cardLeft = (i: number) => 120 + i * 320 // 38 u cards, 2 u gap; list padding 5 u (inferred start)

  return (
    <div className="ms">
      <div className="ms__header">
        <div className="ms__title">{S.title}</div>
        <div className="ms__bar">
          <span className="ms__bar-track">
            <span className="ms__bar-fill" style={{ width: `${Math.floor((used * 100) / TOTAL)}%` }} />
          </span>
          <div className="ms__bar-row">
            <span className="ms__bar-cur">{S.used}</span>
            <span className="ms__bar-tot">{S.available}</span>
          </div>
          <div className="ms__bar-row">
            <span className="ms__bar-cur">{human(used)}</span>
            <span className="ms__bar-tot">{`${human(avail)} (${Math.floor((avail * 100) / TOTAL)}%)`}</span>
          </div>
        </div>
        <div className="ms__figures">
          {[
            [S.system, human(SYSTEM)],
            [S.used, human(used)],
            [S.available, `${human(avail)} (${Math.floor((avail * 100) / ROM)}%)`],
          ].map(([n, v]) => (
            <div key={n} className="ms__figure">
              <div className="ms__figure-name">{n}</div>
              <div className="ms__figure-value">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="ms__subheader">
        <div className="ms__selected">{S.selected(checked.size)}</div>
        {[S.deselectAll, S.delete].map((b, i) => (
          <div
            key={b}
            className={`flux-btn ms__fn ${disabled ? 'is-disabled' : ''} ${focus.area === 'header' && focus.i === i && !popup ? 'is-focused' : ''}`}
            style={{ left: 1376 + i * 312 }}
          >
            {b}
          </div>
        ))}
      </div>

      <div className="ms__list">
        {apps.map((a, i) => (
          <div
            key={a.id}
            className={`ms-card ${focus.area === 'list' && focus.i === i && !popup ? 'is-focused' : ''}`}
            style={{ left: cardLeft(i) }}
          >
            <div className="ms-card__image">
              <img src={`${RES}/${a.icon}`} alt="" />
              {a.removable && (
                <img className="ms-card__check" src={`${RES}/${checked.has(a.id) ? 'i_img_checkbox_checked.png' : 'i_img_checkbox_unchecked.png'}`} alt="" />
              )}
              <span className="flux-focus-ring" />
            </div>
            <div className="ms-card__title">{a.title}</div>
            <div className="ms-card__size">{human(total(a))}</div>
          </div>
        ))}
        {apps.length > 0 && (focus.area === 'list' || focus.area === 'details') && (
          <div
            className={`flux-btn ms__details ${focus.area === 'details' && !popup ? 'is-focused' : ''}`}
            style={{ left: cardLeft(lastList(focus)) }}
          >
            {S.viewDetails}
          </div>
        )}
      </div>
      <div className="ms__disclaimer">{S.disclaimer}</div>

      {popup === 'confirm' && (
        <FluxPopup
          message={S.confirm}
          buttons={[S.delete, S.cancel]}
          onBack={() => setPopup(null)}
          onSelect={b => setPopup(b === 0 ? 'deleting' : null)}
        />
      )}
      {popup === 'deleting' && (
        <div className="sd-popup">
          <div className="sd-popup__dim" />
          <div className="sd-popup__area sd-popup__area--small">
            <Ring size={88} value={progress} kind="line" />
            <div className="sd-popup__message">{S.deleting}</div>
          </div>
        </div>
      )}
      {popup && typeof popup === 'object' && (
        <FluxPopup
          custom={
            <div className="ms-details">
              <div className="ms-details__head">
                <img className="ms-details__icon" src={`${RES}/${popup.details.icon}`} alt="" />
                <div className="ms-details__title">{popup.details.title}</div>
              </div>
              <div className="ms-details__divider" />
              {[
                [S.app, popup.details.app],
                [S.data, popup.details.data],
                [S.cacheL, popup.details.cache],
              ].map(([l, v]) => (
                <div key={l} className="ms-details__row">
                  <span>{l}</span>
                  <span>{human(v as number)}</span>
                </div>
              ))}
              <div className="ms-details__divider" />
              <div className="ms-details__row ms-details__row--total">
                <span>{S.totalL}</span>
                <span>{human(total(popup.details))}</span>
              </div>
            </div>
          }
          buttons={[S.clearData, S.clearCache, S.close]}
          focusButton={2}
          onBack={() => setPopup(null)}
          onSelect={() => setPopup(null)}
        />
      )}
      {toast}
    </div>
  )
}
