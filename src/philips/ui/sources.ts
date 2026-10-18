import { strings } from './env'

// The set's inputs. The firmware builds its source table (LibHySource, ceapjagconfig__pgseldiv_
// GetHySourceData at 0x100a0650) at start-up from the model configuration, which is not in the update;
// the connectors are those of the 42PFL5603D/12 (inferred from the product range: three SCART/YPbPr
// EXT inputs, three HDMI, the side AV input and VGA), with the firmware's names for them.
// The mocked set has a Blu-ray player on HDMI 1 and a game console on HDMI 2; the others are empty.

export type Input = { id: string; name: number; video: string }

export const INPUTS: Input[] = [
  { id: 'EXT1', name: 1289, video: '' },
  { id: 'EXT2', name: 1290, video: '' },
  { id: 'EXT3', name: 1291, video: '' },
  { id: 'HDMI1', name: 1303, video: 'loop-life.mp4' },
  { id: 'HDMI2', name: 1304, video: 'loop-bars.mp4' },
  { id: 'HDMI3', name: 1380, video: '' },
  { id: 'SIDE', name: 220, video: '' },
  { id: 'VGA', name: 1340, video: '' },
]

// ceaphypgsel__hyselstr_getString: dynamic strings 1946..1961 name the connectors in the Connections
// menu (pairs: label, list caption) for its eight connector lists list#68..#75 (properties
// 0x234..0x23b); the side input has its own list (list#76 "Side", property 0x233, with camera and
// game devices), so the connector lists name the rear inputs and an unused one is unavailable
// (inferred order).
const REAR = INPUTS.filter(i => i.id !== 'SIDE')
export function sourceName(slot: number) {
  const inp = REAR[slot >> 1]
  return inp ? strings.get(inp.name) : ''
}
export function connectorListAvailable(prop: number) {
  return prop < 0x234 || prop > 0x23b || prop - 0x234 < REAR.length
}
export function inputName(id: string) {
  if (id === 'TV') return strings.get(511)
  const inp = INPUTS.find(i => i.id === id)
  return inp ? strings.get(inp.name) : id
}
