import { useEffect, useMemo, useRef, useState } from 'react'
import { TV } from '../../../assets'
import { isNavKey, pressKey, useRemote, type RemoteKey } from '../../../input/remote'
import { getShellView, shell, useShellView } from '../../../tv/shell'
import { getTv, tuneChannel } from '../../../tv/store'
import { playFeedback } from '../../../tv/sound'
import { createValue } from '../state'
import {
  LIST_PADDING, NUM_BUTTON, NUM_GROUP_GAP, NUM_ICON, NUM_ITEM_GAP, OPT_BUTTON, OPT_GROUP_GAP, OPT_ICON,
  OPT_ITEM_GAP, OPT_LABEL, QUE_SIZE, listWidth, padLayout, type NumItem, type OptItem, type PadLayout,
} from './layouts'
import './numpad.css'

// The 123 key's on-screen number pad: org.tizen.function-osd (com.samsung.tv.virtual-remote) hosting
// org.tizen.VirtualRemoteControlNUIGadget in its Bar layout. A blurred 13 u bar at the bottom left with
// the number list, and an option list one Right press past the last number. Typed digits show above the
// bar with a Done button and tune 3 s after the last digit (spec3/extras.md section 1).

const VR = `${TV}/virtual-remote`

// Defined.cs: ExitMSeconds 10000, DtvInputMSeconds 3000, ExternalInputMSeconds 2000, InputFieldMaxLength 9
const EXIT_MS = 10000
const DTV_INPUT_MS = 3000
const EXTERNAL_INPUT_MS = 2000
const INPUT_MAX = 9

const shown = createValue(0) // show count; 0 = hidden (a new count remounts the pad with fresh state)

// XF86More: show the pad. The host pauses a partial-screen Home or Settings first
// (LaunchRequest.PauseAppsBeforeLaunch: csfs, org.tizen.menu, connection guide, Quick Settings).
export function toggleNumPad() {
  if (shown.get()) {
    shown.set(0) // a second press closes it (inferred; the quick-launch host that cycles is not in the firmware)
    return
  }
  const v = getShellView()
  if (v.hub || v.settings) shell.toLive()
  shown.set(Date.now())
}
export function hideNumPad() {
  shown.set(0)
}
export function isNumPadShown() {
  return shown.get() > 0
}

export function NumPad() {
  const seq = shown.use()
  if (!seq) return null
  return <NumPadView key={seq} />
}

type Focus = { pad: 'number' | 'option'; index: number } | { pad: 'done' }

const DIGIT_TEXT: Partial<Record<NumItem, string>> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', dash: '-',
}

