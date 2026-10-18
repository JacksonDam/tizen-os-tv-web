// Sparse memory image of the TV application's UI data (mtv522eu .rodata/.data), exported by
// philips-fw/eu/tools/memexport.py: every Juice* widget table, the draw styles, palette and bitmap
// descriptors, plus the arrays their pointers reach. The renderer reads it with the firmware's own
// addresses and record offsets, so the ported draw functions keep the decompiled field offsets.

import { PH } from '../assets'

type Seg = { a: number; e: number; b: Uint8Array; v: DataView }

export type Atlas = Record<string, [number, number, number, number]>

export class Mem {
  segs: Seg[] = []
  sym: Record<string, [number, number]> = {}
  atlas: Atlas = {}
  palette: number[] = []
  private last: Seg | null = null

  constructor(json: { segments: [number, string][]; symbols: Record<string, [number, number]>; atlas: Atlas; palette: number[] }) {
    for (const [a, b64] of json.segments) {
      const bin = atob(b64)
      const b = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
      this.segs.push({ a, e: a + b.length, b, v: new DataView(b.buffer) })
    }
    this.segs.sort((x, y) => x.a - y.a)
    this.sym = json.symbols
    this.atlas = json.atlas
    this.palette = json.palette
  }

  private seg(a: number): Seg | null {
    const l = this.last
    if (l && a >= l.a && a < l.e) return l
    let lo = 0
    let hi = this.segs.length - 1
    while (lo <= hi) {
      const m = (lo + hi) >> 1
      const s = this.segs[m]
      if (a < s.a) hi = m - 1
      else if (a >= s.e) lo = m + 1
      else return (this.last = s)
    }
    // .bss reads as zero, like the zero-initialised runtime tables; a miss below .bss means the
    // export (memexport.py) did not cover data the UI uses
    if (import.meta.env.DEV && a < 0x100fde50 && !this.warned.has(a >> 8)) {
      this.warned.add(a >> 8)
      console.warn(`fw mem: read outside the exported image at 0x${a.toString(16)}`)
    }
    return null
  }
  private warned = new Set<number>()

  u8(a: number) {
    const s = this.seg(a)
    return s ? s.b[a - s.a] : 0
  }
  s8(a: number) {
    const v = this.u8(a)
    return v > 127 ? v - 256 : v
  }
  u16(a: number) {
    const s = this.seg(a)
    return s && a + 1 < s.e ? s.v.getUint16(a - s.a, true) : this.u8(a) | (this.u8(a + 1) << 8)
  }
  s16(a: number) {
    const v = this.u16(a)
    return v > 32767 ? v - 65536 : v
  }
  u32(a: number) {
    const s = this.seg(a)
    return s && a + 3 < s.e ? s.v.getUint32(a - s.a, true) : (this.u16(a) | (this.u16(a + 2) << 16)) >>> 0
  }
  s32(a: number) {
    return this.u32(a) | 0
  }
  addr(name: string) {
    const s = this.sym[name]
    if (!s) throw new Error(`symbol ${name} not exported`)
    return s[0]
  }
}

let memPromise: Promise<Mem> | null = null
export function loadMem(): Promise<Mem> {
  memPromise ??= fetch(`${PH}/fw/mem.json`).then(r => r.json()).then(j => new Mem(j))
  return memPromise
}
