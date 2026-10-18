import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { onAnyKey, useRemote, type RemoteKey } from '../../../input/remote'
import type { AppProps } from '../../../apps/registry'
import { TV } from '../../../assets'
import { Lottie } from '../../../components/Lottie'
import { MessageBox } from '../../../components/MessageBox'
import { playFeedback, useMoveSound } from '../../../tv/sound'
import { SOURCES, setTv, useTv } from '../../../tv/store'
import { ChannelSearch } from '../../channels/ChannelSearch'
import { PinBoxes } from '../PinBoxes'
import { DEFAULT_PIN, setPin } from '../pinStore'
import { setSetupPending } from '../setupState'
import { S } from '../strings'
import { COUNTRIES, DEFAULT_LANGUAGE, LANGUAGES, PIN_SETUP_COUNTRIES } from './data'
import './wizard.css'
import '../pin.css'

// First-time setup (com.samsung.tv.wizard + org.tizen.wizard "setup" wizard, wizard-config_TV.json),
// the EU remote-control path (spec3/setup.md 3). Pages, in the config's order, with the firmware page
// names:
//   wizard-start          ug-wizard-setup-new StartPage: "Welcome" on bg_oobe_welcome, then the
//                         LanguageCustomLayout ("Hi!" in the focused language, "Select your language.")
//   wizard-country        "Select Your Country or Region"
//   wizard-connection-guide  "Connect Your Devices to the Screen": ANT IN and HDMI ports with the devices
//   NetworkSetting...     SystemSetupNetworkUG: the wired connection (mocked as connected)
//   wizard-terms          ug-wizard-terms: Smart Hub agreement (Agree / Disagree)
//   wizard-tvusage        "Select Your TV Source"
//   channel-scan          the channel scan app, embedded (Antenna only)
//   wizard-pin            "Create a PIN" (countries that refuse 0000, inferred: France)
//   wizard-complete       complete-page: the oobe_complete circle and particle Lotties
//   wizard-ending         ending-page: the ending movie, then the Smart Hub
// Pages the firmware skips on this TV (no SmartThings phone, no touch stand, no Samsung account, no
// software update found, region time from broadcast) are not shown. Setup can't be left in PnP
// ("can't exit in the pnp"): Home and Exit do nothing; Back goes to the previous page.
//
// The setup music (21'_OOBE_BGM.mp3, wizard-config_TV.json bgm_path) starts on the start page
// (WizardPageControl::ControlBGM) and loops until the ending movie takes the audio focus.

type PageId = 'start' | 'country' | 'connection' | 'network' | 'terms' | 'tvsource' | 'scan' | 'pin' | 'complete' | 'ending'
type Source = 'antenna' | 'box' | 'none'
type WizState = { language: string; country: string; source: Source; agreed: boolean; languageSeen: boolean }

const SETUP = `${TV}/setup`

// wizard-config_TV.json "group" -> FLUX step indicator step (group 3, restore, is skipped on this TV)
const STEP: Partial<Record<PageId, number>> = {
  country: 1, connection: 1, network: 1, terms: 2, tvsource: 4, scan: 4, pin: 4,
}
const TOTAL_STEPS = 4

function flow(st: WizState): PageId[] {
  const p: PageId[] = ['start', 'country', 'connection', 'network', 'terms', 'tvsource']
  if (st.source === 'antenna') p.push('scan')
  if (PIN_SETUP_COUNTRIES.has(st.country)) p.push('pin')
  p.push('complete', 'ending')
  return p
}

// TV volume -> player gain (inferred perceptual curve; the TV plays the BGM at the system volume)
function gain(volume: number, muted: boolean) {
  return muted ? 0 : Math.min(1, Math.sqrt(volume / 100))
}

export type PageProps = {
  st: WizState
  set: (patch: Partial<WizState>) => void
  next: () => void
  prev: () => void
  keys: (fn: (key: RemoteKey) => boolean) => void // the page's key handler
  stopBgm: () => void
  finish: () => void
}

