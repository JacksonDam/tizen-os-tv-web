import { useEffect, useRef } from 'react'
import './marquee.css'

// FLUX TextBox overflow: end-ellipsis at rest; while `run` is set (focused, OverflowOption 4/5) text wider
// than its box auto-scrolls like DALi AutoScroll: 1 s pause, then 80 px/s to the left with a 50 px gap
// before the repeated copy, looping (spec/flux.md 3.6).
const SPEED = 80
const GAP = 50
const DELAY = 1000

type Props = { text: string; run: boolean; className?: string }

export function Marquee({ text, run, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = box.current
    const tr = track.current
    if (!run || !el || !tr) return
    const width = (tr.firstElementChild as HTMLElement).offsetWidth
    if (width <= el.clientWidth) return
    el.classList.add('is-scrolling')
    const dist = width + GAP
    const total = DELAY + (dist / SPEED) * 1000
    const anim = tr.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: DELAY / total },
        { transform: `translateX(${-dist}px)`, offset: 1 },
      ],
      { duration: total, iterations: Infinity },
    )
    return () => {
      anim.cancel()
      el.classList.remove('is-scrolling')
    }
  }, [run, text])

  return (
    <div ref={box} className={`marquee ${className}`}>
      <span ref={track} className="marquee__track">
        <span>{text}</span>
        <span className="marquee__copy" aria-hidden>{text}</span>
      </span>
    </div>
  )
}
