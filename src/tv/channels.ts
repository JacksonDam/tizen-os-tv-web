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
// Each service has a "now" and a "next" programme from the spec (around 09:00-12:00). Around that pair
// every day is filled with a deterministic schedule (seeded by channel number and date) drawn from
// genre-based title pools, so the Guide has a full grid for any day and time. "23:59" ends mean the
// service runs one programme all day (data services). Names and descriptions are fictional (inferred).

export type Programme = { title: string; start: Date; end: Date }
export type GuideProgramme = Programme & {
  id: string               // "<LCN>-<start ms>", stable across reloads (Schedule Viewing keys on it)
  genre: string            // DVB content genre as the Guide names it (epg.mo)
  desc: string             // synopsis shown in the Guide header and View Details
}

const GUIDE = new Map(MUXES.flatMap(m => m.services.map((s): [string, [Slot, Slot]] => [s[1], [s[5], s[6]]])))

function minutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return t === '23:59' ? 1440 : h * 60 + m
}

// Channel genre -> DVB content nibble text the Guide shows (SIDs in org.tizen.epg's epg.mo) (inferred mapping).
const DVB_GENRE: Record<string, string> = {
  Entertainment: 'Show/Game show',
  'Game shows': 'Show/Game show',
  Reality: 'Show/Game show',
  Documentary: 'Education/Science/Factual Topics',
  'Natural History': 'Education/Science/Factual Topics',
  'Science&Nature': 'Education/Science/Factual Topics',
  Drama: 'Movie/Drama',
  Movies: 'Movie/Drama',
  Comedy: 'Movie/Drama',
  Crime: 'Movie/Drama',
  'News&Opinion': 'News/Current affairs',
  Kids: "Children's/Youth programmes",
  Sports: 'Sports',
  Music: 'Music/Ballet/Dance',
  'Food & Drink': 'Leisure hobbies',
  Motoring: 'Leisure hobbies',
  Lifestyle: 'Leisure hobbies',
  'Interactive & ambient': 'Undefined content',
}

