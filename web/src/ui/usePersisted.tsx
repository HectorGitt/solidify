import { useState } from 'react'

/** a small preference kept in this browser (a panel folded away, say); works, unremembered, if storage is off */
export function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* storage off: kept for this visit only */
    }
  }
  return [value, set]
}

/** the fold toggle's chevron: points up when the part is open (press to fold it), down when folded */
export function FoldChevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
