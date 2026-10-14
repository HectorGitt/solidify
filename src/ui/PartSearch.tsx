import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sceneTitle } from '@/content/drilldown'
import { MODULES } from '@/modules/catalog'
import { useParts } from '@/parts/registry'
import { useView } from '@/render/view'
import { focusPart } from './camera'
import { Icon } from './icons'
import { active, goTo } from './navigate'
import { loadPartIndex } from './SeenIn'

interface Result {
  route: string
  title: string
  /** part name, or null for the scene itself */
  part: string | null
  score: number
}

/** Rank a candidate: every query word must appear; earlier and word-start matches score higher. */
function score(text: string, words: string[]) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of words) {
    const i = t.indexOf(w)
    if (i < 0) return -1
    s += i === 0 ? 30 : /\W/.test(t[i - 1] ?? ' ') ? 20 : 8
    s -= i * 0.05
  }
  return s - t.length * 0.01
}

/** Ctrl/⌘ + K (or "/") opens a search over every part and scene in the app. */
export function PartSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [index, setIndex] = useState<Record<string, string[]> | null>(null)
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('solidify:search', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('solidify:search', onOpen)
    }
  }, [])
  useEffect(() => {
    if (!open) return
    setQ('')
    setSel(0)
    loadPartIndex().then(setIndex)
    window.setTimeout(() => input.current?.focus(), 30)
  }, [open])

  const results = useMemo<Result[]>(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length || !index) return []
    const out: Result[] = []
    for (const m of MODULES)
      for (const s of m.scenes) {
        if (!s.load) continue
        const sc = score(`${s.title} ${m.title}`, words)
        if (sc >= 0) out.push({ route: `${m.id}/${s.id}`, title: s.title, part: null, score: sc + 5 })
      }
    for (const [route, names] of Object.entries(index)) {
      const title = sceneTitle(route)
      if (!title) continue
      for (const n of names) {
        const sc = score(n, words)
        if (sc >= 0) out.push({ route, title, part: n, score: sc + (route === active.route ? 3 : 0) })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 40)
  }, [q, index])

  const pick = (r: Result) => {
    setOpen(false)
    if (r.route === active.route && r.part) {
      const hit = Object.values(useParts.getState().parts).find((x) => x.name === r.part)
      if (hit) {
        useView.getState().select(hit.id)
        focusPart(hit.id)
      }
      return
    }
    goTo(navigate, r.route, { selectName: r.part ?? undefined })
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="w-[min(640px,100%)] overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon.target width={16} height={16} className="text-dim" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(results.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter' && results[sel]) pick(results[sel])
            }}
            placeholder="Search parts and scenes — crown wheel, injector, nozzle…"
            className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-dim"
          />
          <kbd className="rounded border border-line-2 px-1.5 text-[10.5px] text-dim">Esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {!index ? <li className="px-4 py-3 text-[12.5px] text-mute">Loading the part index…</li> : null}
          {index && q && !results.length ? <li className="px-4 py-3 text-[12.5px] text-mute">Nothing found.</li> : null}
          {results.map((r, i) => (
            <li key={`${r.route}|${r.part}`}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(r)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] ${i === sel ? 'bg-accent/10' : ''}`}
              >
                <span className={r.part ? 'text-ink' : 'font-medium text-accent'}>{r.part ?? r.title}</span>
                <span className="ml-auto truncate text-[11.5px] text-dim">{r.part ? r.title : 'scene'}</span>
                {r.route === active.route ? <span className="rounded bg-panel-3 px-1 text-[10px] text-mute">here</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-4 py-1.5 text-[11px] text-dim">↑ ↓ to move · Enter to open · Ctrl/⌘ K or / to toggle</div>
      </div>
    </div>
  )
}