// Title pools and slot lengths (minutes) per channel genre (inferred; fictional titles).
const POOLS: Record<string, { titles: string[]; lengths: number[] }> = {
  Entertainment: { titles: ['Saturday Lights', 'The Big Weekend', 'Talk of the Town', 'Late Lounge', 'Home Truths', 'Star Kitchen', 'Weekend Wonders', 'The Showcase', 'Variety Hour', 'Morning Live', 'Bargain Hunters', 'Good Day Show', 'Kitchen Duel'], lengths: [30, 60, 60, 90] },
  'Game shows': { titles: ['Five in a Row', 'Top Answer', 'Lucky Streak', 'Brain Race', 'The Final Clue', 'Word Ladder', 'Pass the Prize'], lengths: [30, 30, 60] },
  Reality: { titles: ['House Swap', 'Island Life', 'Moving Day', 'The Renovators', 'Camp Survive', 'First Dates Abroad'], lengths: [30, 60, 60] },
  Documentary: { titles: ['Coastal Railways', "The Potter's Wheel", 'Lost Castles', 'Empires of Salt', 'Hidden Cities', 'The Map Makers', 'Bridges of the North', 'Secret Gardens', 'Rivers of Stone'], lengths: [30, 60, 60] },
  'Natural History': { titles: ['River Otters', 'Life on the Reef', 'Wild Meadows', 'Night Hunters', 'The Great Migration', 'Penguin Shores', 'Forest Giants'], lengths: [30, 60] },
  'Science&Nature': { titles: ['Inside the Volcano', 'Tiny Machines', 'Deep Ocean', 'Starlight', 'How Things Work', 'The Weather Lab', 'Planet Patterns'], lengths: [30, 60] },
  Drama: { titles: ['Harbour Lights', 'The Long Field', 'Northern Shore', 'Quiet Street', 'The Ward', 'Second Chances', 'Glass Houses', 'Farewell Station'], lengths: [60, 60, 90] },
  Movies: { titles: ['The Glass Orchard', 'Night Ferry', 'Desert Crossing', 'The Clockmaker', 'Summer at Elm Lake', 'The Signal', 'Paper Moon Road', 'The Last Lighthouse', 'Winter Garden', 'Silver Arrow'], lengths: [90, 105, 120] },
  Comedy: { titles: ['Corner Shop', 'Flatmates', 'Open Mic Night', 'Office Hours', 'The In-Laws', 'Bus Route 9', 'Family Matters'], lengths: [30, 30, 60] },
  Crime: { titles: ['Cold Case Unit', 'Evidence', 'Forensic Files', 'The Inspector', 'Night Patrol', 'Unsolved'], lengths: [60, 60, 90] },
  'News&Opinion': { titles: ['News', 'Business Today', 'World Report', 'The Briefing', 'Weather Watch', 'Evening Edition', 'Riverside Today', 'Town Hall Live', 'News at Nine'], lengths: [15, 30, 30, 60] },
  Kids: { titles: ['Paper Planes', 'Robo Pals', 'Puddle Jumpers', 'Sleepy Bear', 'Colour Town', 'Space Pups', 'Story Time', 'Little Builders'], lengths: [10, 15, 25, 30] },
  Sports: { titles: ['Match Highlights', 'Cycling: Stage 4', 'Tennis: Quarter-finals', 'Sports Desk', 'Football Tonight', 'Golf Round-up', 'Motor Racing: Qualifying', 'Athletics Live'], lengths: [30, 60, 120, 180] },
  Music: { titles: ['Chart Countdown', 'Live Sessions', 'Breakfast Mix', 'Midday Tunes', 'Request Hour', 'Blue Notes', 'Swing Time', 'Golden Hour', 'Slow Grooves', 'Night Shift'], lengths: [60, 120, 180] },
  'Food & Drink': { titles: ['One Pan Suppers', 'Bake It Simple', 'Market to Table', 'Spice Route', 'Sunday Roast', 'Street Food Stories'], lengths: [30, 30, 60] },
  Motoring: { titles: ['Garage Rescue', 'Road Test', 'Classic Cars', 'Rally Diaries', 'Car Clinic'], lengths: [30, 60] },
  Lifestyle: { titles: ['Small Space Fixes', 'Garden Rescue', 'Home and Kitchen', 'Jewellery Showcase', 'Style Swap', 'Weekend DIY'], lengths: [30, 60, 60] },
  'Interactive & ambient': { titles: ['Interactive Service'], lengths: [1440] },
}

