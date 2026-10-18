import { useEffect, useMemo, useRef, useState } from 'react'
import { useRemote, type RemoteKey } from '../../../../../input/remote'
import { openApp, type AppProps } from '../../../../shell'
import { playUi, UI_SOUND } from '../../../../tv/sound'
import { getSetting, setSetting, useSetting } from '../../../../tv/store'
import { APPS } from '../../data'
import { fw } from '../hubapps/assets'
import type { RunParams } from '../hubapps/AppRunner'
import {
  appById, deleteApps, getMyApps, KEY_AUTOUPDATE, MY_APPS_MAX, SAMSUNG_APPS, setLocked, setMyApps, useInstalled,
  useLocked, useMyApps, useOpened, type HubApp,
} from '../hubapps/catalog'
import { ScrollText } from '../hubapps/ScrollText'
import { Nine, SHMenu, SHMessage, SHPage, SHProgress } from '../hubapps/sh'
import { appIconSmall } from '../hubapps/icons'

// More Apps: the widget manager's DownloadedApp page (app 0x4d, opened by the Apps panel's sub menu item
// "More Apps", CHomeExecutor::m_GetSubMenuItemEnum(6, 0) = 2). Layout from DownloadedApp::PutIn @01c0d40c
// and its parts, in the toolkit's 1280x720 page (see ../hubapps/sh.tsx), drawn x1.5:
//   SHColorTagPage2: background3.mir 1280x720 gradient 0x041012 -> 0x09282e (CreateBackground @01c4445c);
//     colour tag 1, 266x250 at (0, 0), color_tag.mir gradient 0x257885 -> 0x095a67, text "More Apps"
//     (InfoLink3 0x33) at (20, 20) 246x133 size 37 (CreateColorTag @01c438ac); depth 1.
//   TopTools @01c24364: right-anchored 20 from the right at y 9, 994x55; buttons type 0 (icon 56x56 +
//     text, width text + 62, height 55), Options (0x73, icon_edit) at the right, View (0x66
//     "View: <<A>>", icon_view) 10 px left of it; highlighted: *_high icon, text 0xfdd911.
//   ContentCount @01c1aaac: 266x130 at (966, 146), size 27, right/top: "n" or "i / n".
//   Grid (DownloadedApp_GridLayout @01c1be80): at (20, 200), 110x110 cells, 3 rows (SetMaxDummyIndex 29:
//     30 cells a page), 10 columns 120 apart (inferred from footage); SHWidgetUINormal items: background
//     alpha 0.15 (0.045 for an empty cell), name at (2, 86) 106x20 size 16 centred, lock badge
//     icon_apps_lock.png at (2, 2) from the right; the focus is myapps_icon_highlight.png (160x160)
//     centred on the cell.
//   SHInfoArea::Create @01c54d60: 1280x124 at (0, 596): name at (42, -6) 872x87 size 34 0x4cdfff;
//     "Category: <<A>>" (0x62), "Version: <<A>>" (0x64), "Size: <<A>>" (0x63) at y 40, size 24, joined by
//     "|" texts 55 / 13 px apart (Reposition @01c53e20).
//   DownloadedApp_StorageArea @01c3b940: 324x107 at (956, 613): "Storage" (0x76) size 20, a type-1
//     SHProgressBar 289x13 at (0, 31), "%s / %s " (used / total) at (0, 55) size 20.
//   SubButtons @01c22b5c (edit modes): up to four 186x48 type-1 buttons (option_btn_*), right-anchored at
//     558 - 186 i from the right edge 18, y 78 (SubButtons::ChangeMode @01c22d58).
// Options menu (DownloadedApp_EditPopup @01c254c0) at (46, 67) from the right: Lock/Unlock (0x3e), Edit
// My Apps (0x36), Move to Folder (0x41), Create Folder (0x25), Rename Folder (0x49), Delete (0x26),
// Update Apps (0x5f), Auto Update Apps (0x80), IP Setting (0x82), Start App Sync (0x84). Shown here: the
// four that work without folders, app updates or a developer account (Move/Rename Folder need folders,
// Update Apps an update, IP Setting / Start App Sync the "develop" account). View popup
// (DownloadedApp_ViewPopup @01c287c4): Date Downloaded (0x32), Recently Opened (0x48), Title (0x58).

