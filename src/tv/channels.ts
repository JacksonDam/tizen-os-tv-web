// Mocked tuner lineup and programme guide (spec2/channels.md 2.12): an EU Air (DVB-T2) scan finds
// 6 multiplexes with 28 TV (10 HD), 8 radio and 2 data services. Names are fictional. TV channels are
// mapped onto the stand-in video loops in public/video; radio and data services have no picture.

export type ChannelKind = 'tv' | 'radio' | 'data'

export type Channel = {
  number: number            // LCN shown in the list
  name: string
  kind: ChannelKind
  hd: boolean               // HD flag (the channel list row draws no badge)
  delivery: 'DTV' | 'ATV' | 'Radio' | 'Data'
  video: string             // stand-in loop in public/video ('' = no picture)
  genre: string             // EPG category (icon name epg_i_icon_category_<genre>)
  rf?: number               // UHF channel of its multiplex
  freqMHz?: number          // centre frequency (306 + 8 * rf)
}

const LOOPS = ['loop-gradients.mp4', 'loop-clouds.mp4']

type Slot = [title: string, start: string, end: string]
type Service = [number: number, name: string, kind: ChannelKind, hd: boolean, genre: string, now: Slot, next: Slot]

// Order inside a multiplex = the order the scan finds the services.
export const MUXES: { rf: number; services: Service[] }[] = [
  { rf: 22, services: [   // Mux A, DVB-T2
    [1, 'Aurora One HD', 'tv', true, 'Entertainment', ['Morning Live', '09:00', '10:00'], ['Bargain Hunters', '10:00', '11:00']],
    [2, 'Aurora Two HD', 'tv', true, 'Documentary', ['Coastal Railways', '09:00', '09:30'], ["The Potter's Wheel", '09:30', '10:30']],
    [3, 'Vista HD', 'tv', true, 'Entertainment', ['Good Day Show', '08:30', '10:30'], ['Kitchen Duel', '10:30', '11:30']],
    [4, 'Northstar HD', 'tv', true, 'Drama', ['Harbour Lights', '09:15', '10:15'], ['The Long Field', '10:15', '11:15']],
    [5, 'Harbour News HD', 'tv', true, 'News&Opinion', ['News at Nine', '09:00', '10:00'], ['Business Today', '10:00', '10:30']],
    [6, 'Lumen HD', 'tv', true, 'Movies', ['The Glass Orchard', '08:45', '10:40'], ['Night Ferry', '10:40', '12:30']],
    [101, 'Aurora Radio 1', 'radio', false, 'Music', ['Breakfast Mix', '07:00', '10:00'], ['Midday Tunes', '10:00', '13:00']],
    [102, 'Aurora Radio 2', 'radio', false, 'Music', ['Easy Mornings', '08:00', '10:00'], ['Story Hour', '10:00', '11:00']],
  ] },
  { rf: 26, services: [   // Mux B
    [7, 'Kestrel Kids', 'tv', false, 'Kids', ['Paper Planes', '09:00', '09:25'], ['Robo Pals', '09:25', '09:50']],
    [8, 'Kestrel Junior', 'tv', false, 'Kids', ['Puddle Jumpers', '09:00', '09:15'], ['Sleepy Bear', '09:15', '09:30']],
    [9, 'Cinema Vault', 'tv', false, 'Movies', ['Desert Crossing', '08:30', '10:20'], ['The Clockmaker', '10:20', '12:10']],
    [10, 'Retro Classics', 'tv', false, 'Comedy', ['Corner Shop', '09:00', '09:30'], ['Corner Shop', '09:30', '10:00']],
    [11, 'Quiz Arena', 'tv', false, 'Game shows', ['Five in a Row', '09:00', '10:00'], ['Top Answer', '10:00', '11:00']],
    [103, 'Coastline Radio', 'radio', false, 'Music', ['Coast to Coast', '06:00', '10:00'], ['Request Hour', '10:00', '11:00']],
    [200, 'Aurora Interactive', 'data', false, 'Interactive & ambient', ['Interactive Service', '00:00', '23:59'], ['Interactive Service', '00:00', '23:59']],
  ] },
  { rf: 29, services: [   // Mux C
    [12, 'Sport Pulse', 'tv', false, 'Sports', ['Match Highlights', '09:00', '10:00'], ['Cycling: Stage 4', '10:00', '13:00']],
    [13, 'Nature Trails', 'tv', false, 'Natural History', ['River Otters', '09:00', '10:00'], ['Life on the Reef', '10:00', '11:00']],
    [14, 'Past Times TV', 'tv', false, 'Documentary', ['Lost Castles', '09:00', '10:00'], ['Empires of Salt', '10:00', '11:00']],
    [15, 'Cookery Lane', 'tv', false, 'Food & Drink', ['One Pan Suppers', '09:00', '09:30'], ['Bake It Simple', '09:30', '10:00']],
    [16, 'Motor Max', 'tv', false, 'Motoring', ['Garage Rescue', '09:00', '10:00'], ['Road Test', '10:00', '10:30']],
    [17, 'Comedy Corner', 'tv', false, 'Comedy', ['Flatmates', '09:00', '09:30'], ['Open Mic Night', '09:30', '10:30']],
  ] },
  { rf: 34, services: [   // Mux D, DVB-T2
    [18, 'Sport Pulse HD', 'tv', true, 'Sports', ['Tennis: Quarter-finals', '09:00', '12:00'], ['Sports Desk', '12:00', '12:30']],
    [19, 'Lumen Two HD', 'tv', true, 'Movies', ['Summer at Elm Lake', '09:10', '10:50'], ['The Signal', '10:50', '12:40']],
    [20, 'Docu Sphere HD', 'tv', true, 'Science&Nature', ['Inside the Volcano', '09:00', '10:00'], ['Tiny Machines', '10:00', '11:00']],
    [21, 'Northstar Plus HD', 'tv', true, 'Drama', ['Harbour Lights', '10:15', '11:15'], ['The Long Field', '11:15', '12:15']],
    [104, 'Jazz Lounge Radio', 'radio', false, 'Music', ['Blue Notes', '08:00', '11:00'], ['Swing Time', '11:00', '13:00']],
    [105, 'Concert Hall Radio', 'radio', false, 'Music', ['Morning Symphony', '09:00', '11:00'], ['Chamber Hour', '11:00', '12:00']],
  ] },
  { rf: 40, services: [   // Mux E
    [22, 'Crime Files', 'tv', false, 'Crime', ['Cold Case Unit', '09:00', '10:00'], ['Evidence', '10:00', '11:00']],
    [23, 'Reality Street', 'tv', false, 'Reality', ['House Swap', '09:00', '10:00'], ['Island Life', '10:00', '11:00']],
    [24, 'Tune Wave TV', 'tv', false, 'Music', ['Chart Countdown', '09:00', '11:00'], ['Live Sessions', '11:00', '12:00']],
    [25, 'Home Makeover TV', 'tv', false, 'Lifestyle', ['Small Space Fixes', '09:00', '09:30'], ['Garden Rescue', '09:30', '10:30']],
    [26, 'Market Hall 24', 'tv', false, 'Lifestyle', ['Home and Kitchen', '09:00', '10:00'], ['Jewellery Showcase', '10:00', '11:00']],
    [106, 'Retro Hits Radio', 'radio', false, 'Music', ['Golden Hour', '09:00', '12:00'], ['Lunchtime Classics', '12:00', '14:00']],
    [107, 'Talk Hour Radio', 'radio', false, 'News&Opinion', ['The Morning Phone-in', '09:00', '11:00'], ['Midday News', '11:00', '11:30']],
    [108, 'Nightfall Radio', 'radio', false, 'Music', ['Ambient Morning', '06:00', '10:00'], ['Slow Grooves', '10:00', '14:00']],
  ] },
  { rf: 47, services: [   // Mux F, local
    [27, 'Riverside Local', 'tv', false, 'News&Opinion', ['Riverside Today', '09:00', '09:30'], ['Town Hall Live', '09:30', '10:30']],
    [28, 'Riverside Weather', 'tv', false, 'News&Opinion', ['Weather Watch', '09:00', '09:15'], ['Weather Watch', '09:15', '09:30']],
    [201, 'Riverside Info', 'data', false, 'Interactive & ambient', ['Information Service', '00:00', '23:59'], ['Information Service', '00:00', '23:59']],
  ] },
]