export function SetupWizard({ onExit }: AppProps) {
  const [st, setSt] = useState<WizState>(() => {
    const lang = LANGUAGES.find(l => l.locale === DEFAULT_LANGUAGE)!
    return { language: lang.locale, country: lang.country, source: 'antenna', agreed: false, languageSeen: false }
  })
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const pages = flow(st)
  const page = pages[Math.min(index, pages.length - 1)]

  // ---- BGM ----
  const volume = useTv(s => s.volume)
  const muted = useTv(s => s.muted)
  const bgm = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const a = new Audio(`${SETUP}/oobe_bgm.m4a`)
    a.loop = true // m_SetLooding
    bgm.current = a
    const tryPlay = () => void a.play().catch(() => {})
    tryPlay()
    // browsers start audio only after a user gesture: retry on the next key
    const off = onAnyKey(() => {
      if (a.paused && bgm.current === a) tryPlay()
    })
    return () => {
      off()
      a.pause()
      bgm.current = null
    }
  }, [])
  useEffect(() => {
    if (bgm.current) bgm.current.volume = gain(volume, muted)
  }, [volume, muted])
  const stopBgm = useCallback(() => {
    const a = bgm.current
    if (!a) return
    bgm.current = null
    // the movie player takes the audio focus; fade the BGM out over 500 ms (inferred)
    const v0 = a.volume
    const t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 500)
      a.volume = v0 * (1 - k)
      if (k < 1) requestAnimationFrame(step)
      else a.pause()
    }
    requestAnimationFrame(step)
  }, [])

  // ---- page motion: hide 0.5 s linear, then show 0.833 s linear (wizard-base.edc content.clip) ----
  const go = useCallback((to: number) => {
    setLeaving(true)
    setTimeout(() => {
      setIndex(to)
      setLeaving(false)
    }, 500)
  }, [])
  const next = useCallback(() => go(index + 1), [go, index])
  const prev = useCallback(() => {
    if (index > 0) go(index - 1)
  }, [go, index])
  const finish = useCallback(() => {
    setSetupPending(false)
    onExit('hub')
  }, [onExit])

  const pageKeys = useRef<((key: RemoteKey) => boolean) | null>(null)
  const keys = useCallback((fn: (key: RemoteKey) => boolean) => {
    pageKeys.current = fn
  }, [])

  // The wizard owns every key during setup. The embedded scan and popups sit above this handler.
  useRemote(key => {
    if (leaving) return true
    if (page === 'scan') return true // keys the scan let through (Home, Exit...) stop here
    pageKeys.current?.(key)
    return true
  })

  const props: PageProps = {
    st, set: p => setSt(s => ({ ...s, ...p })), next, prev, keys, stopBgm, finish,
  }
  const step = STEP[page]
  const light = page === 'start' || page === 'complete'

  return (
    <div className={`wz ${light ? 'wz--light' : ''}`}>
      {light ? (
        <div className="wz__bg wz__bg--welcome" style={{ backgroundImage: `url(${SETUP}/bg_oobe_welcome.webp)` }} />
      ) : page !== 'ending' && page !== 'scan' ? (
        <div className="wz__bg" style={{ backgroundImage: `url(${SETUP}/bg_oobe_default.webp)` }} />
      ) : null}
      {step !== undefined && !leaving && <StepIndicator step={step} canPrev={index > 0 && page !== 'scan'} />}
      <div key={page} className={`wz__content ${leaving ? 'wz__content--out' : ''}`}>
        {page === 'start' && <StartPage {...props} />}
        {page === 'country' && <CountryPage {...props} />}
        {page === 'connection' && <ConnectionPage {...props} />}
        {page === 'network' && <NetworkPage {...props} />}
        {page === 'terms' && <TermsPage {...props} />}
        {page === 'tvsource' && <TvSourcePage {...props} />}
        {page === 'scan' && <ChannelSearch onExit={() => {}} launch={() => {}} embedded={{ onDone: next }} />}
        {page === 'pin' && <PinPage {...props} />}
        {page === 'complete' && <CompletePage {...props} />}
        {page === 'ending' && <EndingPage {...props} volume={gain(volume, muted)} />}
      </div>
    </div>
  )
}

