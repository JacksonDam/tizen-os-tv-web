import { useEffect, useRef, useState } from 'react'

// The museum lobby: one card per exhibit (a TV generation), oldest first. Arrow keys move between
// cards and Enter opens one, so a TV remote or keyboard works as well as a pointer.

type Exhibit = { year: number; name: string; detail: string; href: string; image: string }

const BASE = import.meta.env.BASE_URL

const EXHIBITS: Exhibit[] = [
  {
    year: 2013,
    name: 'Smart Hub',
    detail: 'F series (UE40F6400), software T-MST12DEUC 2130.0',
    href: `${BASE}2013/`,
    image: `${BASE}museum/2013.jpg`,
  },
  {
    year: 2025,
    name: 'Tizen 9',
    detail: 'Neo QLED, software T-RSMFDEUC 0090',
    href: `${BASE}2025/`,
    image: `${BASE}museum/2025.jpg`,
  },
]

// Hidden exhibit: a Philips TV, not listed as a card. Holding the P key for about a second opens it.
const EGG_HOLD_MS = 1000

export function Lobby() {
  const [focus, setFocus] = useState(EXHIBITS.length - 1)
  const [charge, setCharge] = useState(0) // 0..1 while the P key is held
  const cards = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setFocus(f => Math.min(EXHIBITS.length - 1, f + 1))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setFocus(f => Math.max(0, f - 1))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Hold-to-open: ramp a charge from 0 to 1 while P is down; at full charge, go to the Philips page.
  useEffect(() => {
    let raf = 0
    let start = 0
    let opened = false
    const tick = (t: number) => {
      if (!start) start = t
      const c = Math.min(1, (t - start) / EGG_HOLD_MS)
      setCharge(c)
      if (c >= 1) {
        if (!opened) {
          opened = true
          location.href = `${BASE}philips/`
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    const onDown = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === 'P') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        start = 0
        raf = requestAnimationFrame(tick)
      }
    }
    const reset = (e?: KeyboardEvent) => {
      if (e && e.key !== 'p' && e.key !== 'P') return
      cancelAnimationFrame(raf)
      if (!opened) setCharge(0)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', reset)
    window.addEventListener('blur', () => reset())
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', reset)
    }
  }, [])

  useEffect(() => {
    cards.current[focus]?.focus()
  }, [focus])

  return (
    <main className="lobby">
      <header className="lobby__head">
        <h1>Samsung TV interface museum</h1>
        <p>Working recreations of Samsung Smart TV software, rebuilt from the TVs' own firmware.</p>
      </header>
      <div className="lobby__row">
        {EXHIBITS.map((x, i) => (
          <a
            key={x.year}
            ref={el => { cards.current[i] = el }}
            className="lobby__card"
            href={x.href}
            onFocus={() => setFocus(i)}
          >
            <img src={x.image} alt="" />
            <span className="lobby__year">{x.year}</span>
            <span className="lobby__name">{x.name}</span>
            <span className="lobby__detail">{x.detail}</span>
          </a>
        ))}
      </div>
      <footer className="lobby__foot">
        Unofficial recreation, not affiliated with Samsung.{' '}
        <a href="https://github.com/JacksonDam/tizen-os-tv-web">Source on GitHub</a>
      </footer>
      {charge > 0 && (
        <div className="lobby__charge" aria-hidden>
          <div className="lobby__charge-fill" style={{ transform: `scaleX(${charge})` }} />
        </div>
      )}
    </main>
  )
}
