import { useEffect, useRef, useState } from 'react'
import { TV } from '../../../assets'
import { isNavKey, useRemote, type RemoteKey } from '../../../input/remote'
import { Lottie } from '../../../components/Lottie'
import { getShellView, shell, useShellView } from '../../../tv/shell'
import { getSetting, getTv, useSetting, useTv } from '../../../tv/store'
import { useMoveSound } from '../../../tv/sound'
import { createValue } from '../state'
import { CONTROLS, HELP, SIGNAL, inputLag, minimapDisabled, type Control } from './data'
import './gamebar.css'

// Game Bar (com.samsung.tv.gamebar): in Game Mode on an HDMI input, a long press of Play/Pause
// (XF86PlayBackGame) slides a 240 x 46 u bar up from the bottom: eight control items (frame-sequence
// icons on a glowing plate) over a row of signal information. List items open an option list above
// the item; More settings and Sound Output open Settings; Help Guide opens a dialog. After it closes, a
// key guide reminds how to open it (up to 5 times). Spec: spec3/extras.md section 3.

const GB = `${TV}/gamebar`
const NORMAL_TIMEOUT = 60000   // CommonDef.NORMALLAUNCH_TIMEOUT
const AUTO_TIMEOUT = 5000      // CommonDef.AUTOLAUNCH_TIMEOUT
const GUIDE_MS = 10000         // GuideView delayTime
const GUIDE_MAX = 5            // CommonDef.ActiveGuideMessageShowTicker() >= 5 stops it
const LOADING_MS = 3000        // (inferred) the TV waits for the source to change resolution, up to 15 s

// ---- persisted Game Bar values (the TV keeps them in its picture/sound engine) ----
type Values = Record<'GG' | 'VA' | 'SR' | 'PZ' | 'MP', string> & { guideShown: number }
const KEY = 'tizen-os-tv-web.gamebar'
function loadValues(): Values {
  const base = {
    ...Object.fromEntries(CONTROLS.filter(c => c.initial).map(c => [c.id, c.initial])),
    guideShown: 0,
  } as unknown as Values
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...base, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return base
}
const values = createValue<Values>(loadValues())
function setValue(patch: Partial<Values>) {
  const next = { ...values.get(), ...patch }
  values.set(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

// ---- launch conditions (Launcher.CheckBaseLaunchCondition) ----
export function isGameModeOn() {
  return Number(getSetting('game-mode', 0)) === 1 || Number(getSetting('game-mode-subitem', 0)) === 1
}
function canLaunch() {
  const tv = getTv()
  return tv.power === 'on' && isGameModeOn() && tv.source !== 'TV' && getShellView().live
}

type Bar = { seq: number; auto: boolean }
const bar = createValue<Bar | null>(null)
const guide = createValue(0)

// XF86PlayBackGame: open the Game Bar (normal launch); nothing happens outside Game Mode or HDMI.
export function launchGameBar(auto = false) {
  if (!canLaunch()) return false
  guide.set(0)
  bar.set({ seq: Date.now(), auto })
  return true
}
export function isGameBarOpen() {
  return bar.get() !== null
}

// AUIManager.PlayFocusChangeSound: GB_AUI_Focus.wav 80 ms after a focus change, when Sound Feedback is
// on (played at the Sound Feedback level here; inferred).
const FEEDBACK_GAIN = [0, 0.398, 0.631, 1]
let focusSoundTimer: ReturnType<typeof setTimeout> | undefined
function playFocusSound() {
  const level = Number(getTv().settings['sound-feedback'] ?? 1)
  if (!level) return
  clearTimeout(focusSoundTimer)
  focusSoundTimer = setTimeout(() => {
    try {
      const a = new Audio(`${GB}/GB_AUI_Focus.mp3`)
      a.volume = FEEDBACK_GAIN[level] ?? FEEDBACK_GAIN[1]
      void a.play().catch(() => {})
    } catch {
      /* no audio */
    }
  }, 80)
}

// ---- overlay root: the bar, the key guide, the screen-ratio loading screen and the letterbox ----
export function GameBar() {
  const b = bar.use()
  return (
    <>
      <Letterbox />
      {b && <BarView key={b.seq} auto={b.auto} />}
      <KeyGuide />
      <RatioLoading />
    </>
  )
}

// The selected screen ratio narrows the game picture on this 16:9 panel (21:9 = 1920x810, 32:9 =
// 1920x540; GUIConfig SCREEN_HEIGHT_OF_2560_1080 / _3840_1080).
function Letterbox() {
  const v = values.use()
  const view = useShellView()
  const source = useTv(s => s.source)
  const gameMode = useSetting('game-mode', 0)
  const gameModeSub = useSetting('game-mode-subitem', 0)
  const on = Number(gameMode) === 1 || Number(gameModeSub) === 1
  if (!view.live || source === 'TV' || !on || v.SR === '16:9') return null
  const h = v.SR === '21:9' ? 810 : 540
  const band = (1080 - h) / 2
  return (
    <div className="gb-letterbox">
      <div style={{ height: band }} />
      <div style={{ height: band }} />
    </div>
  )
}

const loading = createValue<{ from: string; to: string } | null>(null)
function RatioLoading() {
  const l = loading.use()
  if (!l) return null
  return (
    <div className="gb-loading">
      <div className="gb-loading__box">
        <Lottie className="gb-loading__anim" src={`${GB}/SR.json`} playing loop />
        <div className="gb-loading__text">Changing Screen Ratio...</div>
        <div className="gb-loading__ratio">
          <span className="gb-loading__from">{l.from}</span>
          <span className="gb-loading__arrow" />
          <span className="gb-loading__to">{l.to}</span>
        </div>
      </div>
    </div>
  )
}

// GuideView: bottom centre, 55 x 21 u plate (gamebar_img_bg_keyguide_01.svg) with the Play/Pause key
// icon and "Press and Hold: Open the Game Bar"; slides up, hides after 10 s or Back.
function KeyGuide() {
  const g = guide.use()
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (!g) return
    setLeaving(false)
    const t = setTimeout(() => setLeaving(true), GUIDE_MS)
    return () => clearTimeout(t)
  }, [g])
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => guide.set(0), 500)
    return () => clearTimeout(t)
  }, [leaving])
  useRemote(key => {
    if (key === 'Back') {
      setLeaving(true)
      return true
    }
    return false
  }, !!g && !leaving)
  if (!g) return null
  return (
    <div key={g} className={`gb-guide ${leaving ? 'is-leaving' : ''}`}>
      <div className="gb-guide__box">
        <img className="gb-guide__key" src={`${GB}/common_playback.svg`} alt="" />
        <div className="gb-guide__text">Press and Hold: Open the Game Bar</div>
      </div>
    </div>
  )
}

