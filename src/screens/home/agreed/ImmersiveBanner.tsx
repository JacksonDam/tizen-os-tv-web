import { useEffect, useLayoutEffect, useRef } from 'react'
import { TV } from '../../../assets'
import { Lottie } from '../../../components/Lottie'
import type { Promo } from '../serverContent'

// Row 1 of the agreed home: d/topbanner as the immersive banner (CompTopBanner.UpdateTopBannerType ->
// Immersive once the terms are agreed; CompTopBannerElement layer_type topimmersivebanner, style
// topbanner03 = MediaTopBannerLineDetail01's 240 x 43 u), drawn by TopImmersiveBannerLayerView.
//
// Its slots are the server's banners (here the stub promotions), each a TopBannerImmersiveView: a
// full-window picture (240 x 135 u) lifted by mediaPositionY -35 u so its band y 280-624 shows behind the
// banner and the tab row, the left gradient (48 x 135 u), the page-colour dim from y 67 u (536 px) and a
// "Watch Now" button (43 x 9 u, right padding 20 u) at y 38 u (VPTopBannerImmersiveView). Without server
// banners (offline) the layer keeps its own tile d/topbanner.default, a TopBannerImageView with
// home_i_banner_default.svg, "Explore your favorite content quickly and easily" (T60 200) and
// "Everything you want is here..." (T28 400) centred under a 10 u top padding; it has no button and
// cannot take the focus (VPTopBannerImageView; CompTopBannerDefaultTileElement; ResourceTopBanner).
//
// Focus "spreads" the banner (SpreadBannerView -> PlayMorphing): the row morphs to the full window so the
// rows below are pushed off screen, the picture slides to y 0 in 250 ms (basic curve), the dim hides, the
// button moves to y 108 u and fades in at 300-500 ms with the down-arrow indicator (i_icon_arrow_s,
// rotated 270 degrees, bottom padding 3 u), and the slot's video plays. Unfocusing reverses it.
// Moving between slots (every 5 s while the tab has the focus, or Left/Right while spread) slides the new
// slot in from +-5 u with opacity 0 -> 1 in 300 ms while the old one moves 5 u and fades out in 200 ms
// (PlayMoveAnimation, 500 ms basic). Pagination dots (i_img_pagination_nf, 4 u, 2 + 4n u wide) sit
// centred on x 197 u at y 48 u, at y 116 u while spread, fading in 300-500 ms after either change.

const NH = `${TV}/com.samsung.tv.coba.newhome`
const CS = `${TV}/com.samsung.tv.csfs`
const FLUX = `${TV}/flux`
const VIDEO = `${import.meta.env.BASE_URL}video/`
const BASIC = 'cubic-bezier(0.3, 0, 0.15, 1)'
export const MOVE_SLOT_MS = 5000 // moveSlotDefaultInterval

export const DEFAULT_TITLE = 'Explore your favorite content quickly and easily'   // TV_SID_HOME_CBNOV_EXPLORE_FAVORITE_CONTENT_QUICKLY_EASILY
export const DEFAULT_SUBTITLE =
  'Everything you want is here – enjoy a range of apps and content with Smart Hub.'  // TV_SID_HOME_CBNOV_EVERYTHING_HERE_ENJOY_MSG
export const WATCH_NOW = 'Watch Now' // CompTopBannerImmersiveTileElement button_text

type Props = {
  promos: Promo[]      // server banners; empty -> the default tile
  index: number        // current slot
  dir: 1 | -1          // direction of the last move
  spread: boolean      // the banner has the focus
}

export function ImmersiveBanner({ promos, index, dir, spread }: Props) {
  if (!promos.length) return <DefaultTile />
  return (
    <>
      {promos.map((p, i) => (
        <Slot key={p.id} promo={p} current={i === index} dir={dir} spread={spread && i === index} />
      ))}
      {promos.length > 1 && (
        <div key={spread ? 's' : 'u'} className={`ib-pages ${spread ? 'is-spread' : ''}`} style={{ width: (2 + 4 * promos.length) * 8 }}>
          {promos.map((p, i) => (
            <Lottie key={p.id} className="ib-pages__dot" src={`${FLUX}/i_img_pagination_nf.json`} playing={i === index} range={[0, 19]} />
          ))}
        </div>
      )}
    </>
  )
}

function DefaultTile() {
  return (
    <div className="ib-default">
      <img className="ib-default__art" src={`${NH}/home_i_banner_default.svg`} alt="" />
      <div className="ib-default__title">{DEFAULT_TITLE}</div>
      <div className="ib-default__subtitle">{DEFAULT_SUBTITLE}</div>
    </div>
  )
}

function Slot({ promo, current, dir, spread }: { promo: Promo; current: boolean; dir: 1 | -1; spread: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const was = useRef(current)
  // move animation when this slot becomes current or stops being current
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || was.current === current) return
    was.current = current
    if (current) {
      el.animate([{ translate: `${dir * 40}px 0` }, { translate: '0 0' }], { duration: 495, delay: 5, easing: BASIC, fill: 'backwards' })
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: BASIC })
    } else {
      el.animate([{ translate: '0 0' }, { translate: '40px 0' }], { duration: 500, easing: BASIC })
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: BASIC })
    }
  }, [current, dir])

  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (spread) void v.play().catch(() => {})
    else v.pause()
  }, [spread])

  return (
    <div ref={ref} className={`ib-slot ${current ? 'is-current' : ''} ${spread ? 'is-spread' : ''}`}>
      <div className="ib-slot__media">
        <img src={promo.art} alt="" />
        <video ref={video} className="ib-slot__video" src={VIDEO + promo.title.video} muted loop playsInline preload="none" />
      </div>
      <img className="ib-slot__left" src={`${CS}/home_i_bg_banner_gradient_left_2k.webp`} alt="" />
      <img className="ib-slot__bottom" src={`${CS}/home_i_bg_banner_gradient_bottom_2k.webp`} alt="" />
      <div className="ib-slot__dim" />
      <div key={spread ? 's' : 'u'} className={`flux-btn ib-slot__button ${spread ? 'is-focused' : ''}`}>{WATCH_NOW}</div>
      {spread && <Lottie className="ib-slot__arrow" src={`${FLUX}/i_icon_arrow_s.json`} />}
    </div>
  )
}
