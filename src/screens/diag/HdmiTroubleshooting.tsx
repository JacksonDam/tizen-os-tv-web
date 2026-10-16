import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { useMoveSound } from '../../tv/sound'
import { SOURCES, getTv, setTv, useSetting, useTv, type SourceId } from '../../tv/store'
import { TV } from '../../assets'
import type { AppProps } from '../../apps/registry'
import { FluxScreen, KeyLayer } from './ui'
import { finishTest } from './TestFrame'

// HDMI Troubleshooting (com.samsung.tv.hdmi-troubleshooting: a wizard-api app running the ug-hdmicec
// pages from config/HDMITroubleshooting.json, spec3/diag.md 4.4). Four step groups:
//   1 hdmi-selection         pick the HDMI device
//   2 hdmi-device-connection the device's picture in the wizard PIP: "Do you see the screen ...?"
//   3 hdmi-sound-connection  "Can you hear sound ...?"
//   4 hdmi-cable-connection / -test / -result, then hdmi-complete-success
// Wizard type B/C geometry from WizardOSDInfo.h (title 60 px 700 at y 180-280, subtitle 32 px 400
// #ffffffcc, buttons 84 px high at y 928, PIP_2 658 x 370 at (631, 413)); FLUX background (elm_flux_bg).

const RES = `${TV}/support/hdmi`
const CABLE_TEST_MS = 6000 // "may take up to 2 minutes" (mock)

const T = {
  title: 'HDMI Troubleshooting',
  stepOf: (n: number) => `Step ${n} of 4`,
  select: 'Select the external device you want to diagnose.',
  none: 'There is no device connected.',
  wait: 'Please wait while the screen is ready.',
  see: 'Do you see the screen of the connected device without problems?',
  hear: 'Can you hear sound from the connected device without any problems?',
  source: (s: string) => `Source: ${s}`,
  resolution: (r: string) => `Current Input Resolution: ${r}`,
  output: (o: string) => `Current Sound Output: ${o}`,
  unmute: 'Unmute the connected device and adjust its volume.',
  testCable: (n: number) => `Test the cable connected to the HDMI ${n} port.`,
  testHelp: 'To test the HDMI cable connected to your device, select the Start Test button. The test may take up to 2 minutes.',
  premium: '* First, check if you are using the premium high-speed cable.',
  testing: 'Testing the HDMI cable. This may take up to 2 minutes. Please do not turn off your TV before the test is complete.',
  cableDone: 'HDMI cable test is complete.',
  cableOk: 'No problems found with the HDMI cable. If the issue persists, check the status and settings of your external device.',
  portDone: (n: number) => `HDMI ${n} port test is complete.`,
  enjoy: 'Now enjoy the connected external device.',
  yes: 'Yes',
  no: 'No',
  startTest: 'Start Test',
  next: 'Next',
  previous: 'Previous',
  done: 'Done',
  speaker: 'TV Speaker',
  audioOut: 'Audio Out',
}

type Page = 'select' | 'device' | 'sound' | 'cable' | 'testing' | 'cableResult' | 'complete'
const STEP: Record<Page, number> = { select: 1, device: 2, sound: 3, cable: 4, testing: 4, cableResult: 4, complete: 4 }

const HDMI = SOURCES.filter(s => s.id !== 'TV')

