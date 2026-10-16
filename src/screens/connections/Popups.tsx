import { useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { playFeedback, useMoveSound } from '../../tv/sound'
import { setSetting } from '../../tv/store'
import type { PopupProps } from '../allsettings/extensions'
import { getNet, resetNetwork, setNet } from './network'
import { Spinner } from './NetPage'

// Popups over the All Settings panel, both P_PopupBasicBottom_01 without a title (CPopupBase), 65 u
// wide in the panel: Reset Network (org.tizen.ResetNetwork) and the Wi-Fi switch confirmation
// (org.tizen.WiFiOnOff, chained after the Expert Settings > Wi-Fi switch). spec3/connections.md 3.3-3.4.

function PopupFrame({ message, buttons, focus, waiting }: { message: string; buttons: string[]; focus: number; waiting?: boolean }) {
  return (
    <div className="net-popup">
      <div className="net-popup__plate">
        {waiting ? (
          <div className="net-popup__wait">
            <Spinner />
            <div className="net-popup__msg">{message}</div>
          </div>
        ) : (
          <div className="net-popup__msg">{message}</div>
        )}
        {!!buttons.length && (
          <div className="net-popup__buttons">
            {buttons.map((b, i) => (
              <div key={b} className={`flux-btn net-popup__button ${focus === i ? 'is-focused' : ''}`}>{b}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function useRow(count: number) {
  const [f, setF] = useState(0)
  useMoveSound(f)
  return [f, (key: string) => {
    if (key === 'Left') setF(x => Math.max(0, x - 1))
    else if (key === 'Right') setF(x => Math.min(count - 1, x + 1))
  }, setF] as const
}

const RESET_MS = 2000 // (inferred) "Resetting the network settings... Please wait."

export function ResetNetworkPopup({ onClose }: PopupProps) {
  const [step, setStep] = useState<'ask' | 'wait' | 'done'>('ask')
  const [f, move, setF] = useRow(step === 'ask' ? 2 : 1)
  useEffect(() => {
    if (step !== 'wait') return
    const t = setTimeout(() => {
      resetNetwork()
      setSetting('WIFI_ON_OFF', 1)
      setF(0)
      setStep('done')
    }, RESET_MS)
    return () => clearTimeout(t)
  }, [step, setF])
  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false
    if (step === 'wait') return true
    if (key === 'Back') {
      playFeedback('back')
      onClose()
    } else if (key === 'Enter') {
      if (step === 'ask' && f === 0) setStep('wait')
      else onClose()
    } else move(key)
    return true
  })
  if (step === 'wait') return <PopupFrame message="Resetting the network settings... Please wait." buttons={[]} focus={-1} waiting />
  if (step === 'done') {
    return (
      <PopupFrame
        message="The network settings have been reset. You can set them again by selecting Network Settings."
        buttons={['Close']}
        focus={f}
      />
    )
  }
  return <PopupFrame message="Do you want to reset the network settings?" buttons={['Reset', 'Cancel']} focus={f} />
}

// Expert Settings > Wi-Fi: turning it on applies at once; turning it off asks first.
export function WifiSwitchPopup({ onClose }: PopupProps) {
  const [f, move] = useRow(2)
  const on = getNet().wifiOn
  useEffect(() => {
    if (on) return
    setNet({ wifiOn: true })
    setSetting('WIFI_ON_OFF', 1)
    onClose()
  }, [on, onClose])
  useRemote(key => {
    if (key === 'Home' || key === 'Exit') return false
    if (key === 'Back') {
      playFeedback('back')
      onClose()
    } else if (key === 'Enter') {
      if (f === 0) {
        setNet(s => ({ wifiOn: false, ssid: s.type === 'wireless' ? null : s.ssid }))
        setSetting('WIFI_ON_OFF', 0)
      }
      onClose()
    } else move(key)
    return true
  }, on)
  if (!on) return null
  return (
    <PopupFrame
      message="Some features will not be available when you turn off the Wi-Fi. Do you want to go ahead?"
      buttons={['Yes', 'No']}
      focus={f}
    />
  )
}
