import { IMG, PANELS } from './data'

// The default-panel page every panel shows while Smart Hub is in its default configuration (no server
// panel list, Smart Hub terms not agreed): CHomePanelWindowBase::InitializeDefaultPanel @02bc0d44, with
// the per-panel title, text, image and button label set by each panel's m_InitializeDefaultPanel.
// Coordinates are panel-local OSD px (the panel's 2D root is at -960,-540 of the panel object, so they
// equal screen px for the centre panel). Texts use CHomeWindowManager::GetFont() = font 0 = shadow_eu.ttf
// (Samsung SVD Medium).
export function PromoPanel({ type, focused }: { type: number; focused: boolean }) {
  const p = PANELS[type]
  return (
    <div className="sh-promo">
      {/* title: 40,172 1840x96, size 62, alignment (1,4) = centre/middle, per-panel colour */}
      <div className="sh-promo__title" style={{ color: p.promoColor }}>{p.promoTitle}</div>
      {/* description: 40,268 1840x116, size 36, multi-line with a 12 px row gap, alignment (1,3) = centre/top */}
      <div className="sh-promo__text">{p.promoText}</div>
      {/* the 525x302 miniature in a 788x453 box at 566,402 and network_shadow.PNG in 1300x47 at 310,823
          (both drawings stretch the image to their size, inferred from the box sizes being 1.5x) */}
      <img className="sh-promo__shadow" src={`${IMG}/img/network_shadow.PNG`} alt="" />
      <img className="sh-promo__image" src={`${IMG}/${p.promoImage}`} alt="" />
      {/* button: 666,902 588x156, label size 40; home_net_btn_sel.png and white text when focused,
          home_net_btn_nor.png and black text otherwise */}
      <div className={`sh-promo__btn${focused ? ' sh-promo__btn--focus' : ''}`}>
        <img src={`${IMG}/home_net_btn_${focused ? 'sel' : 'nor'}.png`} alt="" />
        <span>{p.promoButton}</span>
      </div>
    </div>
  )
}
