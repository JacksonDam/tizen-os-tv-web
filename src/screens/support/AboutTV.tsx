import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { onAnyKey, useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { setSetting, useSetting } from '../../tv/store'
import { TV } from '../../assets'
import type { GadgetProps } from '../allsettings/extensions'
import { InputText, Keyboard, useTextEntry } from '../../components/keyboard/Keyboard'
import { ABOUT_TV, DEVICE_NAME_SETTING } from './supportData'
import './about-tv.css'

// About TV (org.tizen.AboutTVGadget, spec2/device-sources-home.md A.2): drawn inside the All Settings
// panel widened to 93 u (744 px). Panel-relative layout of A.2.2; keys of A.2.3; popups of A.2.5.

const RES = `${TV}/support`
const BACK_ICON = `url(${RES}/setting_icon_top_arrow_reverse.svg)`
const LINE = 32 // T20/T18 line height = one Scroll_01 step (ScrollableText line scroll)
const EDGE = 16 // a step that would leave less than the padding snaps to the end
const IDLE_MS = 60_000 // AT:AboutTVGadget.cs:233-275 (menu then closes)

type Focus = 'back' | 'edit' | 'text' | 'osl' | 'qr'
type Popup = null | 'opensource' | 'qr' | 'name'

export function AboutTV({ host, active, onClose }: GadgetProps) {
  const name = useSetting<string>(DEVICE_NAME_SETTING, ABOUT_TV.deviceName)
  const [focus, setFocus] = useState<Focus>('text')
  const [popup, setPopup] = useState<Popup>(null)
  // text area 504 px: 2 px TextArea padding and 16 px ScrollableText padding top and bottom
  const text = useScrollText(504 - 4 - 32, 500)
  const root = useRef<HTMLDivElement>(null)
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  useMoveSound(focus)

  // popups are drawn over the whole screen, outside the clipped panel
  useLayoutEffect(() => setLayer(root.current?.closest<HTMLElement>('.as') ?? null), [])

  // the QR Code popup hides the menu panel while it shows (ug hide_window / show_window)
  useEffect(() => {
    const panel = root.current?.closest<HTMLElement>('.as__panel')
    if (!panel || popup !== 'qr') return
    panel.style.visibility = 'hidden'
    return () => {
      panel.style.visibility = ''
    }
  }, [popup])

  // 60 s without a key closes the menu
  useEffect(() => {
    let t = setTimeout(host.close, IDLE_MS)
    const off = onAnyKey(() => {
      clearTimeout(t)
      t = setTimeout(host.close, IDLE_MS)
    })
    return () => {
      clearTimeout(t)
      off()
    }
  }, [host.close])

  const close = (sound: boolean) => {
    if (sound) playFeedback('back')
    onClose()
  }

  useRemote(key => {
    if (key === 'Exit' && focus === 'back') {
      close(false) // the back icon closes the gadget on Exit too
      return true
    }
    if (key === 'Home' || key === 'Exit') return false // All Settings closes
    if (key === 'Back') {
      close(true)
      return true
    }
    switch (focus) {
      case 'back':
        if (key === 'Right') setFocus('edit')
        else if (key === 'Down') setFocus('text')
        else if (key === 'Enter') close(false)
        break
      case 'edit':
        if (key === 'Left') setFocus('back')
        else if (key === 'Down') setFocus('osl')
        else if (key === 'Enter') setPopup('name')
        break
      case 'text':
        if (key === 'Up' && text.scroll === 0) setFocus('back')
        else if (key === 'Up' || key === 'Down') {
          playFeedback('move') // ScrollableText plays move on every Up/Down
          text.scrollBy(key === 'Up' ? -1 : 1)
        } else if (key === 'Right') setFocus('osl')
        break
      case 'osl':
        if (key === 'Up') setFocus('edit')
        else if (key === 'Down') setFocus('qr')
        else if (key === 'Left') setFocus('text')
        else if (key === 'Enter') setPopup('opensource')
        break
      case 'qr':
        if (key === 'Up') setFocus('osl')
        else if (key === 'Left') setFocus('text')
        else if (key === 'Enter') setPopup('qr')
        break
    }
    return true
  }, active && !popup)

  return (
    <div ref={root} className="atv">
      <div className={`atv__back ${focus === 'back' ? 'is-focused' : ''}`}>
        <span className="atv__back-icon" style={{ maskImage: BACK_ICON, WebkitMaskImage: BACK_ICON }} />
      </div>
      <div className="atv__title">{ABOUT_TV.title}</div>

      {popup === 'name' ? (
        <NameEditor current={name} onDone={() => { setPopup(null); setFocus('edit') }} />
      ) : (
        <>
          <div className="atv__name">{name}</div>
          <div className={`flux-btn atv__btn atv__btn--edit ${focus === 'edit' && !popup ? 'is-focused' : ''}`}>
            <Label text="Edit Name" active={focus === 'edit' && !popup} />
          </div>
        </>
      )}

      <div className={`atv-text ${focus === 'text' && !popup ? 'is-focused' : ''}`}>
        <ScrollText s={text}>
          {ABOUT_TV.text.map((l, i) =>
            typeof l === 'string' ? (
              <div key={i}>{l}</div>
            ) : (
              <div key={i} style={{ color: ABOUT_TV.heading }}>{l.heading}</div>
            ),
          )}
        </ScrollText>
      </div>

      <div className="atv-info">
        {ABOUT_TV.fields.map(f => (
          <div key={f.label} className="atv-info__item">
            <div className="atv-info__label">{f.label}</div>
            <div className="atv-info__value">{f.value}</div>
          </div>
        ))}
      </div>
      <div className={`flux-btn atv__btn atv__btn--osl ${focus === 'osl' && !popup ? 'is-focused' : ''}`}>
        <Label text="Open Source License" active={focus === 'osl' && !popup} />
      </div>
      <div className={`flux-btn atv__btn atv__btn--qr ${focus === 'qr' && !popup ? 'is-focused' : ''}`}>
        <Label text="QR Code" active={focus === 'qr' && !popup} />
      </div>

      {layer && popup === 'opensource' && createPortal(<OpenSourcePopup onClose={() => setPopup(null)} />, layer)}
      {layer && popup === 'qr' && createPortal(<QrPopup onClose={() => setPopup(null)} />, layer)}
    </div>
  )
}

// ---- C_TextArea_02: line scroll of one text line per Up/Down (Scroll_01, 300 ms Basic); the last step
// snaps to the end; 4 px scroll bar (no track) shown for 1 s after each scroll; 16 px edge shadows. ----

type ScrollState = ReturnType<typeof useScrollText>

function useScrollText(view: number, track: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState(0) // natural height of the text
  const [scroll, setScroll] = useState(0)
  const [bar, setBar] = useState(0) // bumps on every scroll
  useLayoutEffect(() => {
    const measure = () => setContent(ref.current?.offsetHeight ?? 0)
    measure()
    void document.fonts?.ready.then(measure)
  }, [])
  useEffect(() => {
    if (!bar) return
    const t = setTimeout(() => setBar(0), 1000)
    return () => clearTimeout(t)
  }, [bar])
  const max = Math.max(0, content - view)
  const scrollBy = (dir: 1 | -1) => {
    const next = dir > 0 ? (max - scroll >= LINE + EDGE ? scroll + LINE : max) : (scroll >= LINE + EDGE ? scroll - LINE : 0)
    if (next === scroll) return
    setScroll(next)
    setBar(b => b + 1)
  }
  const thumb = content > view ? Math.max(24, (track * view) / content) : 0
  return { ref, scroll, max, scrollBy, bar: bar > 0, thumb, thumbY: max > 0 ? ((track - thumb) * scroll) / max : 0 }
}

function ScrollText({ s, children }: { s: ScrollState; children: ReactNode }) {
  return (
    <>
      <div className="atv-scroll__clip">
        <div ref={s.ref} className="atv-scroll__body" style={{ transform: `translateY(${-s.scroll}px)` }}>
          {children}
        </div>
        {s.scroll > 0 && <div className="atv-scroll__shadow atv-scroll__shadow--top" />}
        {s.scroll < s.max && <div className="atv-scroll__shadow atv-scroll__shadow--bottom" />}
      </div>
      <div className={`atv-scroll__bar ${s.bar ? 'is-shown' : ''}`}>
        <span className="atv-scroll__thumb" style={{ height: s.thumb, transform: `translateY(${s.thumbY}px)` }} />
      </div>
    </>
  )
}

// Button label (T24, 24 px side padding): end ellipsis at rest, marquee while focused (80 px/s, 50 px gap,
// 1 s pause before each loop; spec/flux.md 3.6).
function Label({ text, active }: { text: string; active: boolean }) {
  const box = useRef<HTMLSpanElement>(null)
  const run = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState<{ active: boolean; w: number; box: number } | null>(null)
  const marquee = active && !!fit?.active && fit.w > fit.box
  useLayoutEffect(() => {
    const el = box.current
    if (!el || marquee) return
    setFit({ active, w: el.scrollWidth, box: el.clientWidth })
  }, [text, active, marquee])
  useEffect(() => {
    if (!marquee || !fit || !run.current) return
    const move = ((fit.w + 50) / 80) * 1000
    const a = run.current.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: 1000 / (move + 1000) },
        { transform: `translateX(${-(fit.w + 50)}px)`, offset: 1 },
      ],
      { duration: move + 1000, iterations: Infinity },
    )
    return () => a.cancel()
  }, [marquee, fit])
  return (
    <span ref={box} className={`atv-label ${marquee ? 'is-marquee' : ''}`}>
      {marquee ? (
        <span ref={run} className="atv-label__run">
          <span>{text}</span>
          <span>{text}</span>
        </span>
      ) : (
        text
      )}
    </span>
  )
}

