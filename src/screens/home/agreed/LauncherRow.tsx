import { TV } from '../../../assets'
import { stubArt } from '../../../shared/fictional'
import type { LauncherItem } from '../launcher'
import { squircleClip, squircleRing } from './squircle'

// Row 4 of the agreed home: d/launcher (layer_type applist, style applist02 = MediaAppsLineDetail02:
// 21 u layer + 7 u gap, 14 u content centred, item gap 2 u, focused scale 1.2, push-back list, focus
// "lastposition", scroll offset 2 u). Its groups are d/launcher.layer (the apps) and
// d/launcher.edit.layer (Edit; Sort is shown only on US TVs with the viewing-information terms,
// CompSort.ChangeVisibility). The sign-in banner of d/launcher.login.layer is gone (CompLogin shows it only
// while the terms are not agreed).
//
// Tiles (14 x 14 u, squarcle corners, ring + SHADOW_01 when focused):
// - WebAppLauncher (VPLauncherImageView): the app's focused / unfocused icon images from the server
//   (here the stub artwork with the app's name).
// - IconTitleLauncher (VPLauncherIconTitleView): Live TV and HDMI sources: plate CC_Home_Device #008088,
//   an 8 x 8 u icon at the top (padding 1 u), the title T20 700 white in an 11 x 5 u box at the bottom
//   (padding 1 u), marquee when focused.
// - HomeEditView (VPLauncherCircleViewBase): a 10 x 10 u round plate CP_Plane110 (10% white, focused
//   white) with home_i_icon_app_edit.svg tinted CP_Info1100 (white, focused black) and, while focused,
//   the C_TooltipMultiLine_02 tooltip "List Edit" under it, scaled 0.8333 (CC_Point7100 #0099FF, T24 600,
//   padding 2 u, max width 25 u).

const ICON = 112      // 14 u
const PITCH = 128     // + item gap 2 u
const LIST_X = 184    // layer padding 14 u + list padding 9 u
const GROW = ICON * 0.2

const clip = squircleClip(ICON, ICON, 32)
const ring = squircleRing(ICON, ICON, 32)
const NH = `${TV}/com.samsung.tv.coba.newhome`
const VD = `${TV}/VD_ICONS`

export const EDIT_TOOLTIP = 'List Edit'   // TV_SID_HOME_CBAUG_LIST_EIDT

type Props = {
  items: LauncherItem[]
  focus: number          // 0..items.length-1 apps, items.length = Edit
  current: boolean       // the row has the page focus (the tile keeps 1.2x while the sidebar is open)
  focused: boolean       // remote focus on the focused tile (ring, shadow, tooltip)
}

export function LauncherRow({ items, focus, current, focused }: Props) {
  const n = items.length
  const x = (i: number) => LIST_X + i * PITCH + (current && i > focus ? GROW : 0)
  return (
    <div className="lr">
      {items.map((it, i) => {
        const cur = current && i === focus
        return (
          <div
            key={it.id}
            className={`lr-tile ${cur ? 'is-current' : ''} ${cur && focused ? 'is-focused' : ''}`}
            style={{ left: x(i) }}
          >
            <div className={`lr-tile__shape lr-tile__shape--${it.kind}`} style={{ clipPath: clip }}>
              {it.kind === 'webapp' ? (
                <img src={stubArt(it.app.id, ICON, ICON, { label: it.app.name, size: 15 })} alt="" />
              ) : (
                <>
                  <img
                    className="lr-tile__icon"
                    src={`${VD}/${it.kind === 'livetv' ? 'i_icon_device_m_tv.svg' : 'i_icon_device_m_cablebox.svg'}`}
                    alt=""
                  />
                  <div className="lr-tile__title">{it.title}</div>
                </>
              )}
            </div>
            <div className="lr-tile__ring" style={{ backgroundImage: ring }} />
          </div>
        )
      })}
      {n > 0 && (
        <div
          className={`lr-edit ${current && focus === n ? 'is-current' : ''} ${current && focused && focus === n ? 'is-focused' : ''}`}
          style={{ left: x(n) }}
        >
          <div className="lr-edit__plate">
            <span className="lr-edit__icon" style={{ maskImage: `url(${NH}/home_i_icon_app_edit.svg)`, WebkitMaskImage: `url(${NH}/home_i_icon_app_edit.svg)` }} />
          </div>
          {current && focused && focus === n && <div className="lr-tooltip">{EDIT_TOOLTIP}</div>}
        </div>
      )}
    </div>
  )
}