export function HdmiTroubleshooting(props: AppProps) {
  const [page, setPage] = useState<Page>('select')
  const [history, setHistory] = useState<Page[]>([])
  const [focus, setFocus] = useState(0)
  const [port, setPort] = useState<SourceId>('HDMI1')
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [problem, setProblem] = useState(false)
  const volume = useTv(s => s.volume)
  const output = useSetting<number>('soundoutput', 0)
  useMoveSound(`${page}:${focus}`)

  const portNo = HDMI.findIndex(s => s.id === port) + 1
  const go = (p: Page) => {
    setHistory(h => [...h, page])
    setPage(p)
    setFocus(0)
  }

  // the wizard shows the device's picture: switch the TV to that input (quietly, no source banner)
  useEffect(() => {
    if (page !== 'device') return
    setReady(false)
    setTv({ source: port })
    const t = setTimeout(() => setReady(true), 1500)
    return () => clearTimeout(t)
  }, [page, port])

  useEffect(() => {
    if (page !== 'testing') return
    if (progress >= 100) return go('cableResult')
    const t = setTimeout(() => setProgress(p => p + 1), CABLE_TEST_MS / 100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, progress])

  const buttons: string[] =
    page === 'select'
      ? []
      : page === 'device' || page === 'sound'
        ? ready || page === 'sound' ? [T.yes, T.no] : []
        : page === 'cable'
          ? [T.startTest]
          : page === 'testing'
            ? []
            : page === 'cableResult'
              ? [T.next]
              : [T.done]

  const finish = () => finishTest(props, 'HDMITroubleshooting', 'Complete', problem ? 'fail' : 'pass')

  useRemote(key => {
    if (page === 'select') {
      if (key === 'Up') setFocus(f => Math.max(0, f - 1))
      else if (key === 'Down') setFocus(f => Math.min(HDMI.length - 1, f + 1))
      else if (key === 'Enter' && HDMI.length) {
        setPort(HDMI[focus].id)
        go('device')
      } else return false
      return true
    }
    if (key === 'Left') setFocus(f => Math.max(0, f - 1))
    else if (key === 'Right') setFocus(f => Math.min(buttons.length - 1, f + 1))
    else if (key === 'Enter' && buttons.length) {
      const b = buttons[focus]
      if (page === 'device') {
        if (b === T.yes) go('sound')
        else {
          setProblem(true)
          go('cable')
        }
      } else if (page === 'sound') {
        if (b === T.yes) go('complete')
        else {
          setProblem(true)
          go('cable')
        }
      } else if (b === T.startTest) {
        setProgress(0)
        go('testing')
      } else if (b === T.next) go('complete')
      else if (b === T.done) finish()
    } else return false
    return true
  })

  // Back: the previous page (wizard), out of the app from the first one
  const frameKeys = (key: Parameters<Parameters<typeof useRemote>[0]>[0]) => {
    if (key === 'Home') return false
    if (key === 'Back') {
      if (page === 'testing') return true
      if (history.length) {
        setPage(history[history.length - 1])
        setHistory(h => h.slice(0, -1))
        setFocus(0)
      } else finishTest(props, 'HDMITroubleshooting', 'Stop')
    } else if (key === 'Exit') props.onExit('live')
    return true
  }

  const src = SOURCES.find(s => s.id === port)!
  const video = getTv().source === port ? src.video : ''
  const width = buttons.length >= 3 ? 360 : 454
  const left = 960 - (buttons.length * width + (buttons.length - 1) * 10) / 2

  return (
    <FluxScreen className="ht">
      <KeyLayer handler={frameKeys} />
      <div className="ht__step">{T.stepOf(STEP[page])}</div>
      <div className="ht__title">{T.title}</div>
      <div className="ht__subtitle">
        {page === 'select' && (HDMI.length ? T.select : T.none)}
        {page === 'device' && (ready ? T.see : T.wait)}
        {page === 'sound' && T.hear}
        {page === 'cable' && T.testCable(portNo)}
        {page === 'testing' && T.testing}
        {page === 'cableResult' && T.cableDone}
        {page === 'complete' && T.portDone(portNo)}
      </div>

      {page === 'select' && (
        <div className="ht__list">
          {HDMI.map((s, i) => (
            <div key={s.id} className={`ht__device ${focus === i ? 'is-focused' : ''}`}>
              <img src={`${RES}/${focus === i ? 'mbr_icon_hdmi_f.png' : 'mbr_icon_hdmi_n.png'}`} alt="" />
              <span className="ht__device-name">{s.title}</span>
              <span className="ht__device-sub">{s.device}</span>
            </div>
          ))}
        </div>
      )}
      {page === 'device' && (
        <>
          <div className="ht__pip">
            {video && <video src={`${import.meta.env.BASE_URL}video/${video}`} autoPlay muted loop playsInline />}
          </div>
          <div className="ht__message ht__message--pip">
            {T.source(`HDMI ${portNo}`)}
            <br />
            {T.resolution('1920x1080 / 60p')}
          </div>
        </>
      )}
      {page === 'sound' && (
        <div className="ht__message">
          {T.output(output === 1 ? T.audioOut : T.speaker)}
          <br />
          {`Volume: ${volume}`}
          <br />
          <br />
          {T.unmute}
        </div>
      )}
      {page === 'cable' && (
        <div className="ht__message">
          {T.testHelp}
          <br />
          <br />
          {T.premium}
        </div>
      )}
      {page === 'testing' && (
        <div className="ht__progress">
          <span className="ht__track">
            <span className="ht__fill" style={{ width: `${progress}%` }} />
          </span>
          <span className="ht__percent">{`${progress}%`}</span>
        </div>
      )}
      {page === 'cableResult' && (
        <div className="ht__message">
          <img className="ht__check" src={`${RES}/i_icon_info_check.svg`} alt="" />
          <br />
          {T.cableOk}
        </div>
      )}
      {page === 'complete' && <div className="ht__message">{T.enjoy}</div>}

      {buttons.map((b, i) => (
        <div key={b} className={`flux-btn ht__button ${focus === i ? 'is-focused' : ''}`} style={{ left: left + i * (width + 10), width }}>
          {b}
        </div>
      ))}
    </FluxScreen>
  )
}