// ---- FLUX step indicator (elm_flux_stepindicator; NUI CStepIndicator01): 1920 x 120 band at the top,
// Previous on the left (arrow + T24 400 CC_Basic160), the step numbers in 14 u (112 px) columns: current
// T48 CC_Point3100 (#33ADFF), others T32 CC_Basic150, done steps a check; skipped steps dimmed (inferred).

function StepIndicator({ step, canPrev }: { step: number; canPrev: boolean }) {
  return (
    <div className="wz-steps">
      <div className="wz-steps__side">
        {canPrev && (
          <>
            <span className="wz-steps__arrow wz-steps__arrow--left" />
            <span>{S.COM_SID_PREVIOUS}</span>
          </>
        )}
      </div>
      <div className="wz-steps__items">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const n = i + 1
          const state = n === step ? 'current' : n < step ? (n === 3 ? 'skipped' : 'done') : 'normal'
          return (
            <div key={n} className={`wz-steps__item wz-steps__item--${state}`}>
              {state === 'done' ? <img src={`${TV}/VD_ICONS/i_icon_info_check.svg`} alt="" /> : n}
            </div>
          )
        })}
      </div>
      <div className="wz-steps__side" />
    </div>
  )
}

// ---- shared base-page frame (wizard-api pagelayout: TYPE B/C title, centred) ----

function Titles({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <div className="wz-title">{title}</div>
      {sub && <div className="wz-sub">{sub}</div>}
    </>
  )
}

function Buttons({ labels, focus }: { labels: string[]; focus: number | null }) {
  return (
    <div className={`wz-buttons wz-buttons--${labels.length}`}>
      {labels.map((b, i) => (
        <div key={b} className={`flux-btn wz-button ${focus === i ? 'is-focused' : ''}`}>{b}</div>
      ))}
    </div>
  )
}