// ---- Edit Name (A.2.6) ----
// The TV swaps the name row for a 72x8 u input field plus an "n/30" counter and opens the Samsung
// keyboard next to the panel ("action=dynamic_ui&entrylimit=30" at the row's top, 2 u right of the
// 93 u gadget: AT:UserInputUI.cs ShowInputPanel). Done writes the name, Back cancels; both return focus
// to Edit Name.

function NameEditor({ current, onDone }: { current: string; onDone: () => void }) {
  const entry = useTextEntry(current, ABOUT_TV.nameMaxLength)
  return (
    <>
      <div className="atv-input">
        <InputText entry={entry} editing />
      </div>
      <div className="atv-input__count">{`${entry.text.length}/${ABOUT_TV.nameMaxLength}`}</div>
      <Keyboard
        entry={entry}
        style={{ left: 80 + (93 + 2) * 8, top: 344 }}
        doneEnabled={entry.text.trim().length > 0}
        onDone={text => {
          setSetting(DEVICE_NAME_SETTING, text.trim())
          onDone()
        }}
        onCancel={onDone}
      />
    </>
  )
}

// ---- popups (A.2.5): FLUX P_PopupSmallBottom_01 frames ----

function usePopupKeys(buttons: number, onEnter: (i: number) => void, onBack: () => void, extra?: (key: string) => boolean) {
  const [focus, setFocus] = useState(0)
  useMoveSound(focus)
  useRemote(key => {
    if (extra?.(key)) return true
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons - 1, f + 1))
    else if (key === 'Enter') onEnter(focus)
    else if (key === 'Back' || key === 'Exit') onBack()
    else if (key === 'Home') return false
    return true
  })
  return [focus, setFocus] as const
}

