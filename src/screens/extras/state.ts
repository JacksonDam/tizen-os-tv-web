import { useSyncExternalStore } from 'react'

// A tiny observable value for the extras' overlays (open/closed state shared between the key handlers
// registered with the shell and the overlay components).
export function createValue<T>(initial: T) {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return
      value = next
      subs.forEach(f => f())
    },
    use(): T {
      return useSyncExternalStore(
        f => {
          subs.add(f)
          return () => subs.delete(f)
        },
        () => value,
      )
    },
  }
}
