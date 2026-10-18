// Dynamic strings (ids 1941..2016): juiceappreg__dynrsc_getString hands them to the applications'
// string providers (table at 0x10061674, ceapprophdlr__dynstr_getString), which choose a static
// string by model options. Resolved here for this set: region Europe (ceisnvmpa_optionTable+352 = 0),
// DVB-T, Pixel Plus (option 0x56 available and 0, no Perfect Pixel HD), 2008 "smart settings" naming
// (optionTable+912 = 1, as on the same-range 37PFL7603D in footage) (the option values are inferred).
// Values: static string id, or a source-name slot for the Connections menu (hyselstr).

const VID: Record<number, number> = {
  // ceapvid__vidstr_getString (base 61), table at 0xb8d148 (Europe column) and special cases
  0: 613, 1: 449, 2: 79, 3: 649, 5: 318, 6: 879, 7: 313, 10: 1382, 11: 513, 12: 599, 13: 138,
  4: 1389,   // IsMenuAvailable(0x33) Pixel Plus 2 / (0x32) Pixel Plus: Pixel Plus
  8: 1389,   // option 0x56 == 0: "Pixel Plus" (else 0x565 "Perfect Pixel HD")
  9: 489,    // its help text
}
const AUD: Record<number, number> = {
  // ceapaud__audstr_getString (base 44), table at 0xb33220 (column 1 for Europe)
  0: 727, 1: 478, 2: 897, 3: 200, 4: 821, 5: 763, 6: 639, 7: 1111, 8: 843, 9: 544, 10: 597,
}
const HYINS: Record<number, number> = {
  // ceaphyins__hyinsstr_getString (base 21), table at 0xb87f40, DVB-T column (+0xc)
  0: 84, 1: 713, 2: 434, 3: 614, 4: 504, 5: 72, 6: 410, 7: 559, 8: 909, 9: 417, 10: 965,
}
const MISC: Record<number, number> = {
  // ceapmisc__misstr_getString (base 55), optionTable+912 = 1
  0: 580, 1: 502, 2: 95, 3: 221, 4: 1424,
}
const DEMO: Record<number, number> = {
  // ceapdemo__demostr_getString (base 2): option 0x56 == 0
  0: 1389, 1: 306, 2: 1119,
}

export function dynString(id: number, sourceName: (slot: number) => string, str: (id: number) => string): string {
  const d = id - 1941
  if (d >= 61 && d < 75) return VID[d - 61] ? str(VID[d - 61]) : ''
  if (d >= 44 && d < 55) return AUD[d - 44] ? str(AUD[d - 44]) : ''
  if (d >= 21 && d < 32) return HYINS[d - 21] ? str(HYINS[d - 21]) : ''
  if (d >= 55 && d < 60) return MISC[d - 55] ? str(MISC[d - 55]) : ''
  if (d >= 2 && d < 5) return DEMO[d - 2] ? str(DEMO[d - 2]) : ''
  if (d >= 5 && d < 21) return sourceName(d - 5) // ceaphypgsel__hyselstr_getString: LibHySource names
  if (d === 60) return str(0x316) // ceaptmrs__tmrstr_getString
  return ''
}