function NumPadView() {
  const view = useShellView()
  // the layout is chosen once per show (ReceivedAppControlParser.Parse runs on each launch)
  const layout = useMemo<PadLayout>(() => padLayout(getShellView(), getTv()), [])
  const numbers = useMemo(() => layout.numeric.flat(), [layout])
  const options = useMemo(() => layout.option.flat(), [layout])
  // both pads take the wider list's width (BarMainPadsView.UpdateMainPadSize)
  const listW = Math.max(
    listWidth(layout.numeric, NUM_BUTTON, NUM_ITEM_GAP, NUM_GROUP_GAP),
    listWidth(layout.option, OPT_BUTTON, OPT_ITEM_GAP, OPT_GROUP_GAP),
  )
  const barW = listW + QUE_SIZE + LIST_PADDING * 2

  // first focus: Numeric_6 (BarNumericView.SetFocusTo, first time focus after every show)
  const [focus, setFocus] = useState<Focus>({ pad: 'number', index: Math.max(0, numbers.indexOf('6')) })
  const [category, setCategory] = useState<'number' | 'option'>('number')
  const [switchSeq, setSwitchSeq] = useState(0)
  const [input, setInput] = useState<NumItem[]>([])
  const inputRef = useRef(input)
  inputRef.current = input

  // ---- timers (TimerManager.ExitTimer / ChannelTurnTimer) ----
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tuneTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const startExit = () => {
    clearTimeout(exitTimer.current)
    exitTimer.current = setTimeout(hideNumPad, EXIT_MS)
  }
  const stopExit = () => clearTimeout(exitTimer.current)
  const startTune = () => {
    clearTimeout(tuneTimer.current)
    tuneTimer.current = setTimeout(commit, layout.source === 'rf' ? DTV_INPUT_MS : EXTERNAL_INPUT_MS)
  }
  const stopTune = () => clearTimeout(tuneTimer.current)
  useEffect(() => {
    startExit()
    return () => {
      clearTimeout(exitTimer.current)
      clearTimeout(tuneTimer.current)
    }
  }, [])

  // NumericViewModel.OnChannelTune: on the tuner the digits go to tv-viewer as major-minor; on other
  // sources they are sent to the device as keys (no visible change here).
  function commit() {
    stopTune()
    stopExit()
    const typed = inputRef.current
    if (layout.source === 'rf' && typed.length) {
      const dash = typed.indexOf('dash')
      const major = (dash >= 0 ? typed.slice(0, dash) : typed).map(d => DIGIT_TEXT[d]).join('')
      const i = getTv().channels.findIndex(c => c.number === Number(major))
      hideNumPad()
      if (major && i >= 0) tuneChannel(i)
      return
    }
    hideNumPad()
  }

  const pushDigit = (item: NumItem) => {
    // TryPushBackInputField: tune timer starts, exit timer stops; max 9 characters
    startTune()
    stopExit()
    if (input.length >= INPUT_MAX) return
    setInput([...input, item])
  }
  const popDigit = () => {
    if (!input.length) {
      startExit()
      return
    }
    const next = input.slice(0, -1)
    setInput(next)
    if (next.length) startTune()
    else {
      stopTune()
      if (focus.pad === 'done') setFocus({ pad: 'number', index: numbers.indexOf('delete') })
    }
    startExit()
  }

  const executeNumber = (item: NumItem) => {
    switch (item) {
      case 'ttx':
        // VirtualKeyManager sends XF86Teletext and the pad hides; this mock tuner carries no teletext
        hideNumPad()
        break
      case 'delete':
        popDigit()
        break
      case 'left':
      case 'right':
        // sent to the CEC device as Left/Right keys
        if (input.length) startTune()
        startExit()
        break
      default:
        pushDigit(item)
    }
  }
  const executeOption = (item: OptItem) => {
    hideNumPad() // OptionViewModel.OnItemClicked ends with AppStateManager.RequestHide()
    if (item === 'info') pressKey('Info')
    else if (item === 'schedule') shell.launch('schedule-manager') // org.tizen.schedule-manager (if present)
    // 'stop' goes to the CEC device as XF86Stop
  }

  // DirectionKeyHandle: the move sound, the tune timer restarts while digits are shown, exit timer restarts
  const moved = (silent = false) => {
    if (!silent) playFeedback('move')
    if (input.length) startTune()
    startExit()
  }

  const switchTo = (pad: 'number' | 'option') => {
    setCategory(pad)
    setSwitchSeq(s => s + 1)
    if (pad === 'option') {
      setInput([]) // OnRequestSwitchToNextCategory clears the input field
      stopTune()
      setFocus({ pad: 'option', index: 0 })
    } else setFocus({ pad: 'number', index: numbers.length - 1 })
    playFeedback('move')
    startExit()
  }

  useRemote((key: RemoteKey) => {
    // GadgetUIContentPage.OnKeyEvent: Guide (and Voice) close the pad; channel keys close it over live TV
    if (key === 'Guide') {
      hideNumPad()
      return true
    }
    if (key === 'ChannelUp' || key === 'ChannelDown') {
      if (view.live) {
        hideNumPad()
        return true
      }
      return false
    }
    if (key === 'More') {
      hideNumPad()
      return true
    }
    if (key.startsWith('Digit')) {
      // a keyboard's number keys type into the pad (inferred; the TV remote has none)
      if (category !== 'number') switchTo('number')
      pushDigit(key.slice(5) as NumItem)
      return true
    }
    if (key === 'Home') {
      hideNumPad() // XF86Home pauses org.tizen.function-osd (manifest app-context rule), Home still opens
      return false
    }
    if (!isNavKey(key)) {
      if (key === 'Info' || key === 'Source' || key === 'Settings' || key === 'ChannelList') hideNumPad()
      return false
    }
    if (key === 'Back' || key === 'Exit') {
      hideNumPad()
      return true
    }

    if (focus.pad === 'done') {
      if (key === 'Down') {
        setFocus({ pad: 'number', index: Math.max(0, numbers.indexOf('6')) })
        moved()
      } else if (key === 'Enter') {
        playFeedback('select')
        commit()
      } else if (key === 'Left' || key === 'Right') moved()
      return true
    }

    const list = focus.pad === 'number' ? numbers : options
    const i = focus.index
    if (key === 'Left') {
      if (i > 0) {
        setFocus({ ...focus, index: i - 1 })
        moved()
      } else if (focus.pad === 'option') switchTo('number')
    } else if (key === 'Right') {
      if (i < list.length - 1) {
        setFocus({ ...focus, index: i + 1 })
        moved()
      } else if (focus.pad === 'number') switchTo('option')
    } else if (key === 'Up') {
      // BarMainPadsView.OnKeyEvent: Up from the numbers goes to Done while digits are shown
      if (focus.pad === 'number' && input.length) {
        setFocus({ pad: 'done' })
        moved(true)
      } else moved(true)
    } else if (key === 'Down') {
      moved(true)
    } else if (key === 'Enter') {
      if (!getShellView().app) playFeedback('select') // over apps the TV shell already plays it
      if (focus.pad === 'number') executeNumber(numbers[i])
      else executeOption(options[i])
    }
    return true
  })

  const text = input.map(d => DIGIT_TEXT[d]).join('')
  const focusedNumber = focus.pad === 'number' ? numbers[focus.index] : null
  const focusedOption = focus.pad === 'option' ? options[focus.index] : null
  const anim = switchSeq ? (category === 'option' ? 'to-option' : 'to-number') : ''

  return (
    <div className="vr" style={{ width: barW }}>
      {/* input field (11 u) with the typed digits and Done; hidden until a digit is typed */}
      <div className={`vr-input ${input.length ? '' : 'is-hidden'}`}>
        <div className="vr-input__text">{text}</div>
        <div className={`vr-done ${focus.pad === 'done' ? 'is-focused' : ''}`}>
          <span className="vr-done__icon" style={{ maskImage: `url(${VR}/control_icon_done.svg)`, WebkitMaskImage: `url(${VR}/control_icon_done.svg)` }} />
          <span>Done</span>
        </div>
      </div>
      <div className="vr-bar">
        <div key={`n${switchSeq}`} className={`vr-pad vr-pad--number ${category === 'number' ? 'is-current' : 'is-away'} ${anim}`}>
          <div className="vr-list" style={{ width: listW, gap: NUM_GROUP_GAP }}>
            {layout.numeric.map((g, gi) => (
              <div key={gi} className="vr-group" style={{ gap: NUM_ITEM_GAP }}>
                {g.map(item => (
                  <div key={item} className={`vr-item ${focusedNumber === item ? 'is-focused' : ''}`}>
                    <span className="vr-item__icon" style={{ maskImage: `url(${VR}/${NUM_ICON[item]})`, WebkitMaskImage: `url(${VR}/${NUM_ICON[item]})` }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <img className="vr-que" src={`${VR}/control_icon_indicator_color.svg`} alt="" />
        </div>
        <div key={`o${switchSeq}`} className={`vr-pad vr-pad--option ${category === 'option' ? 'is-current' : 'is-away'} ${anim}`}>
          <img className="vr-que" src={`${VR}/control_icon_indicator_number.svg`} alt="" />
          <div className="vr-list vr-list--center" style={{ width: listW, gap: OPT_GROUP_GAP }}>
            {layout.option.map((g, gi) => (
              <div key={gi} className="vr-group" style={{ gap: OPT_ITEM_GAP }}>
                {g.map(item => (
                  <div key={item} className={`vr-item vr-item--option ${focusedOption === item ? 'is-focused' : ''}`}>
                    <span className="vr-item__icon" style={{ maskImage: `url(${VR}/${OPT_ICON[item]})`, WebkitMaskImage: `url(${VR}/${OPT_ICON[item]})` }} />
                    {focusedOption === item && <div className="vr-tip">{OPT_LABEL[item]}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
