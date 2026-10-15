import { useCallback, useEffect, useState } from 'react'
import { useRemote } from '../../input/remote'
import { Sidebar, type SidebarItem } from '../sidebar/Sidebar'
import { ConnectedDevices } from '../system/ConnectedDevices'
import { QuickSettings } from '../system/QuickSettings'
import { MessageBox } from '../../components/MessageBox'
import { Lottie } from '../../components/Lottie'
import './home.css'
import { TV } from '../../assets'
import { useMoveSound } from '../../tv/sound'
import { setSetting, tuneChannel, useSetting, useTv } from '../../tv/store'
import { NowPlayingRow } from './NowPlayingRow'

const NH = `${TV}/com.samsung.tv.coba.newhome`
const CS = `${TV}/com.samsung.tv.csfs`

// Rotating account subtitles of the setup banner: FEATURE_1 <-> FEATURE_2 every 10 s, hard cut
// (CompTopBannerSetUpTile.cs, spec/home.md 6.1).
const SUBTITLES = [
  'With your Samsung account, experience content from a range of providers.',
  'Discover and download a wide range of apps for videos, gaming and more.',
]

// The page is a vertical list of rows ("layers") stacked without gaps (spec/home.md 2.1).
// scroll = list offset while the row has focus (3.3: FitToTop rows -> 0; the launcher row uses
// "offset 2 u", which puts its top at y 16; the rows below keep that position).
type RowId = 'banner' | 'tab' | 'nowplaying' | 'signin' | 'options' | 'bottom'
const ROWS: { id: RowId; scroll: number }[] = [
  { id: 'banner', scroll: 0 },
  { id: 'tab', scroll: 0 },
  { id: 'nowplaying', scroll: 0 },
  { id: 'signin', scroll: -840 },
  { id: 'options', scroll: -840 },
  { id: 'bottom', scroll: -840 },
]
// Focusing Now Playing morphs its row from 41 u to 49 u and pushes the rows below by 64 px.
const NOWPLAYING_MORPH = 64
const SOUND_RANGE: [number, number] = [1, 60]
// Row 3 "On Now": up to 10 channels in service-list order (spec2/device-sources-home.md C.2).
const ON_NOW_MAX = 10

// Where keys go: the page, the sidebar, or the system page (Connected Devices).
type Mode = 'page' | 'sidebar' | 'system'

type Props = {
  entry?: 'devices' | 'settings'                                       // opened by the Source / Settings key
  onHideHub: () => void                                                // Back in a system page: Smart Hub is lowered
  onLaunch: (target: 'allsettings' | 'support' | 'network') => void  // starts the All Settings app
}