// ---- the bar ----
function BarView({ auto }: { auto: boolean }) {
  const v = values.use()
  const source = useTv(s => s.source)
  const soundOutput = useSetting<number>('soundoutput', 0)
  const [phase, setPhase] = useState<'in' | 'shown' | 'out'>('in')
  const [focus, setFocus] = useState(-1) // -1 until the show animation ends (SetFocusToFirstEnabledItem)
  const [list, setList] = useState<{ index: number } | null>(null)
  const [press, setPress] = useState(0)
  const [help, setHelp] = useState(false)
  useMoveSound(list?.index, !!list)

  // display timer: 60 s (5 s when launched automatically), restarted by every key
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const restart = (ms = NORMAL_TIMEOUT) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => exit(), ms)
  }
  useEffect(() => {
    restart(auto ? AUTO_TIMEOUT : NORMAL_TIMEOUT)
    const t = setTimeout(() => {
      setPhase('shown')
      setFocus(0)
      playFocusSound()
    }, 500)
    return () => {
      clearTimeout(t)
      clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exit() {
    if (phase === 'out') return
    setPhase('out')
    setList(null)
    clearTimeout(timer.current)
    setTimeout(() => {
      bar.set(null)
      // OnHideAnimationFinished -> GuideView.ShowActiveGuide (at most 5 times)
      const n = values.get().guideShown
      if (n < GUIDE_MAX && getShellView().live) {
        setValue({ guideShown: n + 1 })
        guide.set(Date.now())
      }
    }, 500)
  }

  // option lists and what each item shows as its value
  const valueOf = (c: Control): string => {
    if (c.id === 'SO') return soundOutput === 1 ? 'Audio Out' : 'TV Speaker'
    if (c.options) return v[c.id as keyof Values] as string
    return ''
  }
  const disabledOf = (c: Control): number[] => {
    if (c.id === 'PZ') return minimapDisabled(v.SR)
    // Game Genre Auto: UnsupportedSource None / OtherExternalDevice (the set-top box on HDMI 2)
    if (c.id === 'GG' && source === 'HDMI2') return [0]
    return []
  }

  const select = (c: Control, i: number) => {
    const opt = c.options![i]
    if (opt === valueOf(c) || disabledOf(c).includes(i)) return
    if (c.id === 'SR') {
      // MainView.OnRatioChangeLoading: the loading screen covers the change, then focus returns to the
      // Screen Ratio list (SetFocusOnBackListOption)
      const from = v.SR
      loading.set({ from, to: opt })
      setTimeout(() => {
        setValue({ SR: opt, PZ: 'Off' })
        loading.set(null)
        restart()
      }, LOADING_MS)
      return
    }
    setValue({ [c.id]: opt } as Partial<Values>)
  }

  const activate = (i: number) => {
    const c = CONTROLS[i]
    setPress(p => p + 1) // click animation: scale 0.93 in 150 ms, back by 500 ms
    if (c.options) setList({ index: Math.max(0, c.options.indexOf(valueOf(c))) })
    else if (c.id === 'HG') setHelp(true)
    else if (c.id === 'MS') {
      exit()
      shell.openSettings('smartfeature') // LaunchUtil.LaunchMoreSetting -> Game Mode Settings (Advanced Features here)
    } else if (c.id === 'SO') {
      exit()
      shell.openSettings('sound') // LaunchSoundOutputSetting -> the sound output list (Sound here)
    }
  }

  useRemote((key: RemoteKey) => {
    if (phase === 'out' || help) return phase === 'out' ? false : true
    if (loading.get()) return isNavKey(key)
    restart()
    if (key === 'Home') {
      exit()
      return false
    }
    if (!isNavKey(key)) return false
    if (key === 'Exit') {
      exit()
      return true
    }
    if (focus < 0) return true
    if (list) {
      const c = CONTROLS[focus]
      const n = c.options!.length
      // ListOption: Up/Down move, OK selects, Down past the last item or Back returns to the item
      if (key === 'Up' && list.index > 0) setList({ index: list.index - 1 })
      else if (key === 'Down') {
        if (list.index < n - 1) setList({ index: list.index + 1 })
        else setList(null)
      } else if (key === 'Back') setList(null)
      else if (key === 'Enter') select(c, list.index)
      return true
    }
    if (key === 'Back') exit()
    else if (key === 'Left' && focus > 0) {
      setFocus(focus - 1)
      playFocusSound()
    } else if (key === 'Right' && focus < CONTROLS.length - 1) {
      setFocus(focus + 1)
      playFocusSound()
    } else if (key === 'Enter') activate(focus)
    return true
  })

  return (
    <div className={`gb gb--${phase}`}>
      <img className="gb__bg" src={`${GB}/Gamebar_bg_full_2.webp`} alt="" />
      <div className="gb__controls">
        {CONTROLS.map((c, i) => (
          <ControlItem
            key={c.id}
            c={c}
            value={valueOf(c)}
            focused={focus === i && !help}
            press={focus === i ? press : 0}
            list={focus === i && list ? { index: list.index, disabled: disabledOf(c), selected: c.options!.indexOf(valueOf(c)) } : null}
          />
        ))}
      </div>
      <div className="gb__info">
        <div className="gb-info gb-info--lag">
          <span className="gb-info__label">Input Lag: </span>
          <span className="gb-info__value">{inputLag(v.MP)}</span>
        </div>
        <div className="gb-info gb-info--res">
          <span className="gb-info__value">{SIGNAL.resolution}</span>
        </div>
        <div className="gb-info gb-info--fps">
          <img className="gb-info__icon" src={`${GB}/i_gamebar_FPS.svg`} alt="" />
          <span className="gb-info__value">{SIGNAL.fps}</span>
        </div>
        <div className="gb-info gb-info--hdr">
          <img className="gb-info__icon" src={`${GB}/i_gamebar_HDR.svg`} alt="" />
          <span className="gb-info__value">{SIGNAL.hdr}</span>
        </div>
        <div className="gb-info gb-info--vrr">
          <img className="gb-info__icon" src={`${GB}/i_gamebar_VRR.svg`} alt="" />
          <span className="gb-info__value">{SIGNAL.vrr}</span>
        </div>
      </div>
      {help && (
        <HelpGuide
          onClose={() => {
            setHelp(false)
            restart()
          }}
        />
      )}
    </div>
  )
}

// One control item (BaseControlItem): 21 x 36 u; frame icon 21 x 28 u over the BG frame sequence,
// main text T20 500 CC_Basic170, value T20 500 white. Focus plays the icon frames once (60 fps) and
// the BG sequence, which then loops from frame 22 (DisplayItemRaiseLoopAnimation).
function ControlItem({
  c, value, focused, press, list,
}: {
  c: Control
  value: string
  focused: boolean
  press: number
  list: { index: number; disabled: number[]; selected: number } | null
}) {
  const icon = useFrames(focused, 23, 60, null)
  const bg = useFrames(focused, 70, 30, 11) // the BG sheet keeps every other frame (140 -> 70)
  return (
    <div className={`gb-item ${focused ? 'is-focused' : ''}`}>
      <div key={press} className={`gb-item__art ${press ? 'is-pressed' : ''}`}>
        {focused && (
          <div
            className="gb-item__bg"
            style={{ backgroundPosition: `${-(bg % 10) * 168}px ${-Math.floor(bg / 10) * 224}px` }}
          />
        )}
        <div
          className="gb-item__icon"
          style={{ backgroundImage: `url(${GB}/icon_${c.icon}.webp)`, backgroundPosition: `${-icon * 168}px 0` }}
        />
      </div>
      <div className="gb-item__name">{c.name}</div>
      <div className="gb-item__value">{value}</div>
      {list && c.options && (
        <div className="gb-list" style={{ height: c.options.length * 64 + 80 }}>
          <img className="gb-list__top" src={`${GB}/Gamebar_option_bg_top.png`} alt="" />
          <img className="gb-list__mid" src={`${GB}/Gamebar_option_bg_mid.png`} alt="" />
          <img className="gb-list__bottom" src={`${GB}/Gamebar_option_bg_bottom.png`} alt="" />
          <div className="gb-list__items">
            {c.options.map((o, i) => (
              <div
                key={o}
                className={[
                  'gb-list__item',
                  i === list.index ? 'is-focused' : '',
                  i === list.selected ? 'is-selected' : '',
                  list.disabled.includes(i) ? 'is-disabled' : '',
                ].join(' ')}
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Frame player for a FrameImageBox: plays 0..count-1 once while active, then loops from `loopFrom`
// (or holds the last frame when loopFrom is null); frame 0 when inactive.
function useFrames(active: boolean, count: number, fps: number, loopFrom: number | null) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active) {
      setFrame(0)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      let f = Math.floor(((now - start) / 1000) * fps)
      if (f >= count) {
        if (loopFrom === null) {
          setFrame(count - 1)
          return
        }
        f = loopFrom + ((f - count) % (count - loopFrom))
      }
      setFrame(f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, count, fps, loopFrom])
  return frame
}

// Help Guide (HelpGuideDialog): P_PopupLargeBottom_01 160 x 98 u titled "Help Guide"; a vertical tab
// list (59 x 61 u, tabs 51 x 10 u) beside the text of the focused tab (87 x 61 u on black 10 %, T28),
// and Close.
function HelpGuide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const [at, setAt] = useState<'tabs' | 'text' | 'close'>('tabs')
  const [scroll, setScroll] = useState(0)
  const text = useRef<HTMLDivElement>(null)
  useMoveSound(`${at}:${tab}`)
  useEffect(() => setScroll(0), [tab])

  useRemote(key => {
    if (key === 'Back') onClose()
    else if (at === 'tabs') {
      if (key === 'Up' && tab > 0) setTab(tab - 1)
      else if (key === 'Down') {
        if (tab < HELP.length - 1) setTab(tab + 1)
        else setAt('close')
      } else if (key === 'Right') setAt('text')
    } else if (at === 'text') {
      const el = text.current
      const max = el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0
      if (key === 'Left') setAt('tabs')
      else if (key === 'Down') {
        if (scroll < max) setScroll(Math.min(max, scroll + 120))
        else setAt('close')
      } else if (key === 'Up') setScroll(Math.max(0, scroll - 120))
    } else if (at === 'close') {
      if (key === 'Up') setAt('tabs')
      else if (key === 'Enter') onClose()
    }
    if (key === 'Home' || key === 'Exit') return false
    return true
  })

  useEffect(() => {
    if (text.current) text.current.scrollTop = scroll
  }, [scroll])

  return (
    <div className="gb-help">
      <div className="gb-help__area">
        <div className="gb-help__title">Help Guide</div>
        <div className="gb-help__body">
          <div className="gb-help__tabs">
            <div className="gb-help__tablist" style={{ translate: `0 ${-Math.max(0, tab - 5) * 80}px` }}>
              {HELP.map((h, i) => (
                <div key={h.title} className={`gb-help__tab ${i === tab ? 'is-current' : ''} ${i === tab && at === 'tabs' ? 'is-focused' : ''}`}>
                  {h.title}
                </div>
              ))}
            </div>
          </div>
          <div ref={text} className={`gb-help__text ${at === 'text' ? 'is-focused' : ''}`}>
            {HELP[tab].text}
          </div>
        </div>
        <div className={`flux-btn gb-help__close ${at === 'close' ? 'is-focused' : ''}`}>Close</div>
      </div>
    </div>
  )
}

// Autorun Game Bar (More settings): the bar opens by itself for 5 s when a game input becomes the
// picture in Game Mode (launch_mode auto_source_change; shown after the input switch screen, inferred).
export function GameBarTriggers() {
  const source = useTv(s => s.source)
  const switchSeq = useTv(s => s.switchSeq)
  const autorun = useSetting('game-bar-autorun', 0)
  useEffect(() => {
    if (source === 'TV' || !Number(autorun) || !switchSeq) return
    const t = setTimeout(() => {
      if (isGameModeOn()) launchGameBar(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [source, switchSeq, autorun])
  return null
}