const DELIVERY = { tv: 'DTV', radio: 'Radio', data: 'Data' } as const

function toChannel([number, name, kind, hd, genre]: Service, rf: number): Channel {
  const video = kind === 'tv' ? LOOPS[number % LOOPS.length] : ''
  return { number, name, kind, hd, delivery: DELIVERY[kind], video, genre, rf, freqMHz: 306 + 8 * rf }
}

// Every service in scan order (mux by mux).
export const SCAN_LINEUP: Channel[] = MUXES.flatMap(m => m.services.map(s => toChannel(s, m.rf)))

// Stored lineup order: navigation order = lowest number first (the channel list's "All").
export function sortLineup(chs: Channel[]): Channel[] {
  return [...chs].sort((a, b) => a.number - b.number)
}

// The TV starts with the full Air scan stored.
export const DEFAULT_LINEUP: Channel[] = sortLineup(SCAN_LINEUP)

// ---- programme guide ----
// Each service has a "now" and a "next" programme (around 09:00-12:00 in the spec). The day repeats that
// pair from the "now" start, so the titles show at any time of day; 23:59 ends mean the whole day.

export type Programme = { title: string; start: Date; end: Date }

const GUIDE = new Map(MUXES.flatMap(m => m.services.map((s): [string, [Slot, Slot]] => [s[1], [s[5], s[6]]])))

function minutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return t === '23:59' ? 1440 : h * 60 + m
}

export function programmeAt(ch: Channel, at = new Date()): Programme {
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  const slots = GUIDE.get(ch.name)
  if (!slots) return { title: '', start: day, end: new Date(day.getTime() + 86400000) }
  const [now, next] = slots
  const anchor = minutes(now[1]) * 60000
  const d1 = (minutes(now[2]) - minutes(now[1])) * 60000
  const d2 = (minutes(next[2]) - minutes(next[1])) * 60000
  const t = at.getTime() - day.getTime() - anchor
  const k = Math.floor(t / (d1 + d2))
  const cycle = day.getTime() + anchor + k * (d1 + d2)
  return t - k * (d1 + d2) < d1
    ? { title: now[0], start: new Date(cycle), end: new Date(cycle + d1) }
    : { title: next[0], start: new Date(cycle + d1), end: new Date(cycle + d1 + d2) }
}

export function nextProgramme(ch: Channel, at = new Date()): Programme {
  return programmeAt(ch, programmeAt(ch, at).end)
}

export function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
