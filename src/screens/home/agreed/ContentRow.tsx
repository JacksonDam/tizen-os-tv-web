import type { ContentRow as Row } from '../serverContent'

// A server content row (here the stub continue-watching and recommendation rows). The layer style is the
// server's choice; the stub rows use smallcontent02 (MediaContentLineDetail with HOME_SIMPLIFY): a 7 u
// layer title (T32, 0.8x while the row is unfocused), 1 u list top padding, 56 x 32 u ImagePreview tiles
// 5 u apart, focused scale 1.1 with the 32 px tile ring and SHADOW_01, focus "fixed" (the focused tile
// scrolls to the list start), the "onlytitle" description (the focused title, T24, under the row) and
// scroll offset 30 u. The continue-watching progress bar uses the PIG info bar (4 px, track 20% white,
// fill #33ADFF; inferred for this row).

const LIST_X = 184
const TILE_W = 448
const PITCH = TILE_W + 40

type Props = { row: Row; item: number; current: boolean; focused: boolean }

export function ContentRow({ row, item, current, focused }: Props) {
  const scroll = -item * PITCH
  return (
    <>
      <div className={`group-title cr-title ${current ? 'is-current' : ''} ${focused ? 'is-focused' : ''}`}>{row.title}</div>
      <div className="np-clip">
        <div className="np-track cr-track" style={{ transform: `translateX(${scroll}px)` }}>
          {row.items.map((it, i) => (
            <div
              key={it.id}
              className={`np-card cr-card ${current && i === item ? 'is-current' : ''} ${focused && i === item ? 'is-focused' : ''}`}
              style={{ left: LIST_X + i * PITCH, width: TILE_W }}
            >
              <img src={it.art} alt="" />
              {it.progress !== undefined && (
                <div className="cr-progress">
                  <div style={{ width: `${it.progress * 100}%` }} />
                </div>
              )}
              <div className="flux-focus-ring" />
            </div>
          ))}
        </div>
      </div>
      <div className={`np-desc cr-desc ${current ? 'is-shown' : ''}`}>{row.items[item]?.title.title}</div>
    </>
  )
}