// Open Source License: 520 px wide, centred on the gadget over a full-screen 30 % dim; the notice
// scrolls with Up/Down; "QR Code" swaps it for the 336 px open-source QR with only "Close".
function OpenSourcePopup({ onClose }: { onClose: () => void }) {
  const [qr, setQr] = useState(false)
  const text = useScrollText(352 - 32, 352)
  const back = () => {
    playFeedback('back')
    onClose()
  }
  const [focus, setFocus] = usePopupKeys(
    qr ? 1 : 2,
    i => {
      if (!qr && i === 0) {
        setQr(true)
        setFocus(0)
      } else onClose()
    },
    back,
    key => {
      if (key !== 'Up' && key !== 'Down') return false
      if (!qr) {
        playFeedback('move')
        text.scrollBy(key === 'Up' ? -1 : 1)
      }
      return true
    },
  )
  const buttons = qr ? ['Close'] : ['QR Code', 'Close']

  return (
    <div className="atv-popup-layer">
      <div className="atv-popup-dim" />
      <div className="atv-popup atv-popup--opensource">
        <div className="atv-popup__title">Open Source License</div>
        <div className={`atv-popup__custom ${qr ? 'atv-popup__custom--qr' : ''}`}>
          {qr ? (
            <img className="atv-popup__qr atv-popup__qr--large" src={`${RES}/${ABOUT_TV.qr}`} alt="" />
          ) : (
            <ScrollText s={text}>{ABOUT_TV.openSourceText}</ScrollText>
          )}
        </div>
        <Buttons labels={buttons} focus={focus} />
      </div>
    </div>
  )
}

// QR Code: 504 px wide at the top right (40 px margins) while the menu panel is hidden.
function QrPopup({ onClose }: { onClose: () => void }) {
  const [focus] = usePopupKeys(
    1,
    () => onClose(),
    () => {
      playFeedback('back')
      onClose()
    },
    key => {
      if (key !== 'Settings') return false
      onClose()
      return true
    },
  )
  return (
    <div className="atv-popup-layer">
      <div className="atv-popup atv-popup--qr">
        <div className="atv-popup__title">{ABOUT_TV.title}</div>
        <div className="atv-popup__custom atv-popup__custom--qr">
          <img className="atv-popup__qr" src={`${RES}/${ABOUT_TV.qr}`} alt="" />
        </div>
        <Buttons labels={['Close']} focus={focus} />
      </div>
    </div>
  )
}

function Buttons({ labels, focus }: { labels: string[]; focus: number }) {
  return (
    <div className="atv-popup__buttons">
      {labels.map((b, i) => (
        <div key={b} className={`flux-btn atv-popup__button ${focus === i ? 'is-focused' : ''}`}>{b}</div>
      ))}
    </div>
  )
}
