import { useState, type ReactNode } from 'react'
import type { RemoteKey } from '../../input/remote'
import type { AppProps } from '../../apps/registry'
import { SD } from './sdData'
import { finishTest } from './testFlow'
import { FluxPopup, FluxScreen, KeyLayer } from './ui'

// Frame for the Self Diagnosis test apps (org.tizen.picture-test, org.tizen.sound-test,
// org.tizen.smarthub-connection-test, com.samsung.tv.hdmi-troubleshooting): FLUX background, the
// "n / total" step counter in a Test All run (m_SetCountOfCurrDiagnosis; CC_Point3100 700), the title,
// and the return popup (Skip / Stop / Cancel) that Back opens during Test All. Layout values follow
// SDSelfDiagnosisAllView, which these native apps mirror (inferred: their EDC is not in the package).

type Props = {
  app: AppProps
  item: string        // Self Diagnosis item name
  title: string
  onBack?: () => void // Back once the test has a result (default: leave without one)
  children: ReactNode
}

export function TestFrame({ app, item, title, onBack, children }: Props) {
  const all = app.args?.DiagnosisType === 'DiagnoseAll'
  const [ret, setRet] = useState(false)

  // Back: the given action, the return popup during Test All, else back to Self Diagnosis. The views
  // inside the frame see keys first and let Back through.
  const frameKeys = (key: RemoteKey) => {
    if (key === 'Home') return false
    if (key === 'Back') {
      if (onBack) onBack()
      else if (all) setRet(true)
      else finishTest(app, item, 'Stop')
    } else if (key === 'Exit') app.onExit('live')
    return true
  }

  return (
    <FluxScreen className="tf">
      <KeyLayer handler={frameKeys} />
      {all && (
        <div className="sda__step">
          <span className="sda__step-current">{app.args?.currentDiagnosisCount}</span>
          <span className="sda__step-slash">/</span>
          <span className="sda__step-total">{app.args?.totalDiagnosisCount}</span>
        </div>
      )}
      <div className="sda__name">{title}</div>
      {children}
      {ret && (
        <FluxPopup
          message={SD.skipOrStop}
          buttons={[SD.skip, SD.stop, SD.cancel]}
          onBack={() => setRet(false)}
          onSelect={b => {
            setRet(false)
            if (b === 0) finishTest(app, item, 'Skip')
            else if (b === 1) finishTest(app, item, 'Stop')
          }}
        />
      )}
    </FluxScreen>
  )
}