// Synopses by genre; {t} is the programme title (inferred, fictional).
const DESCS: Record<string, string[]> = {
  'Show/Game show': ['{t} brings studio guests, live music and audience surprises to the end of the week.', 'Contestants put their nerve and general knowledge to the test in {t}, with a cash prize for the last player standing.', 'Bright faces and big laughs as {t} visits viewers at home across the region.'],
  'Education/Science/Factual Topics': ['{t} follows the people, places and ideas that shaped the region, with archive film and new interviews.', 'A closer look at how the natural world works. {t} uses slow motion and macro cameras to reveal the detail.', 'Experts take {t} behind the scenes and explain the science in plain language.'],
  'Movie/Drama': ['{t}: a quiet town is turned upside down when an old friend returns with a secret.', 'In {t}, two strangers meet on a late train and set off a chain of events neither can stop.', 'Loyalties are tested in {t} as the family business faces its hardest season yet.'],
  'News/Current affairs': ['{t}: the latest national and international news, sport and weather.', 'Headlines, interviews and analysis of the stories that matter today in {t}.'],
  "Children's/Youth programmes": ['{t}: songs, colours and gentle adventures for younger viewers.', 'The friends from {t} solve a new puzzle together in this episode.'],
  Sports: ['{t}: live coverage with expert commentary and the key moments replayed.', 'All the goals, points and talking points from the day in {t}.'],
  'Music/Ballet/Dance': ['{t}: an hour of favourite tracks and new releases, with requests from listeners.', 'Relaxed music and conversation in {t}.'],
  'Leisure hobbies': ['{t} shares simple ideas you can try at home this weekend.', 'Hands-on tips and honest advice in {t}.'],
  'Undefined content': ['Interactive information service.'],
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function makeProgramme(ch: Channel, title: string, start: number, end: number): GuideProgramme {
  const genre = DVB_GENRE[ch.genre] ?? 'Undefined content'
  const pool = DESCS[genre] ?? DESCS['Undefined content']
  const desc = pool[hash(title) % pool.length].replace('{t}', title)
  return { id: `${ch.number}-${start}`, title, start: new Date(start), end: new Date(end), genre, desc }
}

const dayCache = new Map<string, GuideProgramme[]>()

// One local day (00:00-24:00) of a channel's schedule.
function daySchedule(ch: Channel, day: Date): GuideProgramme[] {
  const d0 = new Date(day)
  d0.setHours(0, 0, 0, 0)
  const key = `${ch.number}:${d0.getTime()}`
  const hit = dayCache.get(key)
  if (hit) return hit
  const d1 = new Date(d0)
  d1.setDate(d1.getDate() + 1)
  const dayStart = d0.getTime()
  const dayLen = d1.getTime() - dayStart        // 23-25 h on DST days
  const pool = POOLS[ch.genre] ?? POOLS.Entertainment
  const rand = rng(hash(key))
  const out: GuideProgramme[] = []
  let last = ''
  const fill = (from: number, to: number) => {
    let t = from
    while (t < to) {
      let len = pool.lengths[Math.floor(rand() * pool.lengths.length)] * 60000
      if (t + len > to) len = to - t
      if (len < 10 * 60000 && out.length && out[out.length - 1].end.getTime() === t) {
        const prev = out.pop()!
        out.push(makeProgramme(ch, prev.title, prev.start.getTime(), t + len))
      } else {
        let title = pool.titles[Math.floor(rand() * pool.titles.length)]
        if (title === last && pool.titles.length > 1) title = pool.titles[(pool.titles.indexOf(title) + 1) % pool.titles.length]
        last = title
        out.push(makeProgramme(ch, title, t, t + len))
      }
      t += len
    }
  }
  const slots = GUIDE.get(ch.name)
  if (!slots) fill(dayStart, dayStart + dayLen)
  else {
    const [now, next] = slots
    const a = dayStart + minutes(now[1]) * 60000
    const b = dayStart + minutes(now[2]) * 60000
    const c = Math.min(dayStart + dayLen, dayStart + minutes(next[2]) * 60000)
    if (minutes(now[2]) >= 1440) out.push(makeProgramme(ch, now[0], dayStart, dayStart + dayLen))
    else {
      fill(dayStart, a)
      out.push(makeProgramme(ch, now[0], a, b))
      if (c > b) out.push(makeProgramme(ch, next[0], b, c))
      last = next[0]
      fill(c, dayStart + dayLen)
    }
  }
  if (dayCache.size > 400) dayCache.clear()
  dayCache.set(key, out)
  return out
}

// The programme on air on a channel at a time.
export function programmeAt(ch: Channel, at = new Date()): GuideProgramme {
  const day = daySchedule(ch, at)
  const t = at.getTime()
  return day.find(p => p.start.getTime() <= t && t < p.end.getTime()) ?? day[day.length - 1]
}

export function nextProgramme(ch: Channel, at = new Date()): GuideProgramme {
  return programmeAt(ch, programmeAt(ch, at).end)
}

// Every programme overlapping [from, to), in order.
export function programmesBetween(ch: Channel, from: Date, to: Date): GuideProgramme[] {
  const out: GuideProgramme[] = []
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  while (d.getTime() < to.getTime()) {
    for (const p of daySchedule(ch, d)) {
      if (p.end.getTime() > from.getTime() && p.start.getTime() < to.getTime()) out.push(p)
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
