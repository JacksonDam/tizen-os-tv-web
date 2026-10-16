import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { shell } from '../../tv/shell'
import { FluxPopup, OptionRow } from './ui'
import { TestFrame } from './TestFrame'
import { finishTest } from './testFlow'

// Smart Hub Connection Test (org.tizen.smarthub-connection-test, spec3/diag.md 4.3): the start page,
// then five steps (network connection, gateway, DNS, ISP blocking, Samsung server; netdiag.xml pings
// GPM / OSB) with the TV - router - internet picture from ug-SystemSetupNetworkUG-efl, "Step n of 5",
// "<step> test in progress." and [Cancel Test]; then the result. The network is mocked: wired and up
// unless the Connections settings stored a disconnected state.

const NET = `${TV}/support/network`
const STEP_MS = 2000 // per step (mock; the TV waits on the servers)

const T = {
  title: 'Smart Hub Connection Test',
  intro: 'Use this test when you experience a problem with your TV service or network connection.',
  mayTake: 'This test may take a while depending on the network connection status.',
  start: 'Start Smart Hub Connection Test',
  close: 'Close',
  cancelTest: 'Cancel Test',
  cancelQ: 'Do you want to cancel the test?',
  yes: 'Yes',
  no: 'No',
  stepOf: (n: number, of: number) => `Step ${n} of ${of}`,
  inProgress: (s: string) => `${s} test in progress.`,
  allDone: 'All the tests were completed successfully.',
  success:
    'The Smart Hub connection test was completed successfully. If you have any problems using online services, contact your Internet Service Provider.',
  noCable:
    'No network cable found. Check that your network cable is plugged in. If it is connected, make sure that the router is turned on; if it is on, try turning it off and on again.',
  networkSettings: 'Network Settings',
  retry: 'Retry',
}

// the network the Connections screens stored, if any (tizen-os-tv-web.network; read loosely)
function network(): { wireless: boolean; connected: boolean } {
  try {
    const n = JSON.parse(localStorage.getItem('tizen-os-tv-web.network') ?? 'null')
    if (n && typeof n === 'object') {
      const type = String(n.type ?? n.kind ?? n.networkType ?? '').toLowerCase()
      return { wireless: ['wifi', 'wi-fi', 'wireless'].includes(type), connected: n.connected !== false }
    }
  } catch {
    /* no stored network: the default wired connection */
  }
  return { wireless: false, connected: true }
}

export function SmartHubConnectionTest(props: AppProps) {
  const net = network()
  const steps = [net.wireless ? 'Wireless Network Connection' : 'Wired Network Connection', 'Gateway', 'DNS', 'ISP Blocking', 'Samsung Server']
  const [phase, setPhase] = useState<'start' | 'testing' | 'pass' | 'fail'>('start')
  const [step, setStep] = useState(0)
  const [dots, setDots] = useState(0)
  const [focus, setFocus] = useState(0)
  const [ask, setAsk] = useState(false)
  useMoveSound(`${phase}:${focus}`)

  // run the steps; the connector dots cycle 0..3 while a step runs
  useEffect(() => {
    if (phase !== 'testing' || ask) return
    const d = setInterval(() => setDots(x => (x + 1) % 4), 250)
    const t = setTimeout(() => {
      if (step === 0 && !net.connected) {
        setPhase('fail')
        setFocus(0)
      } else if (step + 1 >= steps.length) {
        setPhase('pass')
        setFocus(0)
      } else setStep(step + 1)
    }, STEP_MS)
    return () => {
      clearInterval(d)
      clearTimeout(t)
    }
  }, [phase, step, ask, net.connected, steps.length])

  const buttons =
    phase === 'start' ? [T.start, T.close] : phase === 'testing' ? [T.cancelTest] : phase === 'pass' ? [T.close] : [T.networkSettings, T.retry, T.close]
  const result = phase === 'pass' ? 'pass' : 'fail'

  useRemote(key => {
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons.length - 1, f + 1))
    else if (key === 'Enter') {
      const b = buttons[focus]
      if (b === T.start || b === T.retry) {
        setStep(0)
        setPhase('testing')
        setFocus(0)
      } else if (b === T.cancelTest) setAsk(true)
      else if (b === T.networkSettings) shell.openSettings('connection') // Settings > Connections (inferred target)
      else if (b === T.close) finishTest(props, 'SmartHubConnection', phase === 'start' ? 'Stop' : 'Complete', phase === 'start' ? undefined : result)
    } else return false
    return true
  }, !ask)

  const done = phase === 'pass' || phase === 'fail'
  const link = (active: boolean, i: number) => (
    <img className="shc__link" src={`${NET}/oobe_icon_network_connect_${active ? dots : i}.svg`} alt="" />
  )
  const reached = phase === 'pass' ? 5 : step // steps finished

  return (
    <TestFrame
      app={props}
      item="SmartHubConnection"
      title={T.title}
      onBack={done ? () => finishTest(props, 'SmartHubConnection', 'Complete', result) : undefined}
    >
      <div className="shc__picture">
        <img className="shc__tv" src={`${NET}/oobe_img_network_tv.svg`} alt="" />
        {phase === 'testing' && step < 2 ? link(true, 0) : link(false, reached >= 2 || done ? 3 : 0)}
        <img className="shc__lan" src={`${NET}/oobe_img_network_lan.svg`} alt="" />
        {phase === 'testing' && step >= 2 ? link(true, 0) : link(false, phase === 'pass' ? 3 : 0)}
        <img className="shc__earth" src={`${NET}/oobe_img_network_earth.svg`} alt="" />
        {phase === 'fail' && <img className="shc__error" src={`${NET}/oobe_icon_network_error.svg`} alt="" />}
      </div>
      {phase === 'start' && (
        <div className="tf__message tf__message--low">
          {T.intro}
          <br />
          {T.mayTake}
        </div>
      )}
      {phase === 'testing' && (
        <div className="tf__message tf__message--low">
          <div className="shc__step">{T.stepOf(step + 1, steps.length)}</div>
          {T.inProgress(steps[step])}
        </div>
      )}
      {phase === 'pass' && (
        <div className="tf__message tf__message--low">
          <div className="shc__ok">{T.allDone}</div>
          {T.success}
        </div>
      )}
      {phase === 'fail' && <div className="tf__message tf__message--low">{T.noCable}</div>}
      <OptionRow labels={buttons} focus={ask ? null : focus} />
      {ask && (
        <FluxPopup
          message={T.cancelQ}
          buttons={[T.yes, T.no]}
          onBack={() => setAsk(false)}
          onSelect={b => {
            setAsk(false)
            if (b === 0) {
              setPhase('start')
              setStep(0)
              setFocus(0)
            }
          }}
        />
      )}
    </TestFrame>
  )
}