type Mode = 'normal' | 'lock' | 'delete' | 'myapps'
type Area = 'grid' | 'top' | 'sub'
type Popup =
  | { kind: 'view'; sel: number }
  | { kind: 'options'; sel: number }
  | { kind: 'auto'; sel: number }
  | { kind: 'msg'; text: string; buttons: string[]; sel: number; onDone?: (button: number) => void; timeout?: number }
  | { kind: 'pin'; digits: string; error: boolean; then: () => void }

const COLS = 10
const ROWS = 3
const CELL = 110
const PITCH = 120
const GRID_X = 20
const GRID_Y = 200

const SORT_KEY = 'hubapps.sort'
const SORTS = ['Date Downloaded', 'Recently Opened', 'Title'] // InfoLink3 0x32, 0x48, 0x58

// The SubButtons sets (SubButtons::Initialize @01c22814), left to right; '' = no button.
const SUB: Record<Exclude<Mode, 'normal'>, string[]> = {
  delete: ['Delete', 'Cancel', 'Select All', 'Deselect All'],  // set 0: 0x26, 4, 0x31, 0x30
  lock: ['Lock', 'Cancel', 'Select All', 'Deselect All'],      // set 1: 0x7e, 4, 0x31, 0x30
  myapps: ['', '', 'Remove All', 'Close'],                     // set 4: 0x29, 0x23
}

// Category names the info area shows (SHInfoArea::GetCategoryName: InfoLink3 0x6d-0x75); the stub
// catalogue's categories mapped onto them.
const CATEGORY: Record<string, string> = {
  Video: 'Videos', News: 'Information', Sports: 'Sports', Kids: 'Lifestyle', Music: 'Videos', Lifestyle: 'Lifestyle',
  Information: 'Information', Education: 'Education', Games: 'Games',
}

function version(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `${1 + (h % 3)}.${(h >> 3) % 10}${(h >> 7) % 10}`
}

