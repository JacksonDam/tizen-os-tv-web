import { pictureFilter } from './ui/options'
import { pictureOf, sltvImage, useSltv } from './ui/sltv'

// The Settings assistant's pictures on the video plane (its image players, ui/sltv.ts): the welcome,
// sound and finish pictures full screen (display record 3), the picture steps split at the middle,
// the A candidate's picture with its settings on the left half (display 1) and the B candidate's on
// the right half (display 2). Each half shows its own half of the 1366x768 picture (the players'
// windows crop rather than squeeze it: inferred from the dividing line at the middle and Level4.jpg,
// whose halves are already graded apart). The settings tint the picture through the same filters as
// the TV picture (LiveTv); a lower sharpness softens it (inferred).

function style(n: Parameters<typeof pictureOf>[0]) {
  const p = pictureOf(n)
  const blur = p.sharpness < 5 ? ` blur(${(5 - p.sharpness) * 0.3}px)` : ''
  return pictureFilter(p.contrast, p.brightness, p.colour) + blur
}

export function SltvPicture() {
  const v = useSltv()
  if (!v) return null
  if (v.section < 0 || !v.left) return <div className="ph-sltv" />
  if (v.section === 1 && v.right) {
    return (
      <div className="ph-sltv">
        <img className="ph-sltv-pic ph-sltv-a" src={sltvImage(v.left)} style={{ filter: style(v.left.params) }} alt="" />
        <img className="ph-sltv-pic ph-sltv-b" src={sltvImage(v.right)} style={{ filter: style(v.right.params) }} alt="" />
      </div>
    )
  }
  return (
    <div className="ph-sltv">
      <img className="ph-sltv-pic" src={sltvImage(v.left)} style={{ filter: style(v.left.params) }} alt="" />
    </div>
  )
}