// A scrolling FLUX list (C_ListBasic, 9 u rows): `visible` rows, the focused row kept in view.
function List({ items, focus, selected, visible, className }: {
  items: ReactNode[]; focus: number | null; selected?: number; visible: number; className?: string
}) {
  const rowH = 72
  const f = focus ?? selected ?? 0
  const top = Math.max(0, Math.min(f - Math.floor(visible / 2), items.length - visible))
  return (
    <div className={`wz-list ${className ?? ''}`} style={{ height: visible * rowH }}>
      <div className="wz-list__inner" style={{ transform: `translateY(${-top * rowH}px)` }}>
        {items.map((it, i) => (
          <div key={i} className={`wz-list__row ${focus === i ? 'is-focused' : ''} ${selected === i ? 'is-selected' : ''}`}>
            <span className="wz-list__text">{it}</span>
            {selected === i && <img className="wz-list__check" src={`${TV}/VD_ICONS/i_icon_info_check.svg`} alt="" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- wizard-start: Welcome, then the language list ----
// welcome-page.edc welcome_page_default: title T52 400 at y 388-452 (0.359-0.419), colour 0,0,0 @ 204,
// shows 0.5 s in with a 1 s Basic curve and a 0.95 -> 1 zoom. The page moves on to the language layout on
// welcome_timer (duration inferred: 3 s).
// language-page.edc language_page_default: title T52 400 (17,17,17 @ 204) y 166-230, subtitle T34 400
// line 43 y 252-294, list x 444-1476 y 312-922, shortcut T24 500 line 36 at y 989. Focus changes swap
// the title with FadeInText (0.667 s, 0.5 0 0.7 1) / FadeOutText (0.15 s, 0.3 0 0.4 1).

function StartPage({ st, set, next, keys }: PageProps) {
  const [stage, setStage] = useState<'welcome' | 'language'>(st.languageSeen ? 'language' : 'welcome')
  const [focus, setFocus] = useState(() => Math.max(0, LANGUAGES.findIndex(l => l.locale === st.language)))
  useMoveSound(focus, stage === 'language')

  useEffect(() => {
    if (stage !== 'welcome') return
    const t = setTimeout(() => setStage('language'), 3000)
    return () => clearTimeout(t)
  }, [stage])

  keys(key => {
    if (stage === 'welcome') return true
    if (key === 'Up') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Down') setFocus(f => Math.min(LANGUAGES.length - 1, f + 1))
    else if (key === 'Enter') {
      const l = LANGUAGES[focus]
      set({ language: l.locale, country: l.country, languageSeen: true })
      next()
    }
    return true
  })

  if (stage === 'welcome') {
    return (
      <div className="wz-welcome">
        <div className="wz-welcome__title">{S.COM_SID_WELCOME_MSG_KR_NODOT}</div>
      </div>
    )
  }
  const lang = LANGUAGES[focus]
  return (
    <div className="wz-lang">
      <div key={lang.locale} className="wz-lang__title">{lang.hello}</div>
      <div className="wz-lang__sub">{S.TV_SID_OOBE_SELELCT_YOUR_LANGUAGE}</div>
      <div className="wz-lang__list">
        <List items={LANGUAGES.map(l => l.name)} focus={focus} visible={8} className="wz-list--light" />
      </div>
      <div className="wz-lang__shortcut">
        {S.TV_SID_OOBE_CFAPR_TO_USE_THE_ACCESSIBILITY_FEATURE_SIMPLY_PRESS_AND_HOLD_THE_MUTE_BUTTON}
      </div>
    </div>
  )
}

// ---- wizard-country ----

function CountryPage({ st, set, next, prev, keys }: PageProps) {
  const [focus, setFocus] = useState(() => Math.max(0, COUNTRIES.indexOf(st.country)))
  useMoveSound(focus)
  keys(key => {
    if (key === 'Up') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Down') setFocus(f => Math.min(COUNTRIES.length - 1, f + 1))
    else if (key === 'Enter') {
      set({ country: COUNTRIES[focus] })
      next()
    } else if (key === 'Back') {
      playFeedback('back')
      prev()
    }
    return true
  })
  return (
    <div className="wz-page">
      <Titles title={S.TV_SID_OOBE_SELELCT_COUNTRY_OR_REGION} />
      <div className="wz-page__list">
        <List items={COUNTRIES} focus={focus} selected={COUNTRIES.indexOf(st.country)} visible={6} />
      </div>
    </div>
  )
}

// ---- wizard-connection-guide (connection-page.edc "Connection_page", 3 HDMI + 1 ANT): port cards
// 316 x 340 every 264 px from the layout clip at y 504; the device name under each port (T24 700,
// connected 36,134,77 / not connected 88,88,88, white variants on the FLUX background), the button at
// y 853. The port states come from the mocked inputs (store SOURCES).

function ConnectionPage({ next, prev, keys }: PageProps) {
  keys(key => {
    if (key === 'Enter') next()
    else if (key === 'Back') {
      playFeedback('back')
      prev()
    }
    return true
  })
  const hdmi = SOURCES.filter(s => s.id !== 'TV')
  const ports = [
    ...[1, 2, 3].map(n => {
      const src = hdmi.find(s => s.id === `HDMI${n}`)
      return {
        label: `HDMI ${n}`, img: src ? 'oobe_s_hdmi_connect.svg' : 'oobe_s_hdmi_unconnect.svg',
        name: src?.device ?? S.COM_SID_NOT_CONNECTED, connected: !!src,
      }
    }),
    { label: S.TV_SID_42675_OOBE_ANT_IN, img: 'oobe_s_ant_connect.svg', name: S.COM_SID_CONNECTED, connected: true },
  ]
  return (
    <div className="wz-page">
      <Titles title={S.TV_SID_OOBE_CANOV_CONNECT_DEVICE_SCREEN} sub={S.TV_SID_OOBE_CANOV_PLUG_TURN_ON_SCREN} />
      <div className="wz-ports">
        {ports.map(p => (
          <div key={p.label} className="wz-port">
            <img className="wz-port__img" src={`${SETUP}/${p.img}`} alt="" />
            <div className="wz-port__label">{p.label}</div>
            <div className={`wz-port__name ${p.connected ? 'is-connected' : ''}`}>
              {p.connected && <img className="wz-port__icon" src={`${SETUP}/oobe_icon_thumbnailinfo_success.svg`} alt="" />}
              {p.name}
            </div>
          </div>
        ))}
      </div>
      <div className="wz-msg">{S.TV_SID_OOBE_CANOV_READY_MOVE_NEXT_STEP}</div>
      <Buttons labels={[S.COM_BUTTON_NEXT]} focus={0} />
    </div>
  )
}

// ---- Network (SystemSetupNetworkUG: NetworkWiredConnecting -> NetworkConnectSuccess). The mocked TV
// has its LAN cable in: the wired check runs for 2 s (inferred) and succeeds. ----

function NetworkPage({ next, prev, keys }: PageProps) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOk(true), 2000)
    return () => clearTimeout(t)
  }, [])
  keys(key => {
    if (key === 'Enter' && ok) next()
    else if (key === 'Back') {
      playFeedback('back')
      prev()
    }
    return true
  })
  return (
    <div className="wz-page">
      <Titles
        title={S.TV_SID_OOBE_CAJUL_REMOTE_CONNECT_ENTERTAINMENT_UR_LOVE}
        sub={ok ? S.PJT_SID_TV_CONNECTED_INTERNET : S.TV_SID_OOBE_WIRED_CONNECTION}
      />
      <div className="wz-net">
        {!ok && <Lottie className="wz-net__spinner" src={`${TV}/support/i_img_progresscircle_01_s.json`} playing loop />}
        <div className="wz-net__state">{ok ? S.SID_SUCCESS_EXCLAMATION : S.TV_SID_OOBE_WIRED_CONNECTION}</div>
        {ok && <div className="wz-net__detail">{S.TV_SID_OOBE_WIRED_CONNECTION}</div>}
      </div>
      <div className="wz-msg wz-msg--note">{S.TV_SID_NETWORK_BASIC_DEVICE_INFO_IP_ETC_NETWORK}</div>
      <Buttons labels={[S.COM_BUTTON_NEXT]} focus={ok ? 0 : null} />
    </div>
  )
}

// ---- wizard-terms (ug-wizard-terms): the Smart Hub agreement. The documents come from Samsung's server,
// so opening one here shows the terms page's network error (SID_NETWORK_ERROR_MSG). Disagree asks
// TV_SID_TNC_CDMAR_USE_SMART_HUB_AGREE_TNC_PN_SKIP first. Layout inferred from the FLUX template. ----

function TermsPage({ set, next, prev, keys }: PageProps) {
  const docs = ['Terms and Conditions', 'Privacy Policy'] // COM_TV_SID_TERMS_CONDITIONS_PRIVACY_POLICY, split
  const [focus, setFocus] = useState(2) // 0..1 documents, 2 Agree, 3 Disagree
  const [popup, setPopup] = useState<'skip' | 'error' | null>(null)
  useMoveSound(focus)
  keys(key => {
    if (popup) return true
    if (key === 'Up' && focus >= 2) setFocus(1)
    else if (key === 'Up' && focus === 1) setFocus(0)
    else if (key === 'Down' && focus < 2) setFocus(focus + 1)
    else if (key === 'Left' && focus === 3) setFocus(2)
    else if (key === 'Right' && focus === 2) setFocus(3)
    else if (key === 'Enter') {
      if (focus < 2) setPopup('error')
      else if (focus === 2) {
        set({ agreed: true })
        next()
      } else setPopup('skip')
    } else if (key === 'Back') {
      playFeedback('back')
      prev()
    }
    return true
  })
  return (
    <div className="wz-page">
      <Titles title={S.TV_SID_OOBE_SMART_HUB_AGREEMENT} sub={S.TV_SID_MIX_BEFORM_SET_UP_SMART_HUB_MUST_AGREE} />
      <div className="wz-page__list wz-page__list--terms">
        <List items={docs} focus={focus < 2 ? focus : null} visible={2} />
      </div>
      <div className="wz-msg">{S.TV_SID_SELECT_AGREE_BOTH_SELECT_DISAGREE}</div>
      <Buttons labels={[S.COM_SID_AGREE, S.COM_SID_DISAGREE]} focus={focus >= 2 ? focus - 2 : null} />
      {popup === 'error' && (
        <MessageBox message={S.SID_NETWORK_ERROR_MSG} buttons={[S.SID_OK]} onClose={() => setPopup(null)} />
      )}
      {popup === 'skip' && (
        <MessageBox
          message={S.TV_SID_TNC_CDMAR_USE_SMART_HUB_AGREE_TNC_PN_SKIP}
          buttons={[S.COM_SID_YES, S.COM_SID_NO]}
          onClose={b => {
            setPopup(null)
            if (b === 0) {
              set({ agreed: false })
              next()
            }
          }}
        />
      )}
    </div>
  )
}

// ---- wizard-tvusage: "Select Your TV Source" (WizardSetupTVUsagePage). Antenna runs the channel scan;
// a cable or satellite box selects HDMI 2 (the mocked set-top box); no signal goes straight on. ----

function TvSourcePage({ st, set, next, prev, keys }: PageProps) {
  const options: { id: Source; title: string; text: string }[] = [
    { id: 'antenna', title: S.COM_SID_ANTENNA_KR_CONFIG_TV, text: S.TV_SID_CONNECT_ANTENNA_CHOOSE_ANTENNA },
    { id: 'box', title: S.TV_SID_CABLE_OR_SATELLITE_BOX, text: S.TV_SID_MIX_CONNECT_CABLE_TURN_ON_RECOMMEND('HDMI 2') },
    { id: 'none', title: S.TV_SID_OOBE_CBAUG_NO_BROADCAST_SIGNAL, text: S.TV_SID_CHOOSE_OPTION_REQUIRE_LIVE_TELEVISION_SIGNAL },
  ]
  const [focus, setFocus] = useState(() => Math.max(0, options.findIndex(o => o.id === st.source)))
  useMoveSound(focus)
  keys(key => {
    if (key === 'Up') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Down') setFocus(f => Math.min(options.length - 1, f + 1))
    else if (key === 'Enter') {
      const o = options[focus]
      set({ source: o.id })
      if (o.id === 'box') setTv({ source: 'HDMI2' })
      next()
    } else if (key === 'Back') {
      playFeedback('back')
      prev()
    }
    return true
  })
  return (
    <div className="wz-page">
      <Titles title={S.TV_SID_OOBE_SELECT_TV_SOURCE} sub={S.TV_SID_OOBE_SELELCT_SOURCE_TV_CHANNELS_FROM} />
      <div className="wz-options">
        {options.map((o, i) => (
          <div key={o.id} className={`wz-option ${focus === i ? 'is-focused' : ''}`}>
            <div className="wz-option__title">{o.title}</div>
            <div className="wz-option__text">{o.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- wizard-pin (WizardSetupPinPage): "Create a PIN" with a Pin2Line. 0000 is refused in these
// countries (ChangePinPopup.CheckValidPin); success shows TV_SID_SUCCESSFULLY_SET_PIN, then moves on. ----

function PinPage({ next, prev, keys }: PageProps) {
  const N = 4
  const [digits, setDigits] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  keys(key => {
    if (done) return true
    if (key.startsWith('Digit') && digits.length < 2 * N) {
      const d = digits + key.slice(5)
      if (d.length === N && d === DEFAULT_PIN) {
        setMsg(S.SID_INVALID_PIN_PLEASE_ENTER_AGAIN)
        setDigits('')
        return true
      }
      setDigits(d)
    } else if ((key === 'Left' || key === 'Back') && digits) setDigits(d => d.slice(0, -1))
    else if (key === 'Back') {
      playFeedback('back')
      prev()
    }
    return true
  })
  useEffect(() => {
    if (digits.length < 2 * N) return
    const t = setTimeout(() => {
      if (digits.slice(0, N) === digits.slice(N)) {
        setPin(digits.slice(0, N))
        setDone(true)
        setMsg(S.TV_SID_SUCCESSFULLY_SET_PIN)
        setTimeout(next, 1500)
      } else {
        setMsg(S.TV_SID_WEBBROWSER_PIN_ENTERED_NOT_MATCH_TRY)
        setDigits('')
      }
    }, 300)
    return () => clearTimeout(t)
  }, [digits, next])
  return (
    <div className="wz-page">
      <Titles title={S.COM_MAPP_SID_OOBE_CBSEP_CREATE_A_PIN} sub={S.COM_MAPP_SID_OOBE_CBOCT_PIN_TO_PREVENT_CHILDREN_ADULT_MSG} />
      <div className="wz-pin">
        <div className="pin-line">
          <div className="pin-line__msg">{S.TV_SID_ENTER_A_NEW_PIN}</div>
          <PinBoxes count={N} filled={Math.min(digits.length, N)} focused={!done && digits.length < N} />
        </div>
        <div className="pin-line">
          <div className="pin-line__msg">{S.TV_SID_ENTER_THE_PIN_AGAIN}</div>
          <PinBoxes count={N} filled={Math.max(0, digits.length - N)} focused={!done && digits.length >= N} />
        </div>
        {msg && <div className="wz-msg wz-msg--pin">{msg}</div>}
      </div>
    </div>
  )
}

// ---- wizard-complete (complete-page.edc + completed_added_layout): the title fades in linearly over
// 1.5 s; oobe_complete_particular under oobe_complete_circle in the 600 x 450 box at (660, 339), 60 fps.
// The title text is set by code; the mobile setup's "TV is ready to use." is used (inferred), and the
// page moves on after 3.5 s (inferred). ----

function CompletePage({ next, keys }: PageProps) {
  keys(() => true)
  useEffect(() => {
    const t = setTimeout(next, 3500)
    return () => clearTimeout(t)
  }, [next])
  return (
    <div className="wz-complete">
      <div className="wz-complete__title">{S.PJT_SID_OOBE_TV_READY_TO_USE}</div>
      <div className="wz-complete__box">
        <Lottie className="wz-complete__lottie" src={`${SETUP}/oobe_complete_particular.json`} playing />
        <Lottie className="wz-complete__lottie" src={`${SETUP}/oobe_complete_circle.json`} playing />
      </div>
    </div>
  )
}

// ---- wizard-ending (ending-page.edc PART_TV_IMAGE, WizardVideoManager): the Ending_Movie plays full
// screen with its own sound (/opt/data/Ending_Movie/22_Basic/oobe_video_a_ambient_2k.mp4 on a TV like
// this). The movie is factory-installed and not in the firmware update; public/video/oobe_ending_2160p60.mp4 is
// a capture of the real TV's ending movie (YouTube v8deoPhBRYU, 0:01.75-0:16.5, "2023 to 2025 Samsung
// TV first boot"). No key handler is attached to the player, so it can't be skipped (inferred). When it
// completes (m_PlayCompleteCB) the wizard finishes and the TV opens the Smart Hub, which the movie's
// last frame (the Home icon) leads into. Without a playable movie the page shows the default image
// (promotion_default_img_horizontal.webp, the Home icon on black) on a timer (m_ImageTimerCallBack,
// 3 s inferred) instead. ----

function EndingPage({ stopBgm, finish, keys, volume }: PageProps & { volume: number }) {
  const video = useRef<HTMLVideoElement>(null)
  const [fallback, setFallback] = useState(false)
  keys(() => true)

  useEffect(() => {
    const v = video.current
    if (!v) return
    stopBgm()
    v.volume = volume
    v.muted = false
    v.play().catch(() => {
      // autoplay with sound refused: play it muted rather than skip it
      v.muted = true
      v.play().catch(() => setFallback(true))
    })
    // m_OnPlayTimeOutCB: no picture after 10 s -> default image (inferred timeout)
    const t = setTimeout(() => {
      if (v.currentTime === 0) setFallback(true)
    }, 10000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (video.current) video.current.volume = volume
  }, [volume])
  useEffect(() => {
    if (!fallback) return
    const t = setTimeout(finish, 3000)
    return () => clearTimeout(t)
  }, [fallback, finish])

  return (
    <div className="wz-ending">
      {fallback ? (
        <img className="wz-ending__image" src={`${SETUP}/promotion_default_img_horizontal.webp`} alt="" />
      ) : (
        <video
          ref={video}
          className="wz-ending__video"
          src={`${import.meta.env.BASE_URL}video/oobe_ending_2160p60.mp4`}
          playsInline
          onEnded={finish}
          onError={() => setFallback(true)}
        />
      )}
    </div>
  )
}