function sizeText(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`
}

export function MoreApps({ params, close }: AppProps) {
  const p = (params ?? {}) as { edit?: boolean; from?: number }
  const installed = useInstalled()
  const myApps = useMyApps()
  const locked = useLocked()
  const opened = useOpened()
  const sort = useSetting<number>(SORT_KEY, 0)
  const autoUpdate = useSetting<string>(KEY_AUTOUPDATE, 'on')

  // the downloaded apps (Samsung Apps itself is one of them) in the View order
  const list = useMemo(() => {
    const ids = [SAMSUNG_APPS, ...installed] // the store came with the TV: the oldest
    const apps = ids.map(id => appById(id)).filter((a): a is HubApp => !!a)
    if (sort === 2) return [...apps].sort((a, b) => a.name.localeCompare(b.name))
    const byDate = [...apps].reverse() // newest first
    if (sort === 1) {
      const rank = (id: string) => (opened.includes(id) ? opened.indexOf(id) : 1e6)
      return [...byDate].sort((a, b) => rank(a.id) - rank(b.id))
    }
    return byDate
  }, [installed, sort, opened])

  const [mode, setMode] = useState<Mode>('normal')
  const [area, setArea] = useState<Area>('grid')
  const [gi, setGi] = useState(0)        // focused grid cell (page 1)
  const [ti, setTi] = useState(0)        // top tools: 0 View, 1 Options
  const [si, setSi] = useState(3)        // sub buttons
  const [checked, setChecked] = useState<string[]>([])
  const [popup, setPopup] = useState<Popup | null>(null)
  const state = useRef({ mode, area, gi, ti, si, checked, popup, list })
  state.current = { mode, area, gi, ti, si, checked, popup, list }

  // Opened with TOOLS from the Apps panel (CHomeExecutor::ExecuteAppsEditMode, executor type 0xc): the
  // Options menu straight away (inferred: the executor data was not traced further).
  useEffect(() => {
    if (p.edit) setPopup({ kind: 'options', sel: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // timed messages
  useEffect(() => {
    if (popup?.kind !== 'msg' || !popup.timeout) return
    const t = setTimeout(() => {
      setPopup(null)
      popup.onDone?.(0)
    }, popup.timeout)
    return () => clearTimeout(t)
  }, [popup])

  const page = list.slice(0, COLS * ROWS)
  const focusedApp = area === 'grid' && !popup ? page[gi] : undefined
  const subSet = mode === 'normal' ? [] : SUB[mode]
  const subIdx = subSet.map((s, i) => (s ? i : -1)).filter(i => i >= 0)

  const menuItems = useMemo(() => ['Lock/Unlock', 'Edit My Apps', 'Delete', 'Auto Update Apps'], [])

  function back() {
    openApp('smarthub', { panel: p.from ?? APPS })
  }

  function run(app: HubApp) {
    playUi(UI_SOUND.SELECT)
    const go = () => openApp('hubapp', { id: app.id, name: app.name, from: APPS } satisfies RunParams)
    if (locked.includes(app.id)) setPopup({ kind: 'pin', digits: '', error: false, then: go })
    else go()
  }

  function enterMode(m: Exclude<Mode, 'normal'>) {
    setMode(m)
    setArea('grid')
    setChecked(m === 'lock' ? locked.filter(id => list.some(a => a.id === id)) : m === 'myapps' ? getMyApps() : [])
    setSi(SUB[m].findIndex(s => s))
  }

  function leaveMode() {
    setMode('normal')
    setChecked([])
    setArea('grid')
  }

  function toggle(id: string) {
    if (mode === 'delete' && id === SAMSUNG_APPS) return playUi(UI_SOUND.NOKEY) // (inferred) the store stays
    playUi(UI_SOUND.SELECT)
    if (mode === 'myapps') {
      // Edit My Apps adds and removes at once (DownloadedApp_GridLayout_EditMode::AddCurrentItemToMyApps /
      // RemoveWidgetFromMyApps); a full My Apps answers with InfoLink3 0x1f
      const my = getMyApps()
      if (my.includes(id)) setMyApps(my.filter(x => x !== id))
      else if (my.length >= MY_APPS_MAX) {
        setPopup({ kind: 'msg', text: 'My Apps is full! \n\nRemove some other apps to make space before adding new apps.', buttons: ['OK'], sel: 0 })
        return
      } else setMyApps([...my, id])
      setChecked(getMyApps())
      return
    }
    setChecked(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]))
  }

  function subPress(i: number) {
    const label = subSet[i]
    playUi(UI_SOUND.SELECT)
    switch (label) {
      case 'Cancel':
      case 'Close':
        leaveMode()
        return
      case 'Select All':
        setChecked(list.filter(a => mode !== 'delete' || a.id !== SAMSUNG_APPS).map(a => a.id))
        return
      case 'Deselect All':
        setChecked([])
        return
      case 'Remove All':
        // InfoLink3 0x28 "Remove all apps from My Apps?"
        setPopup({
          kind: 'msg', text: 'Remove all apps from My Apps?', buttons: ['Yes', 'No'], sel: 0,
          onDone: b => {
            if (b !== 0) return
            setMyApps([])
            setChecked([])
          },
        })
        return
      case 'Lock':
        setLocked(state.current.checked)
        leaveMode()
        return
      case 'Delete': {
        if (!state.current.checked.length) return
        // InfoLink3 0x27, then "Deleting…" (0x2e)
        const ids = state.current.checked
        setPopup({
          kind: 'msg',
          text: 'Delete the selected items? \n\nThe selected items will be deleted from all accounts.\nIf you delete a folder, all the items it contains will be deleted as well. ',
          buttons: ['Yes', 'No'], sel: 0,
          onDone: b => {
            if (b !== 0) return
            setPopup({
              kind: 'msg', text: 'Deleting…', buttons: [], sel: 0, timeout: 1500,
              onDone: () => {
                deleteApps(ids)
                leaveMode()
                setGi(0)
              },
            })
          },
        })
        return
      }
    }
  }

  function optionPress(i: number) {
    const label = menuItems[i]
    setPopup(null)
    playUi(UI_SOUND.SELECT)
    if (label === 'Lock/Unlock') setPopup({ kind: 'pin', digits: '', error: false, then: () => enterMode('lock') })
    else if (label === 'Edit My Apps') enterMode('myapps')
    else if (label === 'Delete') enterMode('delete')
    else if (label === 'Auto Update Apps') setPopup({ kind: 'auto', sel: autoUpdate === 'off' ? 1 : 0 })
  }

  function popupKey(key: RemoteKey): boolean {
    const pp = state.current.popup!
    if (pp.kind === 'pin') {
      if (key.startsWith('Digit')) {
        playUi(UI_SOUND.MOVE)
        const d = pp.digits + key.slice(5)
        if (d.length < 4) {
          setPopup({ ...pp, digits: d })
          return true
        }
        if (d === String(getSetting<string>('menu.pin', '0000'))) {
          setPopup(null)
          pp.then()
        } else setPopup({ ...pp, digits: '', error: true })
        return true
      }
      if (key === 'Back') {
        playUi(UI_SOUND.BACK)
        setPopup(null)
        return true
      }
      return key !== 'Exit' && key !== 'Home'
    }
    if (pp.kind === 'msg') {
      if (key === 'Left' || key === 'Right') {
        const n = pp.buttons.length
        if (n > 1) {
          playUi(UI_SOUND.MOVE)
          setPopup({ ...pp, sel: (pp.sel + (key === 'Right' ? 1 : n - 1)) % n })
        }
        return true
      }
      if (key === 'Enter' && pp.buttons.length) {
        playUi(UI_SOUND.SELECT)
        setPopup(null)
        pp.onDone?.(pp.sel)
        return true
      }
      if (key === 'Back' && pp.buttons.length) {
        playUi(UI_SOUND.BACK)
        setPopup(null)
        pp.onDone?.(-1)
        return true
      }
      return key !== 'Exit' && key !== 'Home'
    }
    const items = pp.kind === 'view' ? SORTS : pp.kind === 'options' ? menuItems : ['On', 'Off']
    switch (key) {
      case 'Up':
      case 'Down': {
        playUi(UI_SOUND.MOVE)
        const n = items.length
        setPopup({ ...pp, sel: (pp.sel + (key === 'Down' ? 1 : n - 1)) % n })
        return true
      }
      case 'Enter':
        if (pp.kind === 'options') return optionPress(pp.sel), true
        playUi(UI_SOUND.SELECT)
        if (pp.kind === 'view') setSetting(SORT_KEY, pp.sel)
        else setSetting(KEY_AUTOUPDATE, pp.sel === 0 ? 'on' : 'off')
        setPopup(null)
        if (pp.kind === 'view') setGi(0)
        return true
      case 'Back':
      case 'Left':
      case 'Right':
        if (key === 'Back') playUi(UI_SOUND.BACK)
        setPopup(null)
        return true
      default:
        return key !== 'Exit' && key !== 'Home'
    }
  }

  useRemote(key => {
    const s = state.current
    if (key === 'Exit') {
      close() // EXIT leaves the widget manager to the TV picture
      return true
    }
    if (s.popup) return popupKey(key)
    if (key === 'Home') return false
    if (key === 'Back') {
      playUi(UI_SOUND.BACK)
      if (s.mode !== 'normal') leaveMode()
      else back()
      return true
    }
    if (key === 'Tools' && s.mode === 'normal') {
      playUi(UI_SOUND.SELECT)
      setPopup({ kind: 'options', sel: 0 })
      return true
    }
    if (s.area === 'top') {
      if (key === 'Left' || key === 'Right') {
        const n = key === 'Right' ? 1 : 0
        if (n !== s.ti) {
          playUi(UI_SOUND.MOVE)
          setTi(n)
        }
        return true
      }
      if (key === 'Down') {
        playUi(UI_SOUND.MOVE)
        setArea('grid')
        return true
      }
      if (key === 'Enter') {
        playUi(UI_SOUND.SELECT)
        setPopup(s.ti === 0 ? { kind: 'view', sel: sort } : { kind: 'options', sel: 0 })
        return true
      }
      return key === 'Up' || key.startsWith('Digit') ? true : false
    }
    if (s.area === 'sub') {
      const k = subIdx.indexOf(s.si)
      if (key === 'Left' || key === 'Right') {
        const nk = k + (key === 'Right' ? 1 : -1)
        if (nk >= 0 && nk < subIdx.length) {
          playUi(UI_SOUND.MOVE)
          setSi(subIdx[nk])
        }
        return true
      }
      if (key === 'Down') {
        playUi(UI_SOUND.MOVE)
        setArea('grid')
        return true
      }
      if (key === 'Enter') {
        subPress(s.si)
        return true
      }
      return true
    }
    // grid
    const col = s.gi % COLS
    const row = Math.floor(s.gi / COLS)
    switch (key) {
      case 'Left':
        if (col > 0) {
          playUi(UI_SOUND.MOVE)
          setGi(s.gi - 1)
        }
        return true
      case 'Right':
        if (col < COLS - 1) {
          playUi(UI_SOUND.MOVE)
          setGi(s.gi + 1)
        }
        return true
      case 'Up':
        playUi(UI_SOUND.MOVE)
        if (row > 0) setGi(s.gi - COLS)
        else setArea(s.mode === 'normal' ? 'top' : 'sub')
        return true
      case 'Down':
        if (row < ROWS - 1) {
          playUi(UI_SOUND.MOVE)
          setGi(s.gi + COLS)
        }
        return true
      case 'Enter': {
        const app = s.list[s.gi]
        if (!app) return playUi(UI_SOUND.NOKEY), true
        if (s.mode === 'normal') run(app)
        else toggle(app.id)
        return true
      }
      default:
        return true
    }
  })

  // storage: the TV's app storage (1.42 GB as the footage shows; GetTotalSizeInfo less 0x7800000) and
  // what the downloaded apps use, plus the preinstalled widgets' share (inferred)
  const usedMB = 180 + installed.reduce((t, id) => t + (appById(id)?.sizeMB ?? 0), 0)
  const totalMB = 1.42 * 1024
  const countText = area === 'grid' && !popup && page.length ? `${Math.min(gi + 1, list.length)} / ${list.length}` : `${list.length}`

  return (
    <div className="hub-runner">
      <SHPage>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(#041012, #09282e)' }} />
        {/* colour tag 1 */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 266, height: 250, background: 'linear-gradient(#257885, #095a67)' }}>
          <div style={{ position: 'absolute', left: 20, top: 20, width: 246, height: 133, fontSize: 37, lineHeight: '44px' }}>More Apps</div>
        </div>
        {mode === 'normal' && <TopTools sel={area === 'top' && !popup ? ti : -1} sortLabel={SORTS[sort] ?? SORTS[0]} />}
        {mode !== 'normal' && <SubButtons labels={subSet} sel={area === 'sub' && !popup ? si : -1} />}
        <div style={{ position: 'absolute', left: 966, top: 146, width: 266, height: 130, fontSize: 27, textAlign: 'right', lineHeight: '34px' }}>
          {mode === 'normal' ? countText : `Selected items : ${checked.length}`}
        </div>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const app = page[i]
          const x = GRID_X + (i % COLS) * PITCH
          const y = GRID_Y + Math.floor(i / COLS) * PITCH
          const focused = area === 'grid' && gi === i && !popup
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: CELL, height: CELL }}>
              <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: app ? 0.15 : 0.045 }} />
              {focused && <img src={fw('InfoLink3/images/highlight/myapps_icon_highlight.png')} alt="" style={{ position: 'absolute', left: -25, top: -25 }} />}
              {app && (
                <>
                  <img src={appIconSmall(app)} alt="" style={{ position: 'absolute', left: 12, top: 10, width: 85, height: 70 }} />
                  <ScrollText
                    text={app.name}
                    scroll={focused}
                    style={{ position: 'absolute', left: 2, top: 86, width: 106, height: 20, lineHeight: '20px', fontSize: 16, textAlign: 'center' }}
                  />
                  {locked.includes(app.id) && <img src={fw('InfoLink3/images/etc/icon_apps_lock.png')} alt="" style={{ position: 'absolute', left: CELL - 2 - 14, top: 2 }} />}
                  {mode !== 'normal' && (
                    // the edit modes' check box (position inferred: InfoLink3 checkBox images)
                    <>
                      <img src={fw('InfoLink3/images/checkBox/check_box_n.png')} alt="" style={{ position: 'absolute', left: 2, top: 2 }} />
                      {(mode === 'myapps' ? myApps.includes(app.id) : checked.includes(app.id)) && (
                        <img src={fw('InfoLink3/images/checkBox/check_icon.png')} alt="" style={{ position: 'absolute', left: 2, top: 2 }} />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}
        {focusedApp && <InfoArea app={focusedApp} />}
        <div style={{ position: 'absolute', left: 956, top: 613, width: 324, height: 107 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 286, height: 22, lineHeight: '22px', fontSize: 20 }}>Storage</div>
          <SHProgress x={0} y={31} w={289} h={13} value={Math.round((usedMB / totalMB) * 100)} />
          <div style={{ position: 'absolute', left: 0, top: 55, width: 286, height: 22, lineHeight: '22px', fontSize: 20, whiteSpace: 'nowrap' }}>
            {sizeText(usedMB)} / {sizeText(totalMB)}
          </div>
        </div>
        {popup?.kind === 'view' && <SHMenu x={46} y={67} anchorRight items={SORTS.map((l, i) => ({ label: l, check: true, checked: i === sort }))} sel={popup.sel} />}
        {popup?.kind === 'options' && <SHMenu x={46} y={67} anchorRight items={menuItems.map(l => ({ label: l }))} sel={popup.sel} />}
        {popup?.kind === 'auto' && (
          // DownloadedApp_AutoUpdatePopup: On / Off (InfoLink3 0x17, 0x18), the current one checked (layout inferred)
          <SHMenu x={46} y={67} anchorRight items={['On', 'Off'].map((l, i) => ({ label: l, check: true, checked: (autoUpdate === 'off' ? 1 : 0) === i }))} sel={popup.sel} />
        )}
        {popup?.kind === 'msg' && <SHMessage text={popup.text} buttons={popup.buttons} sel={popup.sel} />}
        {popup?.kind === 'pin' && <PinPopup digits={popup.digits} error={popup.error} />}
      </SHPage>
    </div>
  )
}

function TopTools({ sel, sortLabel }: { sel: number; sortLabel: string }) {
  // right to left: Options, then View 10 px further left (TopTools::Reposition @01c235e0); the widths
  // follow the text (SHButton type 0: text width + 0x3e); the text size is inferred (20)
  const right = 1280 - 20
  const opt = 'Options'
  const view = `View: ${sortLabel}`
  const w = (t: string) => Math.round(t.length * 10.4) + 62 // (inferred) average glyph width at size 20
  const ow = w(opt)
  const vw = w(view)
  return (
    <>
      <ToolButton x={right - ow} w={ow} icon="edit" text={opt} hi={sel === 1} />
      <ToolButton x={right - ow - 10 - vw} w={vw} icon="view" text={view} hi={sel === 0} />
    </>
  )
}

function ToolButton({ x, w, icon, text, hi }: { x: number; w: number; icon: string; text: string; hi: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: 9, width: w, height: 55 }}>
      <img src={fw(`InfoLink3/images/button/icon_${icon}_${hi ? 'high' : 'nor'}.png`)} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
      <div style={{ position: 'absolute', left: 56, top: 0, height: 55, lineHeight: '55px', fontSize: 20, whiteSpace: 'nowrap', color: hi ? '#fdd911' : '#fff' }}>{text}</div>
    </div>
  )
}

function SubButtons({ labels, sel }: { labels: string[]; sel: number }) {
  const shown = labels.map((l, i) => (l ? i : -1)).filter(i => i >= 0)
  return (
    <>
      {labels.map((l, i) => {
        if (!l) return null
        const k = shown.indexOf(i)
        // SetSubType: one / left / center / right by position in the visible set
        const kind = shown.length === 1 ? 'one' : k === 0 ? 'left' : k === shown.length - 1 ? 'right' : 'center'
        const x = 1280 - 18 - (558 - 186 * i) - 186
        const hi = sel === i
        const cap = kind === 'center' ? 0 : kind === 'one' ? 16 : 12
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: 78, width: 186, height: 48 }}>
            <Nine src={`InfoLink3/images/button/option_btn_${kind}_${hi ? 'high' : 'nor'}.png`} slice={[kind === 'right' ? 0 : cap, 0, kind === 'left' ? 0 : cap, 0]} x={0} y={0} w={186} h={48} />
            <div style={{ position: 'absolute', inset: 0, lineHeight: '48px', textAlign: 'center', fontSize: 20 }}>{l}</div>
          </div>
        )
      })}
    </>
  )
}

function InfoArea({ app }: { app: HubApp }) {
  const cat = CATEGORY[app.category] ?? 'Other'
  // SHInfoArea::SetValue hides a field whose value is empty (the store's size is not listed)
  const parts = [`Category: ${cat}`, `Version: ${version(app.id)}`, ...(app.sizeMB ? [`Size: ${app.sizeMB.toFixed(2)}MB`] : [])]
  return (
    <div style={{ position: 'absolute', left: 0, top: 596, width: 1280, height: 124 }}>
      <div style={{ position: 'absolute', left: 42, top: -6, width: 872, height: 87, fontSize: 34, color: '#4cdfff', lineHeight: '44px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {app.name}
      </div>
      <div style={{ position: 'absolute', left: 42, top: 40, height: 30, fontSize: 24, lineHeight: '30px', whiteSpace: 'nowrap' }}>
        {parts.map((t, i) => (
          <span key={i}>
            {i > 0 && <span style={{ padding: '0 13px' }}>|</span>}
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

// "Enter your PIN." (InfoLink3 0x39) with four entry boxes; a wrong PIN shows 0x3c (LockPopup; layout
// inferred).
function PinPopup({ digits, error }: { digits: string; error: boolean }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ position: 'absolute', left: 340, top: 230, width: 600, height: 260 }}>
        <div style={{ position: 'absolute', inset: 2, background: 'rgba(12,16,20,0.92)' }} />
        <Nine src="InfoLink3/images/popup/message_popup_bg.png" slice={[20, 20, 20, 20]} x={0} y={0} w={600} h={260} />
        <div style={{ position: 'absolute', left: 30, top: 34, width: 540, fontSize: 24, textAlign: 'center' }}>
          {error ? 'Incorrect PIN. Please try again.' : 'Enter your PIN.'}
        </div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ position: 'absolute', left: 140 + i * 84, top: 110, width: 64, height: 64 }}>
            <Nine src={`InfoLink3/images/inputBox/${i === digits.length ? 'pin_input_sel' : 'pin_input_nor'}.png`} slice={[20, 20, 20, 20]} x={0} y={0} w={64} h={64} />
            <div style={{ position: 'absolute', inset: 0, lineHeight: '64px', textAlign: 'center', fontSize: 30 }}>{i < digits.length ? '*' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
