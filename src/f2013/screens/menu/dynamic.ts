import { COUNTRIES, LANGUAGES } from '../setup/pnp/strings'
import { CATEGORIES } from './tree.gen'
import type { MenuItem } from './types'

// Option lists the firmware builds from the TV process at runtime (TV.GetCountryList, the OSD
// language list): the same lists Plug & Play shows (setup/pnp/strings.ts), so the Menu and Plug & Play
// agree. Broadcasting > Channel Settings > Country and System > Menu Language.
const RUNTIME_OPTIONS: Record<number, [number, string][]> = {
  0x1dd: COUNTRIES.map((c, i) => [i, c]),
  0x3b4: LANGUAGES.map((l, i) => [i, l]),
}

function fill(items: MenuItem[]) {
  for (const it of items) {
    if (RUNTIME_OPTIONS[it.id]) it.o = RUNTIME_OPTIONS[it.id]
    if (it.k) fill(it.k)
  }
}
fill(CATEGORIES)
