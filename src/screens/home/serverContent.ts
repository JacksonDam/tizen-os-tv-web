import { STUB_APPS, STUB_TITLES, stubArt, type StubApp, type StubTitle } from '../../shared/fictional'

// What Samsung's servers would send the agreed, online home: the immersive banner's promotions, the
// continue-watching row (d/continuewatchrow) and the recommendation row. None of it is in the firmware,
// so it comes from the museum's fictional catalogue (src/shared/fictional.ts) with generated artwork.
// Row titles are server text too: "Recommended for You" is the firmware's own string
// (COM_TV_SID_EDEN_RECOMMENDED_FOR_YOU), "Continue Watching" is the stub's.

export type Promo = { id: string; title: StubTitle; app: StubApp; art: string }
export type ContentItem = { id: string; title: StubTitle; app: StubApp; art: string; progress?: number }
export type ContentRow = { id: string; title: string; items: ContentItem[] }

export function providerApp(t: StubTitle): StubApp {
  return STUB_APPS.find(a => a.id === t.provider) ?? STUB_APPS[0]
}

const pick = (ids: string[]) => ids.map(id => STUB_TITLES.find(t => t.id === id)!).filter(Boolean)

// Immersive banner slots: a full-window picture (240 x 135 u) with the title baked in, as the server's
// banner images are.
export const PROMOS: Promo[] = pick(['harbour-lights', 'iron-meridian', 'kite-season']).map(t => ({
  id: `promo-${t.id}`,
  title: t,
  app: providerApp(t),
  art: stubArt(`banner-${t.id}`, 1920, 1080, { label: t.title, size: 88 }),
}))

// smallcontent tiles are 56 x 32 u (448 x 256 px).
const tile = (t: StubTitle, progress?: number): ContentItem => ({
  id: t.id,
  title: t,
  app: providerApp(t),
  art: stubArt(t.id, 448, 256, { label: t.title, size: 36 }),
  progress,
})

export const CONTENT_ROWS: ContentRow[] = [
  {
    id: 'continuewatch',
    title: 'Continue Watching',
    items: [
      tile(STUB_TITLES.find(t => t.id === 'night-ferry')!, 0.62),
      tile(STUB_TITLES.find(t => t.id === 'kitchen-duel')!, 0.35),
      tile(STUB_TITLES.find(t => t.id === 'coastal-railways')!, 0.8),
      tile(STUB_TITLES.find(t => t.id === 'robo-pals')!, 0.18),
    ],
  },
  {
    id: 'recommended',
    title: 'Recommended for You',
    items: pick(['glass-orchard', 'long-field', 'desert-crossing', 'night-desk', 'paper-moon-bay', 'lost-castles',
      'clockmaker', 'echo-valley', 'cold-current', 'small-hours']).map(t => tile(t)),
  },
]
