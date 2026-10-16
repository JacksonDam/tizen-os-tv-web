// One row of FLUX PIN boxes (CPin1Line.CreatePinBox / CPin2Line.CreatePinBox): 7 x 7 u (56 px) RoundRect
// plates (r 16 px) in CP_PlaneInputfield, 1 u (8 px) apart, inner shadow on. The box that takes the next
// digit is Focused (white, scale 1.08) while the line has the focus; an entered digit shows the
// i_img_asterisk Lottie (16 x 16, black star scaling in over 19 frames at 60 fps).

type Props = {
  count: number       // boxes in the row (4)
  filled: number      // digits entered
  focused: boolean    // the line has the focus: the box at `filled` is Focused
}

// i_img_asterisk.json "i_img_asterisk Outlines" path, anchored at (8, 8).
const ASTERISK =
  'M9.5 8.7L12.4 12.3L10.5 13.8L8 9.9L5.5 13.8L3.6 12.3L6.5 8.7L2 7.5L2.8 5.2L7 6.8L6.8 2.2L9.2 2.2L9 6.8L13.3 5.2L14 7.5Z'

export function PinBoxes({ count, filled, focused }: Props) {
  return (
    <div className="pin-boxes">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`pin-box ${focused && i === Math.min(filled, count - 1) ? 'is-focused' : ''}`}>
          {i < filled && (
            <svg className="pin-box__asterisk" viewBox="0 0 16 16" width={16} height={16} aria-hidden>
              <path d={ASTERISK} />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}
