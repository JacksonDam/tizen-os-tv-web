import { MAIN_MENU, type MenuItem } from './menuData'
import { patchSupport } from './menuSupport'
import { patchBroadcasting } from './menuBroadcasting'

// The All Settings tree for this mocked TV: the generated data plus the rows that depend on the
// mocked hardware (tuner, inputs) and the web rebuild hooks. Feature modules add their own patches
// with registerMenuPatch (from their register.ts); the tree is built on first use, after every
// module has registered.

type Patch = (menu: MenuItem[]) => MenuItem[]
const patches: Patch[] = [patchSupport, patchBroadcasting]
let built: MenuItem[] | null = null

export function registerMenuPatch(p: Patch) {
  patches.push(p)
  built = null
}

export function getMenu(): MenuItem[] {
  return (built ??= patches.reduce((m, p) => p(m), MAIN_MENU))
}

// Helper for patches: merge fields into rows by id, anywhere in the tree.
// e.g. registerMenuPatch(m => patchRows(m, { networkstatus: { launch: { app: 'network-status' } } }))
export function patchRows(menu: MenuItem[], byId: Record<string, Partial<MenuItem>>): MenuItem[] {
  const walk = (item: MenuItem): MenuItem => {
    const patched = byId[item.id] ? { ...item, ...byId[item.id] } : item
    return patched.groups ? { ...patched, groups: patched.groups.map(g => g.map(walk)) } : patched
  }
  return menu.map(walk)
}

// Helper for patches: find a row by id anywhere in the tree.
export function findRow(menu: MenuItem[], id: string): MenuItem | undefined {
  for (const item of menu) {
    if (item.id === id) return item
    for (const g of item.groups ?? []) {
      const r = findRow(g, id)
      if (r) return r
    }
  }
  return undefined
}
