import { useEffect, useState, type ReactNode } from 'react'
import './diag.css'

// ---- P_PopupToast_03 at the screen centre for 3 s ----
export function useToast(): [ReactNode, (text: string) => void] {
  const [toast, setToast] = useState<{ text: string; seq: number } | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])
  const node = toast ? (
    <div key={toast.seq} className="sd-toast">
      {toast.text}
    </div>
  ) : null
  return [node, (text: string) => setToast(t => ({ text, seq: (t?.seq ?? 0) + 1 }))]
}

