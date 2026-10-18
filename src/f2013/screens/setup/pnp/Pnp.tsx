import { useState } from 'react'
import type { AppProps } from '../../../shell'
import { WelcomeMovie } from './WelcomeMovie'
import './pnp.css'

// Plug & Play (first-time setup): the welcome movie, then the wizard pages.
export function Pnp(_props: AppProps) {
  const [movie, setMovie] = useState(true)
  return (
    <div className="pnp">
      {movie ? <WelcomeMovie onEnd={() => setMovie(false)} /> : <div className="pnp-bg" />}
    </div>
  )
}
