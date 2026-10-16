// Programme sound for the stand-in sources (no firmware source: the TV plays the broadcast's audio).
// Every TV/radio channel and HDMI input gets a quiet generative music bed chosen by its EPG genre, with
// the key, tempo and melody seeded by the channel number so each channel sounds different but the same
// every time (and stays "live": the position follows wall-clock time). All of this is (inferred).

export type Inst = 'pad' | 'strings' | 'bass' | 'pluck' | 'bell' | 'epiano' | 'chip' | 'organ'

export type Style = {
  bpm: number
  scale: number[]          // semitones from the root
  prog: number[]           // chord roots as scale degrees (0-based), one per `barsPerChord`
  barsPerChord: number
  sevenths?: boolean       // add the 7th to chords
  pad?: Inst               // sustained chord
  bass?: { inst: Inst; pattern: string }   // 16 steps: 'R' root, 'F' fifth, 'O' octave, '.' rest
  arp?: { inst: Inst; every: number; octave: number; pattern?: number[] }  // chord-tone arpeggio
  melody?: { inst: Inst; density: number; octave: number }                 // seeded motif
  drums?: { kick?: string; snare?: string; hat?: string; swing?: number }  // 16 steps 'x' hit, 'o' soft
  noise?: 'wind' | 'water' | 'crowd'
  level: number            // loudness trim
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const LYDIAN = [0, 2, 4, 6, 7, 9, 11]
const MIXO = [0, 2, 4, 5, 7, 9, 10]

const GENRES: Record<string, Style> = {
  Entertainment: {
    bpm: 104, scale: MAJOR, prog: [0, 4, 5, 3], barsPerChord: 1, pad: 'pad',
    bass: { inst: 'bass', pattern: 'R..R..R.R...F...' },
    arp: { inst: 'pluck', every: 2, octave: 1 },
    drums: { kick: 'x.......x.......', hat: '..o...o...o...o.' }, level: 0.9,
  },
  Documentary: {
    bpm: 70, scale: LYDIAN, prog: [0, 1, 0, 4], barsPerChord: 2, pad: 'strings',
    melody: { inst: 'bell', density: 0.3, octave: 1 }, noise: 'wind', level: 1.8,
  },
  'Natural History': {
    bpm: 66, scale: MAJOR, prog: [0, 3, 5, 4], barsPerChord: 2, pad: 'pad',
    melody: { inst: 'bell', density: 0.25, octave: 1 }, noise: 'water', level: 2.8,
  },
  'Science&Nature': {
    bpm: 76, scale: LYDIAN, prog: [0, 4, 1, 5], barsPerChord: 2, pad: 'pad',
    arp: { inst: 'bell', every: 4, octave: 1, pattern: [0, 2, 1, 3] }, noise: 'wind', level: 2.6,
  },
  Drama: {
    bpm: 64, scale: MINOR, prog: [0, 5, 2, 6], barsPerChord: 2, pad: 'strings',
    melody: { inst: 'epiano', density: 0.35, octave: 0 }, level: 4,
  },
  'News&Opinion': {
    bpm: 96, scale: DORIAN, prog: [0, 3, 0, 4], barsPerChord: 2, pad: 'pad',
    arp: { inst: 'pluck', every: 2, octave: 0, pattern: [0, 0, 2, 0] },
    drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.' }, level: 1.5,
  },
  Movies: {
    bpm: 58, scale: MINOR, prog: [0, 5, 3, 4], barsPerChord: 2, pad: 'strings',
    bass: { inst: 'bass', pattern: 'R...............' },
    melody: { inst: 'bell', density: 0.2, octave: 1 }, level: 1.5,
  },
  Kids: {
    bpm: 120, scale: MAJOR, prog: [0, 3, 4, 0], barsPerChord: 1,
    bass: { inst: 'pluck', pattern: 'R...F...R...F...' },
    melody: { inst: 'bell', density: 0.6, octave: 1 },
    drums: { hat: 'x.o.x.o.x.o.x.o.' }, level: 2.3,
  },
  Comedy: {
    bpm: 112, scale: MIXO, prog: [0, 3, 0, 4], barsPerChord: 1,
    bass: { inst: 'pluck', pattern: 'R.F.O.F.R.F.O.F.' },
    arp: { inst: 'epiano', every: 4, octave: 1, pattern: [0, 1, 2, 1] },
    drums: { hat: '..x...x...x...x.', swing: 0.15 }, level: 1.5,
  },
  'Game shows': {
    bpm: 124, scale: MAJOR, prog: [0, 5, 3, 4], barsPerChord: 1, pad: 'pad',
    bass: { inst: 'bass', pattern: 'R.R.R.R.R.R.R.R.' },
    arp: { inst: 'pluck', every: 1, octave: 1 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' }, level: 0.6,
  },
  Sports: {
    bpm: 120, scale: MINOR, prog: [0, 6, 5, 6], barsPerChord: 2, noise: 'crowd',
    drums: { kick: 'x.......x.x.....' }, level: 2.5,
  },
  'Food & Drink': {
    bpm: 92, scale: MAJOR, prog: [1, 4, 0, 0], barsPerChord: 1, sevenths: true, pad: 'epiano',
    bass: { inst: 'bass', pattern: 'R...F...R...O...' },
    drums: { hat: 'x.ox.ox.x.ox.ox.', swing: 0.2 }, level: 1,
  },
  Motoring: {
    bpm: 100, scale: MINOR, prog: [0, 0, 5, 6], barsPerChord: 1, pad: 'pad',
    bass: { inst: 'bass', pattern: 'R.R.R.R.R.R.R.R.' },
    drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.' }, level: 0.55,
  },
}

// Radio stations: music programmes (by name, falling back to the genre).
const RADIO: Record<string, Style> = {
  'Aurora Radio 1': {
    bpm: 110, scale: MAJOR, prog: [0, 4, 5, 3], barsPerChord: 1, pad: 'pad',
    bass: { inst: 'bass', pattern: 'R..R..R.R..R..F.' },
    melody: { inst: 'pluck', density: 0.55, octave: 1 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, level: 0.75,
  },
  'Aurora Radio 2': {
    bpm: 84, scale: MAJOR, prog: [0, 3, 0, 4], barsPerChord: 1, pad: 'epiano', sevenths: true,
    bass: { inst: 'bass', pattern: 'R.......F.......' },
    melody: { inst: 'epiano', density: 0.4, octave: 1 }, level: 1.3,
  },
  'Coastline Radio': {
    bpm: 118, scale: MIXO, prog: [0, 6, 3, 0], barsPerChord: 1, pad: 'pad',
    bass: { inst: 'bass', pattern: 'R.RR..R.R.RR..F.' },
    arp: { inst: 'pluck', every: 2, octave: 1 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' }, level: 0.65,
  },
  'Jazz Lounge Radio': {
    bpm: 96, scale: DORIAN, prog: [1, 4, 0, 5], barsPerChord: 1, sevenths: true, pad: 'epiano',
    bass: { inst: 'bass', pattern: 'R...F...O...F...' },
    melody: { inst: 'bell', density: 0.35, octave: 1 },
    drums: { hat: 'x..x.xx..x.xx..x', swing: 0.25 }, level: 0.95,
  },
  'Concert Hall Radio': {
    bpm: 76, scale: MAJOR, prog: [0, 3, 4, 0], barsPerChord: 1, pad: 'strings',
    arp: { inst: 'epiano', every: 2, octave: 0, pattern: [0, 1, 2, 3, 2, 1, 0, 1] }, level: 1.4,
  },
  'Retro Hits Radio': {
    bpm: 120, scale: MAJOR, prog: [0, 5, 3, 4], barsPerChord: 1, pad: 'organ',
    bass: { inst: 'bass', pattern: 'R.O.R.O.R.O.R.O.' },
    melody: { inst: 'chip', density: 0.5, octave: 1 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, level: 0.6,
  },
  'Talk Hour Radio': GENRES['News&Opinion'],
  'Nightfall Radio': {
    bpm: 60, scale: LYDIAN, prog: [0, 4, 0, 1], barsPerChord: 2, pad: 'pad',
    melody: { inst: 'bell', density: 0.2, octave: 1 }, noise: 'water', level: 3.5,
  },
}

// HDMI inputs: the Game Console plays a chiptune loop, the Set-top Box a lounge bed.
const INPUTS: Record<string, Style> = {
  HDMI1: {
    bpm: 132, scale: MINOR, prog: [0, 5, 6, 4], barsPerChord: 1,
    bass: { inst: 'chip', pattern: 'R.O.R.O.R.O.R.O.' },
    arp: { inst: 'chip', every: 1, octave: 1 },
    drums: { kick: 'x...x...x...x...', hat: '..o...o...o...o.' }, level: 1.5,
  },
  HDMI2: {
    bpm: 90, scale: DORIAN, prog: [0, 3, 1, 4], barsPerChord: 2, sevenths: true, pad: 'epiano',
    bass: { inst: 'bass', pattern: 'R.....F.R.......' },
    drums: { hat: 'x.x.x.x.x.x.x.x.', swing: 0.2 }, level: 1.45,
  },
}

export function styleFor(source: string, ch?: { name: string; kind: string; genre: string }): Style | null {
  if (source !== 'TV') return INPUTS[source] ?? null
  if (!ch || ch.kind === 'data') return null
  if (ch.kind === 'radio') return RADIO[ch.name] ?? GENRES[ch.genre] ?? RADIO['Aurora Radio 1']
  return GENRES[ch.genre] ?? GENRES.Entertainment
}
