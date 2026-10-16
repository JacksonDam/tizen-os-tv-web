import type { ReactNode } from 'react'
import type { AppProps } from '../../apps/registry'
import { SD, SD_APP_ID, setResult, type SDResult } from './sdData'
import { ABOUT_TV } from '../support/supportData'

// How the Self Diagnosis test apps hand back to Device Care (app_control extras launchedFrom /
// DiagnosisType / currentDiagnosisCount / totalDiagnosisCount, and the action they relaunch it with).

export type TestArgs = { launchedFrom?: string; DiagnosisType?: string; currentDiagnosisCount?: string; totalDiagnosisCount?: string }

export function fromSD(args?: Record<string, string>) {
  return args?.launchedFrom === SD_APP_ID
}

// m_LaunchDeviceCareApp: report the result and hand back to Device Care (action Complete / Skip / Stop
// for a Test All run, or the Self Diagnosis view focused on this item).
export function finishTest(
  props: AppProps,
  item: string,
  action: 'Complete' | 'Skip' | 'Stop',
  result?: SDResult,
) {
  if (result) setResult(item, result)
  const a = props.args
  if (!fromSD(a)) return props.onExit('live')
  if (a?.DiagnosisType === 'DiagnoseAll') props.launch('devicecare', { view: 'sdall', action })
  else props.launch('devicecare', { view: 'selfdiag', focus: item })
}

// "We've found a problem..." with the details to give the support agent (GetTestFailMessage)
export function supportInfo(): ReactNode {
  const f = ABOUT_TV.fields
  return (
    <>
      {SD.problem}
      <br />
      <br />
      Be ready to provide the following information to the support agent:
      <br />
      {'Model code: '}
      <span className="tf__value">{f[0].value}</span>
      <br />
      {'Software version: '}
      <span className="tf__value">{f[2].value}</span>
      <br />
      {'Serial number: '}
      <span className="tf__value">{f[1].value}</span>
    </>
  )
}