export function Home({ entry, onHideHub, onLaunch }: Props) {
  const [row, setRow] = useState<RowId>('tab')
  // Focus inside row 3 (0 = Now Playing, 1.. = "On Now" channels); kept when focus leaves the row.
  const [npItem, setNpItem] = useState(0)
  const channels = useTv(s => s.channels)
  const onNow = channels.slice(0, ON_NOW_MAX)
  const item = Math.min(npItem, onNow.length)
  useMoveSound(row === 'nowplaying' ? `nowplaying:${item}` : row)
  const [mode, setMode] = useState<Mode>(entry ? 'system' : 'page')
  const [sidebarItem, setSidebarItem] = useState<SidebarItem>('home')
  const [sidebarEntry, setSidebarEntry] = useState<SidebarItem>('home')
  const [systemPage, setSystemPage] = useState<'devices' | 'settings'>(entry ?? 'devices')
  const [searchMsg, setSearchMsg] = useState(false)
  // Media Options > Autoplay Sound (db/home/mute_autoplay_sound), kept with the TV state.
  const autoplaySound = useSetting<number>('home-autoplay-sound', 1) === 1

  // ?sub=N pins the banner subtitle (used when comparing with reference screenshots).
  const pinned = new URLSearchParams(location.search).get('sub')
  const [subtitle, setSubtitle] = useState(pinned ? +pinned % SUBTITLES.length : 0)
  useEffect(() => {
    if (pinned) return
    const t = setInterval(() => setSubtitle(s => (s + 1) % SUBTITLES.length), 10000)
    return () => clearInterval(t)
  }, [pinned])

  const toDefaultFocus = () => setRow('tab') // CurrentTabDefaultFocus: Discover, page scrolls to the top

  useRemote(key => {
    const i = ROWS.findIndex(r => r.id === row)
    switch (key) {
      case 'Left':
        if (row === 'nowplaying' && item > 0) {
          setNpItem(item - 1)
          return true
        }
        setSidebarEntry('home')
        setMode('sidebar')
        return true
      case 'Right':
        if (row === 'nowplaying' && item < onNow.length) setNpItem(item + 1)
        return true
      case 'Down':
        if (i < ROWS.length - 1) setRow(ROWS[i + 1].id)
        return true
      case 'Up':
        if (i > 0) setRow(ROWS[i - 1].id)
        return true
      case 'Enter':
        if (row === 'tab') setRow('nowplaying')
        else if (row === 'nowplaying') {
          // Now Playing: tv-viewer comes to the front with the current source; a channel tile tunes it.
          if (item === 0) onHideHub()
          else tuneChannel(item - 1)
        } else if (row === 'options') setSetting('home-autoplay-sound', autoplaySound ? 0 : 1)
        else if (row === 'bottom') toDefaultFocus()
        return true
      case 'Back':
      case 'Home':
        toDefaultFocus()
        return true
      default:
        return false // TV keys (channel, Info, Source...) go on to tv-viewer
    }
  }, mode === 'page' && !searchMsg)

  const onFocusItem = useCallback((id: SidebarItem) => setSidebarItem(id), [])
  const sidebarOpen = mode === 'sidebar'
  const scroll = ROWS.find(r => r.id === row)!.scroll
  const morph = row === 'nowplaying' ? NOWPLAYING_MORPH : 0
  const pageFocus = (id: RowId) => mode === 'page' && row === id
  const cls = (id: RowId) => (pageFocus(id) ? 'is-focused' : '')
  // Auto-play (C.4): Now Playing plays while the Discover tab (auto_play_tab) or the tile has focus, a
  // channel tile while focused; any focus change restarts the timeline (no GVSync on this model).
  const playItem = mode !== 'page' || searchMsg ? -1 : row === 'tab' ? 0 : row === 'nowplaying' ? item : -1

  return (
    <div className={`home home--${mode}`}>
      <div className="home__page">
        <div className="home__list" style={{ transform: `translateY(${scroll}px)` }}>
          {/* Row 1: setup/account top banner (VPTopBannerAccountView), 240x43 u */}
          <section className="hrow hrow--banner">
            <img className="banner__art" src={`${NH}/home_i_banner_account.webp`} alt="" />
            <div className="banner__title">Welcome. Start your Smart Hub!</div>
            <div className="banner__subtitle">{SUBTITLES[subtitle]}</div>
            <div className={`flux-btn banner__setup ${cls('banner')}`}>Set Up Now</div>
            <div className="banner__guide">
              App availability may change depending on your country/region, device model and the service
              provider. Subscription may be required.
            </div>
          </section>

          {/* Row 2: tab list with one "Discover" tab (TabNListLayerView / VPTabview), 240x23 u */}
          <section className="hrow hrow--tab">
            <img className="tab__fade" src={`${CS}/home_i_bg_banner_gradient_bottom_2k.webp`} alt="" />
            <img className="tab__backplate" src={`${TV}/edenview-app/home_tab_backplate_192x64.png`} alt="" />
            <div className={`home-tab ${pageFocus('tab') ? 'is-focused' : 'is-selected'}`}>
              <span>Discover</span>
            </div>
          </section>

          {/* Row 3: Now Playing (VPHomeVideoRecentView) + On Now channels, 41 u (49 u while focused) */}
          <section className={`hrow hrow--nowplaying ${row === 'nowplaying' ? 'is-current' : ''}`}>
            <NowPlayingRow
              onNow={onNow}
              item={item}
              current={row === 'nowplaying'}
              focused={pageFocus('nowplaying')}
              playItem={playItem}
              playKey={`${row}:${playItem}`}
              sound={autoplaySound}
            />
          </section>

          {/* Row 4: sign-in banner in place of the app list (VPLauncherAccountMessageView), 28 u */}
          <section className="hrow hrow--signin" style={{ transform: `translateY(${morph}px)` }}>
            <div className={`signin ${cls('signin')}`}>
              <img src={`${NH}/home_i_icon_dumbtv_tile.webp`} alt="" />
              <div className="signin__text">Sign in to your Samsung account to find your favorite apps.</div>
              <div className="signin__disclaimer">
                App availability may change depending on your country/region, device model and the service
                provider. Subscription may be required.
              </div>
            </div>
          </section>

          {/* Row 5: Media Options (VPHomeSettingIconView), 42 u */}
          <section className="hrow hrow--options" style={{ transform: `translateY(${morph}px)` }}>
            <div className={`group-title ${cls('options')}`}>Media Options</div>
            <div className={`option ${cls('options')}`}>
              <div className="option__plate">
                <Lottie
                  className="option__icon"
                  src={`${NH}/home_i_icon_media_option_${autoplaySound ? 'soundon' : 'soundoff'}.json`}
                  playing={pageFocus('options')}
                  range={SOUND_RANGE}
                />
              </div>
              <div className="option__title">Autoplay Sound</div>
              <div className="option__subtitle">{autoplaySound ? 'On' : 'Off'}</div>
            </div>
          </section>

          {/* Row 6: "Move to top" (VPButtonView, C_ButtonBasicIcon_01), 19 u */}
          <section className="hrow hrow--bottom" style={{ transform: `translateY(${morph}px)` }}>
            <div className={`flux-btn flux-btn--icon gototop ${cls('bottom')}`}>
              <span className="gototop__icon" />
            </div>
          </section>
        </div>

        {/* "Secured by Knox", fixed to the screen while the bottom row is visible. */}
        <img className={`knox ${scroll !== 0 ? 'is-shown' : ''}`} src={`${CS}/i_logo_knox_default.svg`} alt="" />
      </div>

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
