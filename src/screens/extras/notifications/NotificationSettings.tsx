import { useState } from 'react'
import { useRemote } from '../../../input/remote'
import { useMoveSound } from '../../../tv/sound'
import { setAllowSound, useNotifications } from './store'

// The center's Settings popup (NotificationSettingPopup -> SettingPopup2): 161 x 97 u popup titled
// "Settings" with the "Allow sound" switch tile and the service list, closed with OK. This mock has no
// notification services registered, so the list area shows the firmware's no-service message
// (TV_SID_NOTI_SERVICE_PROVIDES_NOTI_NOT_USED).

export function NotificationSettings({ onClose }: { onClose: () => void }) {
  const allow = useNotifications(s => s.allowSound)
  const [focus, setFocus] = useState<'sound' | 'ok'>('sound')
  useMoveSound(focus)

  useRemote(key => {
    if (key === 'Up') setFocus('sound')
    else if (key === 'Down') setFocus('ok')
    else if (key === 'Enter') {
      if (focus === 'sound') setAllowSound(!allow)
      else onClose()
    } else if (key === 'Back') onClose()
    else if (key === 'Home' || key === 'Exit') return false
    return true
  })

  return (
    <div className="ns">
      <div className="ns__dim" />
      <div className="ns__area">
        <div className="ns__title">Settings</div>
        <div className={`ns-switch ${focus === 'sound' ? 'is-focused' : ''}`}>
          <span className="ns-switch__label">Allow sound</span>
          <span className={`ns-switch__track ${allow ? 'is-on' : ''}`}>
            <span className="ns-switch__thumb" />
          </span>
        </div>
        <div className="ns__list">
          <div className="ns__msg">The service that provides notifications is currently not being used.</div>
        </div>
        <div className={`nc-btn ns__ok ${focus === 'ok' ? 'is-focused' : ''}`}>OK</div>
      </div>
    </div>
  )
}
