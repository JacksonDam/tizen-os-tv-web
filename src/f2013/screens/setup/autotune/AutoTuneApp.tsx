import { closeApp, openApp, type AppProps } from '../../../shell'
import { AutoTuning } from './AutoTuning'

// App 'autotune': Menu > Broadcasting > Auto Tuning (CBDMenuTreeManager::AutoTuning_Run @02568898 ->
// app 9, activate 0x45a). params { returnTo?: app id, returnParams? }: where Cancel, RETURN on the options
// page and Close on the result go back to (the Menu: CChannelSearchApp::m_ReturnProcess @028d7e90).
export function AutoTuneApp({ params }: AppProps) {
  const p = (params ?? {}) as { returnTo?: string; returnParams?: unknown }
  const close = () => {
    if (p.returnTo && openApp(p.returnTo, p.returnParams)) return
    closeApp('autotune')
  }
  return (
    <div className="at-app">
      <AutoTuning mode="menu" onClose={close} />
    </div>
  )
}
