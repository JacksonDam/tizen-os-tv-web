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
// menu (pairs: label, list caption) (inferred order).
export function sourceName(slot: number) {
  const inp = INPUTS[slot >> 1]
  return inp ? strings.get(inp.name) : ''
}
export function inputName(id: string) {
  if (id === 'TV') return strings.get(511)
  const inp = INPUTS.find(i => i.id === id)
  return inp ? strings.get(inp.name) : id
}
