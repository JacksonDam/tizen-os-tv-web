import { PH } from '../assets'

// The TV's string tables: philips/data/ceapps/Strings/rscstr_lng*.fls, one per language, each a UTF-16
// text block followed by 1940 (offset, length) pairs (juicejrsc__rsc_getString, FUN_008c58ac). String
// ids are 1-based; a missing string falls back to the default language, English (rsca_DefaultLanguage 8).
// Ids above 1940 are dynamic strings resolved by the applications (juiceappreg__dynrsc_getString,
// see dyn.ts).

// Menu languages: the values of Installation > Languages > Menu language (list#81), in its order.
export const LANGUAGES: { code: string; prop: number; name: number }[] = [
  { code: 'cs', prop: 19, name: 1268 }, { code: 'da', prop: 20, name: 1270 }, { code: 'de', prop: 23, name: 1299 },
  { code: 'el', prop: 24, name: 1300 }, { code: 'en', prop: 14, name: 1288 }, { code: 'es', prop: 16, name: 1325 },
  { code: 'fr', prop: 15, name: 1294 }, { code: 'hr', prop: 12, name: 1261 }, { code: 'it', prop: 27, name: 1306 },
  { code: 'hu', prop: 26, name: 1305 }, { code: 'nl', prop: 21, name: 1285 }, { code: 'no', prop: 29, name: 1373 },
  { code: 'pl', prop: 2, name: 1393 }, { code: 'pt', prop: 3, name: 1394 }, { code: 'ro', prop: 11, name: 1365 },
  { code: 'ru', prop: 4, name: 1366 }, { code: 'sk', prop: 6, name: 1323 }, { code: 'sl', prop: 13, name: 1324 },
  { code: 'sr', prop: 10, name: 1371 }, { code: 'fi', prop: 22, name: 1293 }, { code: 'sv', prop: 7, name: 1327 },
  { code: 'tr', prop: 9, name: 1332 },
]

const cache = new Map<string, Promise<(string | null)[]>>()
function load(code: string) {
  let p = cache.get(code)
  if (!p) {
    p = fetch(`${PH}/fw/lang/${code}.json`).then(r => r.json())
    cache.set(code, p)
  }
  return p
}

export class Strings {
  private cur: (string | null)[] = []
  private en: (string | null)[] = []
  code = 'en'

  async use(code: string) {
    const [en, cur] = await Promise.all([load('en'), load(code)])
    this.en = en
    this.cur = cur
    this.code = code
  }

  // juicejstr__js_GetString for a static string id (1-based)
  get(id: number): string {
    if (id <= 0) return ''
    return this.cur[id - 1] ?? this.en[id - 1] ?? ''
  }
}
