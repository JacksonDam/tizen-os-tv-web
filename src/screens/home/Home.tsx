import { useCallback, useState } from 'react'
import { Sidebar, type SidebarItem } from '../sidebar/Sidebar'
import { ConnectedDevices } from '../system/ConnectedDevices'
import { QuickSettings } from '../system/QuickSettings'
import { MessageBox } from '../../components/MessageBox'
import './home.css'
import { useAgreed } from '../../tv/online'
import { SetupHome } from './SetupHome'
import { AgreedHome } from './AgreedHome'
import { useLaunching } from './appLaunch'
import { LaunchLoading } from './LaunchLoading'

// Where keys go: the page, the sidebar, or the system page (Connected Devices).
type Mode = 'page' | 'sidebar' | 'system'

type Props = {
  entry?: 'devices' | 'settings'                                       // opened by the Source / Settings key
  onHideHub: () => void                                                // Back in a system page: Smart Hub is lowered
  onLaunch: (target: 'allsettings' | 'support' | 'network') => void  // starts the All Settings app
}

export function Home({ entry, onHideHub, onLaunch }: Props) {
  const [mode, setMode] = useState<Mode>(entry ? 'system' : 'page')
  const [sidebarItem, setSidebarItem] = useState<SidebarItem>('home')
  const [sidebarEntry, setSidebarEntry] = useState<SidebarItem>('home')
  const [systemPage, setSystemPage] = useState<'devices' | 'settings'>(entry ?? 'devices')
  const [searchMsg, setSearchMsg] = useState(false)
  const onFocusItem = useCallback((id: SidebarItem) => setSidebarItem(id), [])
  const sidebarOpen = mode === 'sidebar'
  const agreed = useAgreed()
  const launching = useLaunching()
  // the page keeps its focus while the sidebar or a system page is up; Home returns to the page
  const [pageKey, setPageKey] = useState(0)
  const toDefaultFocus = () => setPageKey(k => k + 1)
  const pageProps = {
    active: mode === 'page' && !searchMsg,
    onSidebar: () => {
      setSidebarEntry('home')
      setMode('sidebar')
    },
    onHideHub,
  }
  return (
    <div className={`home home--${mode}`}>
      {agreed ? <AgreedHome key={`a${pageKey}`} {...pageProps} /> : <SetupHome key={`s${pageKey}`} {...pageProps} />}

      <div className="home__system">
        <ConnectedDevices
          visible={(sidebarOpen && sidebarItem === 'devices') || (mode === 'system' && systemPage === 'devices')}
          active={mode === 'system' && systemPage === 'devices'}
          onExitLeft={() => {
            setSidebarEntry('devices')
            setMode('sidebar')
          }}
          onHome={() => {
            setMode('page')
            toDefaultFocus()
          }}
          onHideHub={onHideHub}
          onLaunch={() => {}}
        />
        <QuickSettings
          visible={(sidebarOpen && sidebarItem === 'settings') || (mode === 'system' && systemPage === 'settings')}
          active={mode === 'system' && systemPage === 'settings'}
          onExitLeft={() => {
            setSidebarEntry('settings')
            setMode('sidebar')
          }}
          onHome={() => {
            setMode('page')
            toDefaultFocus()
          }}
          onHideHub={onHideHub}
          onLaunch={onLaunch}
        />
      </div>

      <Sidebar
        open={sidebarOpen}
        hidden={mode === 'system'}
        focusOnOpen={sidebarEntry}
        onClose={() => setMode('page')}
        onFocusItem={onFocusItem}
        onEnterSystem={id => {
          setSystemPage(id === 'settings' ? 'settings' : 'devices')
          setMode('system')
        }}
        onSearch={() => setSearchMsg(true)}
      />

      {/* OnSelectLoadingView sits on the window's default layer, over the sidebar too */}
      {launching && <LaunchLoading />}

      {searchMsg && (
        <MessageBox
          message="Smart Hub is being updated. Please try again later."
          buttons={['OK']}
          onClose={() => setSearchMsg(false)}
        />
      )}
    </div>
  )
}
