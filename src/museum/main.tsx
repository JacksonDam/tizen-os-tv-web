import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Lobby } from './Lobby'
import './lobby.css'

// Links from before the museum opened pointed at the 2025 TV with its URL options: forward them.
const LEGACY = ['setup', 'sub', 'boot', 'remote', 'scanspeed', 'timerspeed']
const q = new URLSearchParams(location.search)
if (LEGACY.some(k => q.has(k))) {
  location.replace(`${import.meta.env.BASE_URL}2025/${location.search}`)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Lobby />
    </StrictMode>,
  )
}
