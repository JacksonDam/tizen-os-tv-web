import { useState } from 'react'
import type { AppProps } from '../../../../shell'
import { PANELS } from '../../data'
import { getOnlinePanel } from '../../panels'

// Development harness only (not registered in production builds): draws one online panel body full
// screen over its panel background, with the keys, as the carousel will once it hosts the bodies.
export function HubTest({ params, close }: AppProps) {
  const panel = (params as { panel?: number } | undefined)?.panel ?? 3
  const Body = getOnlinePanel(panel)
  const [active, setActive] = useState(true)
  const bg = PANELS[panel]?.bg
  const rgb = (c: number[]) => `rgb(${c.map(Math.round).join(',')})`
  if (!Body) return null
  return (
    <div style={{ position: 'absolute', inset: 0, background: bg ? `linear-gradient(${rgb(bg[0])}, ${rgb(bg[1])})` : '#000' }}>
      <Body active={active} width={1920} height={1080} exitUp={() => { setActive(false); setTimeout(close, 300) }} exitDown={() => setActive(false)} />
    </div>
  )
}
