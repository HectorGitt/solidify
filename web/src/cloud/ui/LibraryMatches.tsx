import { useEffect, useState } from 'react'
import { api } from '../api'
import type { LibraryCard } from '../admin'
import { useOpenLibrary } from '../library'

type Match = LibraryCard & { score: number }

/**
 * As someone types a request, the library's checked models that match it: opening one is instant and free
 * (their own copy), and building anyway still works (the build starts from the closest checked model).
 */
export function LibraryMatches({ query, className = '' }: { query: string; className?: string }) {
  const [matches, setMatches] = useState<Match[]>([])
  const { opening, open } = useOpenLibrary()
  const q = query.trim()

  useEffect(() => {
    if (q.length < 8) {
      setMatches([])
      return
    }
    const ac = new AbortController()
    // after a pause in typing, so a sentence is one search, not one per key
    const t = window.setTimeout(() => {
      api<{ matches: Match[] }>(`/v1/library/match?q=${encodeURIComponent(q.slice(0, 400))}`, { signal: ac.signal })
        .then((r) => setMatches(r.matches))
        .catch(() => {
          /* offline or busy: just no suggestions */
        })
    }, 450)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [q])

  if (!matches.length || q.length < 8) return null
  return (
    <div className={`rounded-2xl border border-accent/30 bg-accent/[0.06] p-3 text-left ${className}`}>
      <div className="mb-2 text-[12px] font-medium text-ink">
        {matches.length === 1 ? 'A checked model in the library matches this' : 'Checked models in the library match this'}
        <span className="font-normal text-mute"> · opens instantly, as your own copy</span>
      </div>
      <ul className="space-y-1.5">
        {matches.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={!!opening}
              onClick={() => void open(m)}
              className="group flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-1.5 pr-3 text-left transition-colors hover:border-accent/60 disabled:opacity-60"
            >
              <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-stage)]">
                {m.thumbnail ? <img src={m.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink group-hover:underline">{m.title}</span>
                <span className="block truncate text-[11.5px] text-mute">{m.prompt}</span>
              </span>
              <span className="shrink-0 text-[12px] font-medium text-accent">{opening === m.id ? 'Opening…' : 'Open'}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-dim">Or build your own: it starts from the closest checked model.</p>
    </div>
  )
}
