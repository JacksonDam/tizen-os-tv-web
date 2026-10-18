import { useEffect } from 'react'
import type { MenuItem } from './types'

// Widgets the Menu opens over itself (CMenuMainWidgetAgency): sublists, input boxes, message boxes,
// and the action windows (CMenuWindowManager). Filled in by the following commits.
export type Widget =
  | { kind: 'item'; item: MenuItem }
  | { kind: 'dimreason'; item: MenuItem }

export function Widgets({ widget, onClose }: {
  widget: Widget; level: number; row: number; onClose: () => void; onExitMenu: () => void; onValue: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 0)
    return () => clearTimeout(t)
  }, [widget, onClose])
  return null
}
